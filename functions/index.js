const functions = require('firebase-functions');
const admin = require('firebase-admin');
const dns = require('dns');
const https = require('https');
const http = require('http');
const {isPrivateOrReservedIp} = require('./ssrfGuard');

admin.initializeApp();

const db = admin.firestore();

// Scheduled (Cloud Scheduler / pubsub) functions require the Blaze plan. When
// billing is closed they block *every* deploy (the CLI enables required APIs
// codebase-wide). We define them normally but strip them from `exports` at the
// bottom of this file unless CHATTERBOX_ENABLE_SCHEDULED=true, so the rest of
// the functions can still deploy. To ship the scheduled ones once billing is on:
//   CHATTERBOX_ENABLE_SCHEDULED=true npx firebase deploy --only functions
const SCHEDULED_ENABLED = process.env.CHATTERBOX_ENABLE_SCHEDULED === 'true';
const SCHEDULED_FUNCTIONS = [
  'processScheduledMessages',
  'processReminders',
  'processExpiredMessages',
  'processDeadManSwitch',
  'sweepStaleCalls',
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
    tx.update(ref, {count: admin.firestore.FieldValue.increment(1)});
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
exports.claimSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  
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
      sessionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      sessionClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
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
exports.sessionHeartbeat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  
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
      sessionHeartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
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
          const msgRef = chatRef.collection('messages').doc(schedDoc.id);
          const {scheduledFor: _sf, sent: _s, ...messageData} = data;
          await msgRef.set({
            ...messageData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          const chatSnap = await chatRef.get();
          const chat = chatSnap.data();
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
              lastMessage: {text: data.text || '', createdAt: admin.firestore.FieldValue.serverTimestamp()},
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
exports.transcribeVoiceMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  await checkRateLimit(context.auth.uid, 'transcribeVoiceMessage', {maxCalls: 10, windowMs: 60000});
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
  if (!msg.audio) {
    throw new functions.https.HttpsError('invalid-argument', 'Message has no audio.');
  }
  if (msg.transcription) {
    return {transcription: msg.transcription};
  }
  // Placeholder: In production, call Google Speech-to-Text API here.
  const transcription = '[Transcription service not configured — set up Google Speech-to-Text API key]';
  await msgRef.update({transcription});
  return {transcription};
});

// ─── Feature 5: AI Chat Summary ─────────────────────────────────────────────
exports.summarizeChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  await checkRateLimit(context.auth.uid, 'summarizeChat', {maxCalls: 5, windowMs: 60000});
  const {chatId, messageCount} = data || {};
  if (!chatId) {
    throw new functions.https.HttpsError('invalid-argument', 'chatId required.');
  }
  await verifyChatParticipant(chatId, context.auth.uid);
  const limit = Math.min(messageCount || 50, 100);
  const msgsSnap = await db
    .collection(`chats/${chatId}/messages`)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  if (msgsSnap.empty) {
    return {summary: 'No messages to summarize.'};
  }
  const messages = msgsSnap.docs.reverse().map(d => {
    const m = d.data();
    return `${m.user?.name || 'User'}: ${m.text || '[media]'}`;
  });
  // Placeholder: In production, call OpenAI/Gemini API with the messages array.
  // For now, generate a basic extractive summary.
  const uniqueUsers = [...new Set(msgsSnap.docs.map(d => d.data().user?.name || 'User'))];
  const topics = messages
    .filter(m => m.length > 20)
    .slice(-5)
    .map(m => m.substring(0, 80));
  const summary = [
    `Chat between ${uniqueUsers.join(', ')} — ${msgsSnap.size} messages.`,
    topics.length ? `Recent topics: ${topics.join(' | ')}` : '',
    '[For AI-powered summaries, configure an LLM API key in Cloud Functions config]',
  ].filter(Boolean).join('\n');
  return {summary};
});

// ─── Feature 8: Message Translation ──────────────────────────────────────────
exports.translateMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  await checkRateLimit(context.auth.uid, 'translateMessage', {maxCalls: 20, windowMs: 60000});
  const {chatId, messageId, targetLanguage} = data || {};
  if (!chatId || !messageId || !targetLanguage) {
    throw new functions.https.HttpsError('invalid-argument', 'chatId, messageId, and targetLanguage required.');
  }
  await verifyChatParticipant(chatId, context.auth.uid);
  const msgRef = db.doc(`chats/${chatId}/messages/${messageId}`);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Message not found.');
  }
  const msg = msgSnap.data();
  if (msg.translations?.[targetLanguage]) {
    return {translation: msg.translations[targetLanguage]};
  }
  // Placeholder: In production, call Google Cloud Translate API here.
  // For now, return a note about configuring the API.
  const translation = `[Translation to ${targetLanguage} — configure Google Cloud Translate API]`;
  await msgRef.update({
    [`translations.${targetLanguage}`]: translation,
  });
  return {translation};
});

// ─── Feature 9: Focus Mode Auto-Reply ────────────────────────────────────────
exports.autoReplyFocusMode = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    try {
      const message = snap.data();
      const {chatId} = context.params;
      if (!message?.user?._id || !message.text) return null;
      // Prevent auto-reply loops: skip if message is already an auto-reply
      if (message.text.startsWith('[Auto-Reply]')) return null;
      const senderId = message.user._id;

      const chatSnap = await db.doc(`chats/${chatId}`).get();
      if (!chatSnap.exists) return null;
      const chat = chatSnap.data();
      const recipients = (chat.participants || []).filter(uid => uid !== senderId);

      for (const recipientId of recipients) {
        try {
          const userSnap = await db.doc(`users/${recipientId}`).get();
          if (!userSnap.exists) continue;
          const userData = userSnap.data();
          const focus = userData?.focusMode;
          if (!focus?.enabled) continue;
          if (focus.until && focus.until < Date.now()) {
            await db.doc(`users/${recipientId}`).update({'focusMode.enabled': false});
            continue;
          }
          const autoReply = focus.autoReply || 'I\'m currently in focus mode. I\'ll get back to you later.';
          const replyId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await db.doc(`chats/${chatId}/messages/${replyId}`).set({
            _id: replyId,
            text: `[Auto-Reply] ${autoReply}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            user: {
              _id: recipientId,
              name: userData.displayName || userData.email || 'User',
            },
          });
          await db.doc(`chats/${chatId}`).set({
            lastMessage: {
              text: `[Auto-Reply] ${autoReply}`,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
exports.markViewOnceViewed = functions.https.onCall(async (data, context) => {
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
    viewOnceOpenedAt: admin.firestore.FieldValue.serverTimestamp(),
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
exports.fetchLinkPreview = functions.https.onCall(async (data, context) => {
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
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
      lastMessage: {text, createdAt: admin.firestore.FieldValue.serverTimestamp()},
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - RING_TIMEOUT_MS);
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
              endedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

// Strip scheduled functions from exports unless explicitly enabled — see the
// SCHEDULED_ENABLED note near the top. firebase-tools inspects module.exports
// after this file finishes loading, so deleting keys here hides them from deploy
// (and stops the CLI from trying to enable Cloud Scheduler / billing).
if (!SCHEDULED_ENABLED) {
  for (const name of SCHEDULED_FUNCTIONS) {
    delete exports[name];
  }
}
