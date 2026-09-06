const functions = require('firebase-functions');
const admin = require('firebase-admin');
const dns = require('dns');
const https = require('https');
const http = require('http');
const {isPrivateOrReservedIp} = require('./ssrfGuard');
const {SpeechClient} = require('@google-cloud/speech').v2;
const {buildRecognizeRequest, extractTranscript} = require('./speechToText');
const {Translate} = require('@google-cloud/translate').v2;
const {validateTranslateInput, extractTranslation} = require('./translate');
const {buildPrompt, extractAnswer} = require('./aiChat');
const {isAutoReplyTrigger, autoReplyDecision} = require('./focusAutoReply');
const {
  isProActive,
  entitlementFromSubscription,
  shouldApplyEvent,
} = require('./entitlement');

admin.initializeApp();

const db = admin.firestore();
// Modular import rather than the legacy admin.firestore.FieldValue /
// admin.firestore.Timestamp namespace getters: those rebuild their return
// value from scratch on every property access (see firebase-admin's
// firebase-namespace.js), and that getter has been observed to come back
// without FieldValue attached when invoked through the Cloud Functions
// emulator's runtime wrapper — reproducible as a crash on any transaction
// that reaches the `tx.update(... FieldValue.increment ...)` branch, i.e.
// any call after the first within a rate-limit window. The submodule import
// is a stable reference, not a getter, and isn't affected.
const {FieldValue, Timestamp} = require('firebase-admin/firestore');
const speechClient = new SpeechClient();
const translateClient = new Translate();
// Cloudflare Workers AI (free tier, no billing-enablement trap the way
// Gemini's pay-as-you-go project setup had) — read from functions/.env,
// same loading mechanism as GCLOUD_PROJECT below.
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// Set explicitly by 1st-gen Cloud Functions; GOOGLE_CLOUD_PROJECT covers
// 2nd-gen/Cloud Run. Falling back through both keeps this working regardless
// of which generation transcribeVoiceMessage ends up deployed as.
const GCP_PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

// Chatterbox Pro billing — same functions/.env loading as the Cloudflare keys
// above. Absent in an unconfigured environment, which the billing callables
// detect and report as failed-precondition rather than crashing at load time
// (every other function in this file must keep deploying without them).
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY;
const STRIPE_PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

// Constructed lazily so a missing key can't throw during module load and
// take every unrelated function in this file down with it.
// Pinned rather than left to the SDK default. stripe-node already sends its
// own bundled version, so "no pin" really means "whatever the next `npm
// update` decides" — and the basil→dahlia move relocated
// subscription.current_period_end onto items, which silently breaks
// entitlement mapping (see entitlement.js). Pinning makes the version an
// explicit, reviewable choice; bump it deliberately and re-read the changelog.
const STRIPE_API_VERSION = '2026-07-29.dahlia';

// Labels Checkout Sessions so flows can be compared in the Dashboard. Fixed,
// not per-request: a value that changed every call couldn't be grouped.
const STRIPE_INTEGRATION_ID = 'chatterbox_pro_qvbnmxkd';

let stripeClient = null;
function getStripe() {
  if (!stripeClient) {
    // eslint-disable-next-line global-require
    stripeClient = require('stripe')(STRIPE_SECRET_KEY, {apiVersion: STRIPE_API_VERSION});
  }
  return stripeClient;
}

/**
 * Checkout/portal redirect targets are attacker-influenceable (they arrive in
 * the callable payload), so they're restricted to this app's own origins —
 * otherwise the URL could be pointed at a lookalike site and the post-payment
 * redirect turned into a phishing hop.
 */
function isAllowedReturnUrl(url) {
  try {
    const parsed = new URL(url);
    const allowed = new URL(APP_BASE_URL);
    return parsed.origin === allowed.origin;
  } catch {
    return false;
  }
}

// Scheduled (Cloud Scheduler / pubsub) functions require the Blaze plan. When
// billing is closed they block *every* deploy (the CLI enables required APIs
// codebase-wide). We define them normally but strip them from `exports` at the
// bottom of this file unless CHATTERBOX_ENABLE_SCHEDULED=true, so the rest of
// the functions can still deploy. To ship the scheduled ones once billing is on:
//   CHATTERBOX_ENABLE_SCHEDULED=true firebase deploy --only functions
//
// The flag has to be read from the file as well as from process.env, and that
// is not belt-and-braces — process.env alone cannot work here.
//
// Deploying happens in two passes. First the CLI loads this module in a local
// subprocess to discover what `exports` contains; only then does it upload,
// applying functions/.env to the *deployed* runtime. The `delete exports[...]`
// at the bottom therefore runs during discovery, where .env has not been
// applied to process.env and an inherited shell variable does not survive into
// the subprocess either. Both spellings of the documented invocation left the
// flag undefined at exactly the moment it decides anything, so these six
// functions silently never deployed — which is why disappearing messages never
// expired in production.
/**
 * App Check enforcement for callable functions, off unless switched on.
 *
 * App Check is initialised on the clients but nothing verified it here, and an
 * unenforced App Check protects nothing at all — it is a token the client
 * bothers to fetch and the server never looks at. Any script holding a stolen
 * or self-registered ID token can call these functions directly, which is what
 * App Check exists to stop.
 *
 * It is off by default because turning it on is not a code decision. Enforcing
 * before the providers are registered in the Firebase console (App Attest or
 * DeviceCheck for iOS, Play Integrity for Android, and a debug token for local
 * builds) rejects *every* call from *every* client — a total outage, not a
 * degradation. So this ships ready and inert, exactly like the scheduled
 * functions above, and PROVISIONING.md carries the order the switches have to
 * be thrown in.
 *
 * Read from the .env file as well as process.env for the reason given at
 * length above: during the CLI's discovery pass, .env has not been applied to
 * process.env and an inherited shell variable does not reach the subprocess.
 */
function envFlag(name) {
  if (process.env[name] !== undefined) return process.env[name];
  try {
    const fs = require('fs');
    const path = require('path');
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const line = raw
      .split('\n')
      .map(l => l.trim())
      .find(l => !l.startsWith('#') && l.startsWith(`${name}=`));
    return line ? line.slice(line.indexOf('=') + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const APP_CHECK_ENFORCED = envFlag('CHATTERBOX_ENFORCE_APP_CHECK') === 'true';

/**
 * The builder every callable in this file is defined through.
 *
 * A single place so enforcement cannot be switched on for some entry points
 * and quietly missed on others — the one left out would be the one that gets
 * used.
 */
function callable() {
  return APP_CHECK_ENFORCED
    ? functions.runWith({enforceAppCheck: true}).https
    : functions.https;
}

function scheduledFlagFromEnvFile() {
  try {
    const fs = require('fs');
    const path = require('path');
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const line = raw
      .split('\n')
      .map(l => l.trim())
      .find(l => !l.startsWith('#') && l.startsWith('CHATTERBOX_ENABLE_SCHEDULED='));
    return line ? line.slice(line.indexOf('=') + 1).trim() : undefined;
  } catch {
    // No .env (CI before it writes one, or a fresh clone) — absent, not false.
    return undefined;
  }
}
const SCHEDULED_ENABLED =
  (process.env.CHATTERBOX_ENABLE_SCHEDULED ?? scheduledFlagFromEnvFile()) === 'true';
const SCHEDULED_FUNCTIONS = [
  'processScheduledMessages',
  'processReminders',
  'processExpiredMessages',
  'processDeadManSwitch',
  'sweepStaleCalls',
  'sweepExpiredLiveLocations',
];

/**
 * Per-user, per-function call throttle backed by Firestore.
 * Uses a transaction so concurrent calls can't race past the limit.
 */
async function checkRateLimit(uid, key, {maxCalls, windowMs}) {
  const ref = db.doc(`users/${uid}/rateLimits/${key}`);
  const now = Date.now();
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    if (!data || now - data.windowStart > windowMs) {
      tx.set(ref, {windowStart: now, count: 1});
      return;
    }
    if (data.count >= maxCalls) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Rate limit exceeded. Please slow down and try again shortly.',
      );
    }
    tx.update(ref, {count: FieldValue.increment(1)});
  });
}

// ─── SSRF-safe outbound fetch (used by fetchLinkPreview) ───────────────────
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 50000;
const FETCH_TIMEOUT_MS = 5000;

async function safeFetchUrl(targetUrl, redirectsLeft = MAX_REDIRECTS) {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed.');
  }
  const {address} = await dns.promises.lookup(parsed.hostname);
  if (isPrivateOrReservedIp(address)) {
    throw new Error('URL resolves to a private/internal address and is not allowed.');
  }
  const client = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(
      {
        // Connect to the already-validated IP (not the hostname) so a DNS
        // rebind between the lookup above and the request can't bypass the check.
        host: address,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {Host: parsed.hostname, 'User-Agent': 'ChatterboxBot/1.0'},
        servername: parsed.protocol === 'https:' ? parsed.hostname : undefined,
        timeout: FETCH_TIMEOUT_MS,
      },
      res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects.'));
            return;
          }
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          safeFetchUrl(nextUrl, redirectsLeft - 1).then(resolve).catch(reject);
          return;
        }
        let body = '';
        res.on('data', chunk => {
          body += chunk;
          if (body.length > MAX_BODY_BYTES) res.destroy();
        });
        res.on('end', () => resolve(body));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

/**
 * Session claim function that replaces the active session.
 * When a user logs in on a new device, this function:
 * 1. Immediately overwrites the activeSessionId in Firestore
 * 2. The old device detects the change via its real-time listener and signs out
 * 3. No token revocation — the old session logs out gracefully on its own
 */
exports.claimSession = callable().onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  // A claim overwrites setCustomUserClaims (a quota-limited Admin operation)
  // and immediately evicts whatever session currently holds the account —
  // both are worth bounding even though the caller must already be
  // authenticated as this uid. Generous enough for legitimate multi-device
  // switching; well below anything a spamming/looping client would produce.
  await checkRateLimit(context.auth.uid, 'claimSession', {maxCalls: 5, windowMs: 60000});

  const sessionId = data && typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId.');
  }
  if (sessionId.length > 256) {
    throw new functions.https.HttpsError('invalid-argument', 'sessionId too long.');
  }

  const uid = context.auth.uid;
  const deviceInfo = data.deviceInfo && typeof data.deviceInfo === 'object' ? data.deviceInfo : {};
  const deviceInfoStr = JSON.stringify(deviceInfo);
  if (deviceInfoStr.length > 4096) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceInfo too large.');
  }

  try {
    // Set custom claims with new session ID
    await admin.auth().setCustomUserClaims(uid, {
      sessionId,
      sessionClaimedAt: Date.now(),
    });
    
    // Overwrite the activeSessionId in Firestore.
    // The previous device's real-time listener will detect this change
    // and sign itself out automatically.
    const sessionData = {
      activeSessionId: sessionId,
      sessionUpdatedAt: FieldValue.serverTimestamp(),
      sessionClaimedAt: FieldValue.serverTimestamp(),
      deviceInfo: {
        platform: deviceInfo.platform || 'unknown',
        deviceId: deviceInfo.deviceId || null,
        deviceName: deviceInfo.deviceName || null,
        appVersion: deviceInfo.appVersion || null,
      },
    };
    
    await admin
      .firestore()
      .doc(`users/${uid}`)
      .set(sessionData, {merge: true});

    functions.logger.info(`Session claimed for user ${uid}`, {
      sessionId,
      deviceInfo,
      timestamp: Date.now(),
    });

    return {ok: true, sessionId};
  } catch (error) {
    functions.logger.error(`Failed to claim session for user ${uid}`, error);
    throw new functions.https.HttpsError('internal', 'Failed to claim session');
  }
});

/**
 * Heartbeat function to keep session alive
 * Sessions expire after 5 minutes of inactivity
 */
exports.sessionHeartbeat = callable().onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  // Mobile heartbeats every 60s (see AuthContext.tsx; web doesn't call this
  // function at all yet), so 10/min is generous headroom over normal use.
  // The 30s no-write check below already avoids redundant *writes*, but
  // still pays for a Firestore read on every call — this bounds the call
  // rate itself.
  await checkRateLimit(context.auth.uid, 'sessionHeartbeat', {maxCalls: 10, windowMs: 60000});

  const uid = context.auth.uid;
  const sessionId = data && typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId.');
  }
  if (sessionId.length > 256) {
    throw new functions.https.HttpsError('invalid-argument', 'sessionId too long.');
  }

  try {
    const userDoc = await admin.firestore().doc(`users/${uid}`).get();
    const userData = userDoc.data();

    // Verify session is still active
    if (userData?.activeSessionId !== sessionId) {
      throw new functions.https.HttpsError('permission-denied', 'Session mismatch');
    }

    // Rate limit: min 30s between heartbeats to prevent spam
    const lastHeartbeat = userData?.sessionHeartbeatAt?.toMillis?.();
    if (lastHeartbeat && Date.now() - lastHeartbeat < 30000) {
      return {ok: true}; // Already recent, no need to update
    }

    // Update heartbeat timestamp
    await admin.firestore().doc(`users/${uid}`).set({
      sessionHeartbeatAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    
    return {ok: true};
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    functions.logger.error(`Heartbeat failed for user ${uid}`, error);
    throw new functions.https.HttpsError('internal', 'Heartbeat failed');
  }
});

// Helper: verify caller is a chat participant
async function verifyChatParticipant(chatId, uid) {
  const chatSnap = await db.doc(`chats/${chatId}`).get();
  if (!chatSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Chat not found.');
  }
  const chat = chatSnap.data();
  if (!chat.participants || !chat.participants.includes(uid)) {
    throw new functions.https.HttpsError('permission-denied', 'Not a participant of this chat.');
  }
  return chat;
}

/**
 * Server-side Chatterbox Pro gate. This is the actual paywall for paid
 * features; client-side checks only decide whether to render a lock.
 *
 * Reads entitlements/{uid}, which no client can write (firestore.rules) —
 * only the Stripe webhook does, via the Admin SDK. A missing document is the
 * normal free-tier state, not an error.
 *
 * Throws `permission-denied` with a stable `reason` the clients key off to
 * show an upgrade prompt rather than a generic failure.
 */
async function requirePro(uid) {
  const snap = await db.doc(`entitlements/${uid}`).get();
  if (!isProActive(snap.exists ? snap.data() : null)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Chatterbox Pro is required for this feature.',
      {reason: 'pro-required'},
    );
  }
}

// ─── Feature 1: Scheduled Messages ─────────────────────────────────────────
exports.processScheduledMessages = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    try {
      const now = Date.now();
      // Use collectionGroup query to avoid scanning all chats
      const schedSnap = await db.collectionGroup('scheduledMessages')
        .where('scheduledFor', '<=', now)
        .where('sent', '==', false)
        .limit(50)
        .get();
      if (schedSnap.empty) return null;
      let sent = 0;
      for (const schedDoc of schedSnap.docs) {
        try {
          const data = schedDoc.data();
          const chatRef = schedDoc.ref.parent.parent;
          if (!chatRef) continue;

          // This writes with the Admin SDK, so the rule requiring a message to
          // be authored as its sender never runs here. The rules now enforce
          // that at scheduling time; this checks the author is at least a
          // member of the chat, which catches documents written before that
          // rule existed. It does not, on its own, stop one participant
          // forging another — that is the scheduling rule's job, and this is
          // the second lock rather than the first.
          const chatSnap = await chatRef.get();
          const chat = chatSnap.data();
          const author = data.user?._id;
          if (!author || !(chat?.participants || []).includes(author)) {
            functions.logger.warn('Refusing scheduled message with a non-member author', {
              path: schedDoc.ref.path,
              author,
            });
            // Marked sent so it is not retried every minute forever.
            await schedDoc.ref.update({sent: true});
            continue;
          }

          const msgRef = chatRef.collection('messages').doc(schedDoc.id);
          const {scheduledFor: _sf, sent: _s, ...messageData} = data;
          await msgRef.set({
            ...messageData,
            createdAt: FieldValue.serverTimestamp(),
          });
          if (chat) {
            const unreadCountBy = {...(chat.unreadCountBy || {})};
            (chat.participants || []).forEach(uid => {
              if (uid === data.user?._id) {
                unreadCountBy[uid] = 0;
              } else {
                unreadCountBy[uid] = (unreadCountBy[uid] || 0) + 1;
              }
            });
            await chatRef.set({
              lastMessage: {text: data.text || '', createdAt: FieldValue.serverTimestamp()},
              updatedAt: FieldValue.serverTimestamp(),
              unreadCountBy,
            }, {merge: true});
          }
          await schedDoc.ref.update({sent: true});
          sent++;
        } catch (e) {
          functions.logger.error('Error processing scheduled message', e);
        }
      }
      if (sent > 0) {
        functions.logger.info(`Sent ${sent} scheduled messages`);
      }
    } catch (error) {
      functions.logger.error('processScheduledMessages failed', error);
    }
    return null;
  });

// ─── Feature 3: Message Reminders ───────────────────────────────────────────
exports.processReminders = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    try {
      const now = Date.now();
      // Use collectionGroup query to avoid scanning all users
      const remindersSnap = await db.collectionGroup('reminders')
        .where('remindAt', '<=', now)
        .where('sent', '==', false)
        .limit(50)
        .get();
      if (remindersSnap.empty) return null;
      let processed = 0;
      for (const reminderDoc of remindersSnap.docs) {
        try {
          const reminder = reminderDoc.data();
          const userRef = reminderDoc.ref.parent.parent;
          if (!userRef) continue;
          // Push token now lives in the owner-only private subcollection.
          const pushData = (await userRef.collection('private').doc('push').get()).data();
          const fcmToken = pushData?.fcmToken || pushData?.fcmTokens?.[0];
          if (fcmToken) {
            try {
              await admin.messaging().send({
                token: fcmToken,
                notification: {
                  title: 'Message Reminder',
                  body: reminder.messagePreview || 'You have a reminder',
                },
                data: {
                  type: 'reminder',
                  chatId: reminder.chatId || '',
                  messageId: String(reminder.messageId || ''),
                },
              });
            } catch (e) {
              functions.logger.warn('Failed to send reminder notification', e);
            }
          }
          await reminderDoc.ref.update({sent: true});
          processed++;
        } catch (e) {
          functions.logger.error('Error processing reminder', e);
        }
      }
      if (processed > 0) {
        functions.logger.info(`Processed ${processed} reminders`);
      }
    } catch (error) {
      functions.logger.error('processReminders failed', error);
    }
    return null;
  });

// ─── Feature 4: Voice Transcription ─────────────────────────────────────────
// Voice messages are normally end-to-end encrypted — the server never sees
// their content. This function is the one deliberate, per-message exception:
// the caller must already hold the decrypted plaintext clip (it does, for
// playback) and explicitly opts in by tapping "Transcribe", sending that one
// clip's audio here so it can be forwarded to Speech-to-Text. Nothing about
// how messages are stored or synced between devices changes; the function
// itself never reads ciphertext or has any way to decrypt it.
exports.transcribeVoiceMessage = callable().onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  await checkRateLimit(context.auth.uid, 'transcribeVoiceMessage', {maxCalls: 10, windowMs: 60000});
  const {chatId, messageId, audio, language, sampleRateHertz, audioChannelCount} = data || {};
  if (!chatId || !messageId || !audio) {
    throw new functions.https.HttpsError('invalid-argument', 'chatId, messageId, and audio required.');
  }
  await verifyChatParticipant(chatId, context.auth.uid);
  const msgRef = db.doc(`chats/${chatId}/messages/${messageId}`);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Message not found.');
  }
  const msg = msgSnap.data();
  // Only ever true for a document written before transcripts were sealed.
  // Kept so those messages don't pay for the same call twice; the sealed
  // field this function now leaves alone is checked by the caller instead.
  if (msg.transcription) {
    return {transcription: msg.transcription};
  }

  let request;
  try {
    request = buildRecognizeRequest(GCP_PROJECT_ID, audio, language, sampleRateHertz, audioChannelCount);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
  }

  let response;
  try {
    [response] = await speechClient.recognize(request);
  } catch (error) {
    // Node's default error inspection truncates nested arrays (e.g.
    // statusDetails[].fieldViolations) as "[Array]", hiding the one field
    // that actually says what was wrong with the request. Logging it
    // separately, fully expanded, is what made the MP4_AAC/WEBM_OPUS fix
    // possible to diagnose from Cloud Logging in the first place.
    functions.logger.error('transcribeVoiceMessage: Speech-to-Text call failed', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      statusDetails: JSON.stringify(error?.statusDetails, null, 2),
    });
    throw new functions.https.HttpsError('internal', 'Transcription failed. Please try again.');
  }

  // Returned, not stored. This function runs with the Admin SDK and has no
  // access to anyone's keys, so anything it writes to the message document is
  // written in the clear — and a transcript is the message. The caller seals
  // it to the chat and writes it back itself (services/transcription.ts's
  // buildTranscriptionPatch), which is the same route link previews and
  // shared lists take.
  const transcription = extractTranscript(response) || '[No speech detected]';
  return {transcription};
});

// ─── Feature 5: AI Chat Summary / Topic Q&A ─────────────────────────────────
// Message text is normally end-to-end encrypted — same rationale as
// transcribeVoiceMessage/translateMessage above. This function cannot read
// Firestore's msg.text (ciphertext for an encrypted chat), so the caller
// sends the messages it has already decrypted client-side for display. One
// deliberate, user-initiated exception to E2EE per "Catch Up" tap; nothing
// about how messages are stored or synced changes.
//
// `question` is optional: omitted, this produces a general summary; given,
// it answers that question using only the supplied conversation.
//
// Chatterbox Pro only. The entitlement check here IS the paywall — the
// client's matching check (services/entitlement.ts) merely renders a lock
// instead of an error, and can be bypassed by calling this callable directly
// with any signed-in token. Checked first, before the rate-limit write and
// well before any billable Cloudflare AI call, so an unentitled caller costs
// one Firestore read and nothing else.
exports.summarizeChat = callable().onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  await requirePro(context.auth.uid);
  await checkRateLimit(context.auth.uid, 'summarizeChat', {maxCalls: 5, windowMs: 60000});
  const {chatId, messages, question} = data || {};
  if (!chatId || !messages) {
    throw new functions.https.HttpsError('invalid-argument', 'chatId and messages required.');
  }
  await verifyChatParticipant(chatId, context.auth.uid);

  let prompt;
  try {
    prompt = buildPrompt(messages, question);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
  }

  let response;
  try {
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_AI_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({messages: [{role: 'user', content: prompt}]}),
      },
    );
    response = await cfResponse.json();
    if (!cfResponse.ok || response?.success === false) {
      throw new Error(JSON.stringify(response?.errors || response));
    }
  } catch (error) {
    functions.logger.error('summarizeChat: Cloudflare Workers AI call failed', {
      message: error?.message,
    });
    throw new functions.https.HttpsError('internal', 'Summary failed. Please try again.');
  }

  const summary = extractAnswer(response) || 'No summary available.';
  return {summary};
});

// ─── Feature 8: Message Translation ──────────────────────────────────────────
// Message text is normally end-to-end encrypted — same rationale as
// transcribeVoiceMessage above. The server only ever sees ciphertext in
// Firestore's msg.text for an encrypted message, so this is the one
// deliberate, per-message exception: the caller sends its already-decrypted
// plaintext (it has it, for display) when the user explicitly taps
// "Translate". Nothing about how messages are stored or synced changes.
exports.translateMessage = callable().onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  await checkRateLimit(context.auth.uid, 'translateMessage', {maxCalls: 20, windowMs: 60000});
  const {chatId, messageId, text, targetLanguage} = data || {};
  if (!chatId || !messageId || !text || !targetLanguage) {
    functions.logger.warn('translateMessage: rejected — missing field(s)', {
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasText: !!text,
      textType: typeof text,
      hasTargetLanguage: !!targetLanguage,
      targetLanguageType: typeof targetLanguage,
    });
    throw new functions.https.HttpsError('invalid-argument', 'chatId, messageId, text, and targetLanguage required.');
  }
  await verifyChatParticipant(chatId, context.auth.uid);
  const msgRef = db.doc(`chats/${chatId}/messages/${messageId}`);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Message not found.');
  }
  const msg = msgSnap.data();
  // Only ever true for a document written before translations stopped being
  // stored. Reading it back is free and saves a call; nothing writes it now.
  if (msg.translations?.[targetLanguage]) {
    return {translation: msg.translations[targetLanguage]};
  }

  try {
    validateTranslateInput(text, targetLanguage);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
  }

  let result;
  try {
    result = await translateClient.translate(text, targetLanguage);
  } catch (error) {
    functions.logger.error('translateMessage: Cloud Translate call failed', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    throw new functions.https.HttpsError('internal', 'Translation failed. Please try again.');
  }

  // Returned, not stored — same reason as transcribeVoiceMessage above. A
  // translation is a readable rendering of a message whose text is ciphertext
  // in this very document, and storing one here undid the encryption for that
  // message permanently. Neither client ever displayed the stored copy: both
  // hold the result in session state and re-ask on the next launch, which
  // costs one call against a 20/minute limit.
  const translation = extractTranslation(result);
  return {translation};
});

// ─── Feature 9: Focus Mode Auto-Reply ────────────────────────────────────────
exports.autoReplyFocusMode = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    try {
      const message = snap.data();
      const {chatId} = context.params;
      // Whether this message should be answered at all — including the
      // encrypted case, which the old `!message.text` test silently dropped.
      // See focusAutoReply.js.
      if (!isAutoReplyTrigger(message)) return null;
      const senderId = message.user._id;

      const chatSnap = await db.doc(`chats/${chatId}`).get();
      if (!chatSnap.exists) return null;
      const chat = chatSnap.data();
      const recipients = (chat.participants || []).filter(uid => uid !== senderId);

      for (const recipientId of recipients) {
        try {
          // Blocking means silence, in both directions. An auto-reply is a
          // message *from* the person with focus mode on, so a block either way
          // has to suppress it: without this, blocking someone still sent them
          // an automated note confirming you were around and had focus mode on.
          // notifyNewMessage already refuses the same pair; this was the other
          // way a blocked user could still hear from you.
          const [theyBlocked, iBlocked, userSnap] = await Promise.all([
            db.doc(`blocks/${recipientId}_${senderId}`).get(),
            db.doc(`blocks/${senderId}_${recipientId}`).get(),
            db.doc(`users/${recipientId}`).get(),
          ]);
          if (!userSnap.exists) continue;
          const userData = userSnap.data();

          const decision = autoReplyDecision({
            blockedEitherWay: theyBlocked.exists || iBlocked.exists,
            focus: userData?.focusMode,
            now: Date.now(),
          });
          if (decision.action === 'skip') continue;
          if (decision.action === 'expire') {
            await db.doc(`users/${recipientId}`).update({'focusMode.enabled': false});
            continue;
          }
          const replyText = decision.text;
          const replyId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          /**
           * Flagged `system` and `autoReply`, like the missed-call notice
           * postMissedCallNotice writes. The body is composed on the server
           * and is therefore **not** end-to-end encrypted — it cannot be, the
           * server holds no keys — so it should not present as words the user
           * typed in a thread where everything else is sealed.
           *
           * That is a real cost, and the honest framing is: the away message
           * is a line the user wrote specifically to be shown to whoever
           * messages them, not conversation content. Marking it makes the
           * difference visible instead of hiding it behind an identical
           * message bubble. (Web renders `system` distinctly; mobile has no
           * such concept yet and shows it as an ordinary message, which is
           * already true of missed-call notices.)
           */
          await db.doc(`chats/${chatId}/messages/${replyId}`).set({
            _id: replyId,
            text: replyText,
            createdAt: FieldValue.serverTimestamp(),
            user: {
              _id: recipientId,
              name: userData.displayName || userData.email || 'User',
            },
            system: true,
            autoReply: true,
          });
          await db.doc(`chats/${chatId}`).set({
            lastMessage: {
              text: replyText,
              createdAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          }, {merge: true});
        } catch (e) {
          functions.logger.error(`Auto-reply failed for recipient ${recipientId}`, e);
        }
      }
    } catch (error) {
      functions.logger.error('autoReplyFocusMode failed', error);
    }
    return null;
  });

// ─── New Message Push Notification ──────────────────────────────────────────
// A separate function on the same trigger as autoReplyFocusMode above rather
// than folded into it -- unrelated concerns (auto-reply vs. delivery
// notification), and neither should be able to fail because the other did.
//
// Messages are end-to-end encrypted, so the server has no readable content to
// put in the notification even if it wanted to -- title is just the sender's
// name, body is a fixed generic string, matching the privacy boundary
// elsewhere in this app (see src/services/aiConsent.ts on the client).
exports.notifyNewMessage = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    try {
      const message = snap.data();
      const {chatId, messageId} = context.params;
      if (!message?.user?._id) return null;
      const senderId = message.user._id;

      const chatSnap = await db.doc(`chats/${chatId}`).get();
      if (!chatSnap.exists) return null;
      const chat = chatSnap.data();
      const mutedBy = new Set(chat.mutedBy || []);
      const recipients = (chat.participants || []).filter(
        uid => uid !== senderId && !mutedBy.has(uid),
      );
      if (recipients.length === 0) return null;

      const senderSnap = await db.doc(`users/${senderId}`).get();
      const senderData = senderSnap.data();
      const senderName = senderData?.displayName || senderData?.email || 'Someone';

      for (const recipientId of recipients) {
        try {
          // Blocking someone must at minimum stop them making your phone
          // buzz with their name on it. Nothing checked this: `mutedBy` above
          // was the only filter, so a blocked sender still triggered a full
          // notification, which is the single most visible thing a block is
          // expected to prevent.
          //
          // Checked here rather than in the rules because the write itself
          // cannot be denied safely — a rejected send stays in the sender's
          // outbox and retries forever, and permission-denied is
          // indistinguishable from the displaced-session case, so denying
          // would risk silently dropping legitimate messages.
          const blockSnap = await db.doc(`blocks/${recipientId}_${senderId}`).get();
          if (blockSnap.exists) continue;

          const pushSnap = await db.doc(`users/${recipientId}/private/push`).get();
          const pushData = pushSnap.data();
          const token = pushData?.fcmToken || pushData?.fcmTokens?.[0];
          if (!token) continue;
          await admin.messaging().send({
            token,
            // No top-level `notification` -- Android would otherwise
            // auto-display this with whatever's here, bypassing the
            // background handler that decrypts the real text on-device (see
            // src/services/firebase/push.ts). `apns` below restores an
            // equivalent alert for iOS, which doesn't yet have that
            // decrypt-on-device path.
            data: {
              type: 'chat_message',
              chatId,
              messageId,
              senderName,
            },
            android: {
              priority: 'high',
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: senderName,
                    body: 'Sent you a message',
                  },
                  sound: 'default',
                },
              },
            },
          });
        } catch (e) {
          functions.logger.warn(`Failed to notify recipient ${recipientId}`, e);
        }
      }
    } catch (error) {
      functions.logger.error('notifyNewMessage failed', error);
    }
    return null;
  });

// ─── Disappearing Messages ──────────────────────────────────────────────────
exports.processExpiredMessages = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    try {
      const now = Date.now();
      const chatsSnap = await db.collection('chats')
        .where('messageExpiry', '>', 0)
        .get();
      if (chatsSnap.empty) return null;
      let deleted = 0;
      for (const chatDoc of chatsSnap.docs) {
        try {
          const chat = chatDoc.data();
          const expiryMs = chat.messageExpiry * 3600000;
          const cutoff = new Date(now - expiryMs);
          const expiredSnap = await chatDoc.ref.collection('messages')
            .where('createdAt', '<', cutoff)
            .limit(200)
            .get();
          if (expiredSnap.empty) continue;
          const batch = db.batch();
          expiredSnap.docs.forEach(msgDoc => batch.delete(msgDoc.ref));
          await batch.commit();
          deleted += expiredSnap.size;
        } catch (e) {
          functions.logger.error(`Error processing expired messages for chat ${chatDoc.id}`, e);
        }
      }
      if (deleted > 0) {
        functions.logger.info(`Deleted ${deleted} expired messages`);
      }
    } catch (error) {
      functions.logger.error('processExpiredMessages failed', error);
    }
    return null;
  });

// ─── View-Once Media Cleanup ────────────────────────────────────────────────
exports.markViewOnceViewed = callable().onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  const {chatId, messageId} = data || {};
  if (!chatId || !messageId) {
    throw new functions.https.HttpsError('invalid-argument', 'chatId and messageId required.');
  }
  await verifyChatParticipant(chatId, context.auth.uid);
  const msgRef = db.doc(`chats/${chatId}/messages/${messageId}`);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Message not found.');
  }
  const msg = msgSnap.data();
  if (!msg.viewOnce) {
    throw new functions.https.HttpsError('failed-precondition', 'Not a view-once message.');
  }
  if (msg.user?._id === context.auth.uid) {
    return {ok: true};
  }
  if (msg.viewOnceViewedBy?.includes(context.auth.uid)) {
    throw new functions.https.HttpsError('already-exists', 'Already viewed.');
  }
  const viewedBy = [...(msg.viewOnceViewedBy || []), context.auth.uid];
  await msgRef.update({
    viewOnceViewedBy: viewedBy,
    viewOnceOpenedAt: FieldValue.serverTimestamp(),
  });
  const allParticipants = (await db.doc(`chats/${chatId}`).get()).data()?.participants || [];
  const otherParticipants = allParticipants.filter(uid => uid !== msg.user?._id);
  const allViewed = otherParticipants.every(uid => viewedBy.includes(uid));
  if (allViewed) {
    await msgRef.update({
      image: null,
      video: null,
      audio: null,
      text: '[View-once media expired]',
      viewOnceExpired: true,
    });
  }
  return {ok: true, allViewed};
});

// ─── Server-Side Link Preview ───────────────────────────────────────────────
exports.fetchLinkPreview = callable().onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  await checkRateLimit(context.auth.uid, 'fetchLinkPreview', {maxCalls: 20, windowMs: 60000});
  const {url} = data || {};
  if (!url || typeof url !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'url required.');
  }
  try {
    const html = await safeFetchUrl(url);
    const getMetaContent = (name) => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, 'i'),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
      }
      return null;
    };
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const preview = {
      url,
      title: getMetaContent('og:title') || (titleMatch ? titleMatch[1].trim() : null),
      description: getMetaContent('og:description') || getMetaContent('description'),
      image: getMetaContent('og:image'),
    };
    return {preview};
  } catch (error) {
    functions.logger.warn('fetchLinkPreview failed', error);
    return {preview: {url, title: null, description: null, image: null}};
  }
});

// ─── Dead Man Switch Notification ───────────────────────────────────────────
exports.processDeadManSwitch = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    try {
      const now = Date.now();
      const usersSnap = await db.collection('users')
        .where('deadManSwitch.enabled', '==', true)
        .get();
      if (usersSnap.empty) return null;
      let notified = 0;
      for (const userDoc of usersSnap.docs) {
        try {
          const data = userDoc.data();
          const dms = data.deadManSwitch;
          if (!dms?.enabled || !dms.lastCheckIn || !dms.days) continue;
          const elapsed = now - dms.lastCheckIn;
          const threshold = dms.days * 86400000;
          if (elapsed < threshold) continue;
          if (data.deadManNotified) continue;
          const trustedContacts = data.trustedContacts || [];
          for (const contact of trustedContacts) {
            if (!contact.uid) continue;
            const pushSnap = await db.doc(`users/${contact.uid}/private/push`).get();
            const pushData = pushSnap.data();
            const contactToken = pushData?.fcmToken || pushData?.fcmTokens?.[0];
            if (contactToken) {
              try {
                await admin.messaging().send({
                  token: contactToken,
                  notification: {
                    title: 'Dead Man Switch Alert',
                    body: `${data.displayName || 'A contact'} has been inactive for ${dms.days} days.`,
                  },
                });
              } catch {}
            }
          }
          await userDoc.ref.update({deadManNotified: true});
          notified++;
        } catch (e) {
          functions.logger.error(`DMS processing failed for user ${userDoc.id}`, e);
        }
      }
      if (notified > 0) {
        functions.logger.info(`Dead man switch: notified contacts for ${notified} users`);
      }
    } catch (error) {
      functions.logger.error('processDeadManSwitch failed', error);
    }
    return null;
  });


// ─── Missed Calls ───────────────────────────────────────────────────────────
// Server-authoritative missed-call notices. The client no longer writes these,
// so the record is guaranteed even if the caller's tab/app dies mid-ring.

const RING_TIMEOUT_MS = 60 * 1000;

/**
 * Writes the "Missed call" system message for a call that ended unanswered.
 * Claims the work via a transaction on the call doc (`missedLogged`), so the
 * onUpdate trigger and the stale-call sweep can never double-post or
 * double-increment unread counts.
 */
async function postMissedCallNotice(chatId, callId, call) {
  const callRef = db.doc(`chats/${chatId}/calls/${callId}`);
  const messageId = `missed_${callId}`;
  const msgRef = db.doc(`chats/${chatId}/messages/${messageId}`);

  // Claim the work. Also bail if a client already wrote the notice (same
  // deterministic id), so the client fallback and this function never both post.
  const claimed = await db.runTransaction(async tx => {
    const snap = await tx.get(callRef);
    if (!snap.exists) return false;
    if (snap.data().missedLogged) return false;
    const existing = await tx.get(msgRef);
    if (existing.exists) {
      tx.update(callRef, {missedLogged: true});
      return false;
    }
    tx.update(callRef, {missedLogged: true});
    return true;
  });
  if (!claimed) return false;

  const chatRef = db.doc(`chats/${chatId}`);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) return false;
  const chat = chatSnap.data();

  const callerId = call.createdBy;
  const callerSnap = await db.doc(`users/${callerId}`).get();
  const caller = callerSnap.exists ? callerSnap.data() : null;
  const type = call.type === 'video' ? 'video' : 'voice';
  // English fallback text; clients localize from the `call` field.
  const text = type === 'video' ? 'Missed video call' : 'Missed voice call';

  await msgRef.set({
    _id: messageId,
    text,
    createdAt: FieldValue.serverTimestamp(),
    user: {
      _id: callerId,
      name: caller?.displayName || caller?.email || 'User',
    },
    system: true,
    call: {type, outcome: 'missed'},
  });

  const unreadCountBy = {...(chat.unreadCountBy || {})};
  (chat.participants || []).forEach(uid => {
    unreadCountBy[uid] = uid === callerId ? 0 : (unreadCountBy[uid] || 0) + 1;
  });
  await chatRef.set(
    {
      lastMessage: {text, createdAt: FieldValue.serverTimestamp()},
      updatedAt: FieldValue.serverTimestamp(),
      unreadCountBy,
    },
    {merge: true},
  );
  return true;
}

/** Fires when a call doc transitions to `ended`; logs it if never answered. */
exports.onCallEnded = functions.firestore
  .document('chats/{chatId}/calls/{callId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();
      if (!before || !after) return null;
      if (before.status === 'ended' || after.status !== 'ended') return null;
      // `answer` is only set when the recipient accepts — its absence means the
      // call was never picked up.
      if (after.answer) return null;
      const {chatId, callId} = context.params;
      await postMissedCallNotice(chatId, callId, after);
    } catch (error) {
      functions.logger.error('onCallEnded failed', error);
    }
    return null;
  });

/**
 * Safety net: ends calls left ringing (e.g. the caller's tab closed mid-ring),
 * which in turn triggers onCallEnded to post the notice.
 */
exports.sweepStaleCalls = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    try {
      const cutoff = Timestamp.fromMillis(Date.now() - RING_TIMEOUT_MS);
      const snap = await db
        .collectionGroup('calls')
        .where('status', '==', 'ringing')
        .where('createdAt', '<=', cutoff)
        .limit(50)
        .get();
      if (snap.empty) return null;

      let ended = 0;
      for (const callDoc of snap.docs) {
        try {
          const chatRef = callDoc.ref.parent.parent;
          if (!chatRef) continue;
          await callDoc.ref.set(
            {
              status: 'ended',
              endedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            {merge: true},
          );
          ended++;
        } catch (e) {
          functions.logger.error('Failed to end stale call', e);
        }
      }
      if (ended > 0) functions.logger.info(`Ended ${ended} stale ringing call(s)`);
    } catch (error) {
      functions.logger.error('sweepStaleCalls failed', error);
    }
    return null;
  });

// ─── Live Location Expiry ───────────────────────────────────────────────────
// Storage/cost hygiene only, not a privacy guarantee: the client already
// gates on expiresAt at read time (see liveLocation.js's listenLiveLocation
// on both platforms), so a few minutes of sweep lag never surfaces stale
// location to anyone — this just stops finished shares from lingering.
exports.sweepExpiredLiveLocations = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    try {
      const now = Date.now();
      const snap = await db
        .collectionGroup('liveLocations')
        .where('expiresAt', '<=', now)
        .limit(200)
        .get();
      if (snap.empty) return null;

      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      functions.logger.info(`Deleted ${snap.size} expired live location share(s)`);
    } catch (error) {
      functions.logger.error('sweepExpiredLiveLocations failed', error);
    }
    return null;
  });

// ─── Chatterbox Pro: Stripe subscriptions ───────────────────────────────────
// Purchase happens on the web client only. Apple and Google require their own
// in-app purchase for digital goods sold inside a mobile app, so the mobile
// client reads the resulting entitlement but never sells it.

/** Resolves the Stripe customer for a uid, creating one on first checkout. */
async function getOrCreateStripeCustomer(stripe, uid, email) {
  const entRef = db.doc(`entitlements/${uid}`);
  const existing = await entRef.get();
  const existingId = existing.exists ? existing.data().stripeCustomerId : null;
  if (existingId) return existingId;

  // `metadata.uid` is the only link from a Stripe object back to a Chatterbox
  // account — the webhook relies on it to know whose entitlement to write.
  const customer = await stripe.customers.create({email: email || undefined, metadata: {uid}});
  await entRef.set({stripeCustomerId: customer.id, updatedAt: Date.now()}, {merge: true});
  return customer.id;
}

exports.createCheckoutSession = callable().onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!STRIPE_SECRET_KEY) {
    throw new functions.https.HttpsError('failed-precondition', 'Billing is not configured.');
  }
  await checkRateLimit(context.auth.uid, 'createCheckoutSession', {maxCalls: 5, windowMs: 60000});

  // The plan is chosen from a server-side allowlist, never taken as a raw
  // price id from the client — otherwise a caller could substitute any price
  // in the account (including a $0 one) and self-provision a subscription.
  const plan = data?.plan === 'yearly' ? 'yearly' : 'monthly';
  const priceId = plan === 'yearly' ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY;
  if (!priceId) {
    throw new functions.https.HttpsError('failed-precondition', `No price configured for ${plan}.`);
  }

  const returnUrl = typeof data?.returnUrl === 'string' ? data.returnUrl : APP_BASE_URL;
  if (!isAllowedReturnUrl(returnUrl)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid return URL.');
  }

  try {
    const stripe = getStripe();
    const customerId = await getOrCreateStripeCustomer(stripe, context.auth.uid, context.auth.token?.email);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // `payment_method_types` is deliberately absent: omitting it enables
      // dynamic payment methods, so Apple Pay / Google Pay / Link and
      // regional options are controlled from the Dashboard. Hardcoding it
      // would lock the flow to cards and cost conversion.
      line_items: [{price: priceId, quantity: 1}],
      integration_identifier: STRIPE_INTEGRATION_ID,
      success_url: `${returnUrl}?pro=success`,
      cancel_url: `${returnUrl}?pro=canceled`,
      // Duplicated onto the subscription so subscription.* events (which do
      // not carry the checkout session) can still resolve the uid.
      metadata: {uid: context.auth.uid},
      subscription_data: {metadata: {uid: context.auth.uid}},
    });
    return {url: session.url};
  } catch (error) {
    functions.logger.error('createCheckoutSession failed', {
      message: error?.message,
      type: error?.type,
      code: error?.code,
    });
    throw new functions.https.HttpsError('internal', 'Could not start checkout.');
  }
});

exports.createBillingPortalSession = callable().onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!STRIPE_SECRET_KEY) {
    throw new functions.https.HttpsError('failed-precondition', 'Billing is not configured.');
  }
  await checkRateLimit(context.auth.uid, 'createBillingPortalSession', {maxCalls: 5, windowMs: 60000});

  const snap = await db.doc(`entitlements/${context.auth.uid}`).get();
  const customerId = snap.exists ? snap.data().stripeCustomerId : null;
  if (!customerId) {
    throw new functions.https.HttpsError('failed-precondition', 'No subscription to manage.');
  }

  const returnUrl = typeof data?.returnUrl === 'string' ? data.returnUrl : APP_BASE_URL;
  if (!isAllowedReturnUrl(returnUrl)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid return URL.');
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return {url: session.url};
  } catch (error) {
    functions.logger.error('createBillingPortalSession failed', {
      message: error?.message,
      type: error?.type,
      code: error?.code,
    });
    throw new functions.https.HttpsError('internal', 'Could not open the billing portal.');
  }
});

/**
 * Writes the entitlement for whichever account a Stripe subscription belongs
 * to. `uid` comes from subscription metadata (set at checkout); if that is
 * missing the customer record is consulted as a fallback.
 */
async function applySubscriptionToEntitlement(stripe, subscription, eventCreatedMs) {
  let uid = subscription.metadata?.uid;
  if (!uid) {
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId);
      uid = customer?.metadata?.uid;
    }
  }
  if (!uid) {
    functions.logger.error('Stripe subscription has no resolvable uid', {
      subscriptionId: subscription.id,
    });
    return;
  }

  const ref = db.doc(`entitlements/${uid}`);
  const existing = await ref.get();
  if (!shouldApplyEvent(existing.exists ? existing.data() : null, eventCreatedMs)) {
    functions.logger.info('Ignoring out-of-order Stripe event', {
      uid,
      subscriptionId: subscription.id,
    });
    return;
  }

  await ref.set(
    {
      ...entitlementFromSubscription(subscription),
      lastEventAt: eventCreatedMs,
      updatedAt: Date.now(),
    },
    {merge: true},
  );
}

/**
 * Stripe webhook. Every request is signature-verified against the raw body
 * before anything is trusted — without that check, anyone who learns this
 * URL could POST a forged "subscription active" event and grant themselves
 * Pro, which would defeat the entire paywall.
 *
 * Note this reads `req.rawBody` (Firebase provides it) rather than `req.body`:
 * Stripe's signature covers the exact bytes sent, so a re-serialized parsed
 * body will not verify.
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    functions.logger.error('stripeWebhook called but billing env vars are missing');
    res.status(500).send('Billing not configured');
    return;
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.rawBody,
      req.headers['stripe-signature'],
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    // Includes replayed/expired signatures, not just forgeries.
    functions.logger.warn('Rejected Stripe webhook with bad signature', {message: error?.message});
    res.status(400).send('Invalid signature');
    return;
  }

  const eventCreatedMs = (event.created || 0) * 1000;
  try {
    const stripe = getStripe();
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          // Checkout sessions carry the uid even when the subscription's own
          // metadata hasn't propagated yet.
          if (!subscription.metadata?.uid && session.metadata?.uid) {
            subscription.metadata = {...subscription.metadata, uid: session.metadata.uid};
          }
          await applySubscriptionToEntitlement(stripe, subscription, eventCreatedMs);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscriptionToEntitlement(stripe, event.data.object, eventCreatedMs);
        break;
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        // The invoice itself carries no period/status we can trust for
        // entitlement; re-read the subscription as the source of truth.
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          await applySubscriptionToEntitlement(stripe, subscription, eventCreatedMs);
        }
        break;
      }
      default:
        break; // Unhandled event types are acknowledged, not retried.
    }
    res.json({received: true});
  } catch (error) {
    functions.logger.error('stripeWebhook handler failed', {
      eventType: event?.type,
      message: error?.message,
    });
    // 500 asks Stripe to retry — correct for a transient failure on our side.
    res.status(500).send('Webhook handler failed');
  }
});

// Strip scheduled functions from exports unless explicitly enabled — see the
// SCHEDULED_ENABLED note near the top. firebase-tools inspects module.exports
// after this file finishes loading, so deleting keys here hides them from deploy
// (and stops the CLI from trying to enable Cloud Scheduler / billing).
if (!SCHEDULED_ENABLED) {
  for (const name of SCHEDULED_FUNCTIONS) {
    delete exports[name];
  }
}
