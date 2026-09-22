/**
 * Device key management for the E2EE prototype — web client.
 *
 * Ports the mobile app's src/services/e2eeKeys.ts to the browser. The Firestore
 * schema is identical and shared: `users/{uid}/publicKeys/e2ee` holds one
 * X25519 public key per *account*, not per device.
 *
 * That sounds like it should make the browser "a new device" that displaces
 * the phone, and the doc here used to say so — that switching between them
 * would surface a `changed` warning to every contact. It does not, because
 * the key is not incidental to the account: both clients derive it from the
 * recovery phrase at sign-in (adoptSeedAsDeviceKey, called from auth.ts here
 * and from AuthContext on mobile), so the phone and the browser publish the
 * same key and neither strands the other.
 *
 * What the browser genuinely cannot do is read forward-secret messages — it
 * has no ratchet. That is a gap in what it can *read*, not a claim on the
 * account, which is why publishPublicKey leaves the phone's ratchet bundle
 * alone. See MULTIDEVICE.md.
 *
 * Storage differs from mobile in one deliberate way: everything here is keyed
 * by the *local* account id (`myUserId`), not just the peer id. Unlike the
 * mobile app, this browser can be signed into different Chatterbox accounts
 * across sessions (see drafts.ts, which namespaces the same way for the same
 * reason) — without that namespacing, account B could silently inherit
 * account A's cached trust history for a shared contact from earlier in the
 * same browser, masking a genuine key substitution that happened in between.
 */
import {doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import {x25519} from '@noble/curves/ed25519.js';
import {db} from '../firebase';
import {bytesToBase64, base64ToBytes, bytesToHex, hexToBytes} from './crypto';
import {type Keypair} from './e2ee';
import {isValidMnemonic, mnemonicToSecretKey, secretKeyToMnemonic} from './e2eeMnemonic';

const SECRET_KEY_PREFIX = 'e2ee_secret_key_v1';
const PEER_KEY_PREFIX = 'e2ee_peer_key_v1';
const RECOVERY_REVEALED_PREFIX = 'e2ee_recovery_revealed_v1';

/**
 * A message could not be sealed, so it was not sent.
 *
 * Thrown rather than resolved-with-plaintext: every failure that reaches this
 * point is transient (a failed key lookup, an unreachable server), and the
 * caller retrying is the correct outcome. Sending in clear instead would
 * produce a message indistinguishable from an encrypted one in the UI, which
 * is the failure mode this whole distinction exists to prevent.
 *
 * Carries a `code` so callers can identify it without matching on message
 * text — same convention as RecipientUnreachableError in services/recipient.
 */
export class EncryptionUnavailableError extends Error {
  readonly code = 'e2ee-unavailable';
  constructor(message = 'could not seal this message; not sending it in clear') {
    super(message);
    this.name = 'EncryptionUnavailableError';
  }
}

export function isEncryptionUnavailable(error: unknown): boolean {
  return (error as {code?: string})?.code === 'e2ee-unavailable';
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode / disabled / quota). The key survives in
    // the in-memory cache for the life of the tab and not past a reload, at
    // which point sending fails closed and asks for the phrase again — it used
    // to say "getOrCreateDeviceKeypair will mint a new one", which is how a
    // blocked localStorage came to replace the account's key with a random one.
  }
}

const cached = new Map<string, Keypair>();

// Bumped whenever the key this tab is decrypting with changes identity, so
// views that cache per-message decrypt results (keyed by message id, not by
// which key decrypted them) know to discard that cache and retry — otherwise
// a message that failed under the previous key stays stuck showing that
// failure forever. Mirrors mobile's src/services/e2eeKeys.ts.
//
// Mobile bumps this on recovery-phrase restore, which the web client doesn't
// offer; here the trigger is switching accounts within one tab, since a
// browser (unlike the app) routinely signs into more than one account.
let keyGeneration = 0;
let activeKeyUserId: string | null = null;

export function getKeyGeneration(): number {
  return keyGeneration;
}

function markActiveKey(userId: string): void {
  if (activeKeyUserId === userId) return;
  activeKeyUserId = userId;
  keyGeneration += 1;
}

/**
 * Returns this browser's keypair for `userId`, or throws.
 *
 * It used to mint a random one here and publish it. That was right when a
 * device key was incidental to the account, and is wrong now: every account
 * reaches this client through a recovery phrase (createAccount and
 * signInWithPhrase in services/auth.ts, both via adoptSeedAsDeviceKey), so the
 * key is *derived* — and a random one is a key the phrase cannot reproduce.
 * Publishing it replaced the account's real key with one only this tab held,
 * so peers encrypted to it, the phone could not read any of that, and the
 * phone's next sign-in republished the derived key and orphaned it in the
 * other direction.
 *
 * Reachable because localStorage can fail while the Firebase session
 * survives — private mode, blocked site data, a full quota — which is exactly
 * when writeLocal's own comment used to promise that "getOrCreateDeviceKeypair
 * will mint a new one".
 *
 * So it fails closed. Every caller is a *send* path and already handles this
 * error by surfacing it and keeping the message (ChatPane restores the
 * composer), which is the correct outcome: the send is delayed rather than
 * encrypted to a key that strands it. Signing in again is the repair, and it
 * works because the same phrase always reaches the same key.
 */
export async function getOrCreateDeviceKeypair(userId: string): Promise<Keypair> {
  const hit = cached.get(userId);
  if (hit) {
    markActiveKey(userId);
    return hit;
  }

  const storedHex = readLocal(`${SECRET_KEY_PREFIX}:${userId}`);
  if (storedHex) {
    const secretKey = hexToBytes(storedHex);
    const keypair = keypairFromSecret(secretKey);
    cached.set(userId, keypair);
    markActiveKey(userId);
    return keypair;
  }

  throw new EncryptionUnavailableError(
    'this browser is not holding the account key; sign in with your phrase again',
  );
}

/**
 * This browser's keypair if it already has one, or null — never mints one.
 *
 * For *readers*. getOrCreateDeviceKeypair publishes on first call, so calling
 * it merely to decrypt turns opening a chat into an enrollment: a browser with
 * no local key mints one and overwrites the account's published key within
 * milliseconds of the view mounting, stranding every message sealed to the
 * real key and permanently invalidating the recovery phrase the user wrote
 * down. That is the disaster enrollmentReadiness exists to prevent, performed
 * by the code that was trying to read the messages it just orphaned.
 *
 * Returning null is the correct outcome for a reader: it has no key, so it
 * cannot decrypt, and inventing one would not have helped it decrypt anything
 * either — the new key opens nothing that was sealed to the old one. Callers
 * render the undecryptable state instead.
 *
 * Mirrors mobile's src/services/e2eeKeys.ts, which grew the same split for
 * the same reason.
 */
export async function getDeviceKeypairIfEnrolled(userId: string): Promise<Keypair | null> {
  const hit = cached.get(userId);
  if (hit) {
    markActiveKey(userId);
    return hit;
  }

  const storedHex = readLocal(`${SECRET_KEY_PREFIX}:${userId}`);
  if (!storedHex) return null;

  const keypair = keypairFromSecret(hexToBytes(storedHex));
  cached.set(userId, keypair);
  markActiveKey(userId);
  return keypair;
}

/**
 * Installs `seed` as this browser's key for `userId`, because for this account
 * the seed *is* the account (services/anonymousIdentity.ts).
 *
 * Twin of the mobile client's adoptSeedAsDeviceKey — see that one for the full
 * reasoning. The short version: getOrCreateDeviceKeypair's contract is
 * "whatever key is already here, or a new random one", which is right when the
 * key is incidental to the account and wrong when it is derived from the same
 * phrase that opened it. This one overwrites and republishes unconditionally,
 * and throws if it cannot publish, so a sign-in never succeeds while leaving
 * an account nobody can encrypt to. Retrying is the recovery, and retrying
 * works because the same phrase always reaches the same account.
 */
export async function adoptSeedAsDeviceKey(userId: string, seed: Uint8Array): Promise<void> {
  const keypair = keypairFromSecret(seed);
  writeLocal(`${SECRET_KEY_PREFIX}:${userId}`, bytesToHex(seed));
  cached.set(userId, keypair);
  markActiveKey(userId);
  await publishPublicKey(userId, keypair.publicKey);
}

/**
 * Republishes this browser's key if the account is advertising none.
 *
 * Repairs the one hole adoptSeedAsDeviceKey leaves — a local write that
 * succeeded followed by a publish that did not — and cannot do anything else:
 * it never mints, and it never writes over a key some other device published,
 * because that is the superseded case and belongs to the user. Failures are
 * swallowed; nothing is waiting on this.
 */
export async function republishKeyIfAccountHasNone(userId: string): Promise<void> {
  try {
    const local = await getDeviceKeypairIfEnrolled(userId);
    if (!local) return;
    if (await fetchPublishedKeyOrThrow(userId)) return;
    await publishPublicKey(userId, local.publicKey);
  } catch (error) {
    console.warn('e2ee republish missing key failed:', error);
  }
}

function keypairFromSecret(secretKey: Uint8Array): Keypair {
  // Recomputing the public half is cheap and avoids storing it twice, so the
  // secret key remains the single source of truth.
  return {secretKey, publicKey: x25519.getPublicKey(secretKey)};
}

/** Sealed attachment bytes. The same string the mobile client publishes. */
export const MEDIA_CAPABILITY = 'media-v1';

/**
 * What this client can actually honour, published so senders know.
 *
 * `media-v1` is claimed because it is true: resolveSealedMedia decrypts sealed
 * attachment bytes (services/mediaVault.ts) and every upload from here seals
 * them (services/storage.ts). This used to publish `[]`, on the reasoning that
 * an unhonoured capability claim is worse than none — which was right about
 * the principle and wrong about the fact, and the cost was not a broken image:
 * `peersSupportEncryptedMedia` on the phone reads this list, so clearing it
 * stopped every sender encrypting attachment bytes to this account at all.
 * Photos then went to Cloud Storage in the clear, for an account whose owner
 * had done nothing but open a browser tab.
 */
const CAPABILITIES = [MEDIA_CAPABILITY];

export async function publishPublicKey(userId: string, publicKey: Uint8Array): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', userId, 'publicKeys', 'e2ee'),
      {
        publicKey: bytesToBase64(publicKey),
        caps: CAPABILITIES,
        updatedAt: serverTimestamp(),
      },
      {merge: true},
    );
    /*
     * The ratchet bundle is deliberately left alone.
     *
     * This used to retract it — delete the identity and every one-time prekey
     * the phone published — on the reasoning that a bundle this client cannot
     * open is a false claim about the account. The premise does not hold: both
     * clients derive their key from the recovery phrase (adoptSeedAsDeviceKey,
     * called from sign-in on both), so the browser is not replacing the phone
     * and has no standing to retract what the phone published.
     *
     * The cost of the old behaviour was total and silent: opening a browser
     * tab took the whole account off forward secrecy, every peer fell back to
     * the long-lived key, and the phone only took it back at its next sign-in.
     * Leaving the bundle standing means the browser cannot read forward-secret
     * messages — which is already true, already labelled in the thread, and
     * written down in MULTIDEVICE.md.
     */
  } catch (error) {
    console.warn('e2ee publish public key failed:', error);
    throw error;
  }
}

/**
 * Fetches a peer's published public key, or null if they haven't enrolled yet
 * (in which case the caller must fall back to sending plaintext).
 *
 * NOTE: the server hands this key out, so a hostile server could substitute
 * its own and read everything. Out-of-band verification is required before
 * this can be called secure — see the caveats in e2ee.ts. `fetchPeerPublicKeyChecked`
 * below at least surfaces the moment a substitution *could* have happened.
 */
export async function fetchPeerPublicKey(peerUserId: string): Promise<Uint8Array | null> {
  try {
    return await fetchPublishedKeyOrThrow(peerUserId);
  } catch (error) {
    // A permission error here is expected until rules allow it; treat it as
    // "peer not enrolled" so messaging degrades to plaintext rather than
    // breaking entirely.
    console.warn('e2ee fetch peer public key failed:', error);
    return null;
  }
}

/**
 * The same read without the "treat any failure as unenrolled" fallback.
 *
 * That fallback is right for messaging (degrade to plaintext rather than
 * break) but wrong anywhere the *absence* of a key is itself a decision — a
 * network blip would be silently read as "this account has no key", which is
 * exactly the condition callers like restoreDeviceKeypairFromPhrase use to
 * waive their safety checks. Callers that can't tolerate that ambiguity use
 * this and handle the error explicitly.
 */
async function fetchPublishedKeyOrThrow(userId: string): Promise<Uint8Array | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'publicKeys', 'e2ee'));
  const key = snap.exists() ? (snap.data()?.publicKey as string | undefined) : undefined;
  return key ? base64ToBytes(key) : null;
}

export type EnrollmentReadiness =
  /** This browser already holds this account's key, or no key exists anywhere. */
  | 'safe'
  /** The account has a key published elsewhere that this browser doesn't hold. */
  | 'needs-restore'
  /**
   * This browser holds a key, but it is no longer the one the account
   * publishes — another device replaced it. Nothing here is missing, which is
   * why it went unreported: the browser looks enrolled, sends fine, and
   * silently fails to open anything addressed to the new key.
   */
  | 'superseded'
  /** Couldn't find out — treat as "don't touch anything yet". */
  | 'unknown';

/**
 * Whether it's safe to let an *automatic* trigger enroll this browser.
 *
 * A plain getOrCreateDeviceKeypair call mints and publishes a new keypair
 * whenever this browser has no local key. If the account already published one
 * from a phone or another browser, that silently overwrites it and permanently
 * strands any history still recoverable from the saved recovery phrase — and
 * it would happen within milliseconds of sign-in, long before the user could
 * reach the restore UI.
 *
 * `unknown` is deliberately not folded into `safe`: that's how a network blip
 * would turn into an overwrite. Holding off costs nothing — the browser simply
 * stays unenrolled, messaging degrades to plaintext exactly as it does before
 * first enrollment, and the next sign-in tries again.
 */
export async function enrollmentReadiness(userId: string): Promise<EnrollmentReadiness> {
  // Holding *a* key used to be enough to answer 'safe', without ever asking
  // which key the account publishes — so the one state worth warning about
  // was the one state this could not report. See the mobile twin.
  const local = await getDeviceKeypairIfEnrolled(userId);

  let publishedKey: Uint8Array | null;
  try {
    publishedKey = await fetchPublishedKeyOrThrow(userId);
  } catch (error) {
    console.warn('e2ee enrollment readiness failed:', error);
    // An enrolled browser keeps its old answer offline: 'unknown' exists to
    // stop a browser with *no* key guessing its way into an overwrite, and
    // one that already holds a key has nothing to overwrite.
    return local ? 'safe' : 'unknown';
  }

  if (!publishedKey) return 'safe';
  if (!local) return 'needs-restore';
  return bytesToBase64(local.publicKey) === bytesToBase64(publishedKey) ? 'safe' : 'superseded';
}

function peerKeyCacheKey(myUserId: string, peerUserId: string): string {
  return `${PEER_KEY_PREFIX}:${myUserId}:${peerUserId}`;
}

export type PeerKeyStatus =
  /**
   * Peer hasn't published a key — caller falls back to plaintext.
   *
   * This is a *positive* answer from the server, not an absence of one. Only
   * this status licenses sending in clear; see 'unavailable'.
   */
  | 'unenrolled'
  /** First time this account has ever seen a key for this peer. */
  | 'first-contact'
  | 'unchanged'
  /** The key differs from what this account saw last time — see below. */
  | 'changed'
  /**
   * Couldn't reach the server, so whether this peer has a key is unknown.
   *
   * Distinct from 'unenrolled' because conflating the two is a plaintext leak.
   * This used to come back as 'unenrolled', which callers read as "no key,
   * send in clear" — so any network or permission failure silently disabled
   * encryption for that message, and a sustained one (a captive portal, a
   * blocked region) disabled it for every message, with nothing shown to the
   * user. Callers must treat this as "try again later", never as "send it
   * unsealed". Matches the mobile client's status of the same name.
   */
  | 'unavailable';

/**
 * Fetches a peer's public key and compares it against what `myUserId` saw
 * last time, so a substituted key (compromised server, or the peer genuinely
 * switching devices) doesn't pass silently.
 *
 * This is trust-on-first-use, not verification: `first-contact` is not
 * flagged, because every key is unseen once and treating that as suspicious
 * would just train users to dismiss the real warning. Only a key that
 * *changes after being trusted* is reported as `changed` — that transition is
 * exactly what a substitution attack, or a legitimate device change, looks
 * like from the outside; this cannot tell the two apart, which is why
 * `computeSafetyNumber` (out-of-band verification) still exists.
 */
export async function fetchPeerPublicKeyChecked(
  myUserId: string,
  peerUserId: string,
): Promise<{key: Uint8Array | null; status: PeerKeyStatus}> {
  // Deliberately the throwing read, not fetchPeerPublicKey. That one maps every
  // failure onto null, which is indistinguishable from "this peer has no key" —
  // and the caller acts on that difference by sending in clear.
  let key: Uint8Array | null;
  try {
    key = await fetchPublishedKeyOrThrow(peerUserId);
  } catch (error) {
    console.warn('e2ee fetch peer public key failed:', error);
    return {key: null, status: 'unavailable'};
  }
  if (!key) return {key: null, status: 'unenrolled'};

  const keyBase64 = bytesToBase64(key);
  const cacheKey = peerKeyCacheKey(myUserId, peerUserId);
  const cachedKey = readLocal(cacheKey);

  if (!cachedKey) {
    writeLocal(cacheKey, keyBase64);
    return {key, status: 'first-contact'};
  }
  if (cachedKey === keyBase64) {
    return {key, status: 'unchanged'};
  }
  writeLocal(cacheKey, keyBase64);
  return {key, status: 'changed'};
}

/**
 * The device secret key, encoded as a 24-word recovery phrase the user can
 * write down and later type back in via restoreDeviceKeypairFromPhrase to
 * regain decryption in a fresh browser profile. Generates the keypair first if
 * this browser doesn't have one yet.
 *
 * This matters more on web than on mobile: clearing site data is a routine,
 * one-click action that a browser will also do on its own under storage
 * pressure or in private mode. Without a phrase written down, that silently and
 * permanently destroys every encrypted message this account can read — the
 * secret key exists nowhere else, by design.
 */
export async function getRecoveryPhrase(userId: string): Promise<string> {
  const {secretKey} = await getOrCreateDeviceKeypair(userId);
  return secretKeyToMnemonic(secretKey);
}

/**
 * Whether this browser has ever shown the user their recovery phrase. The
 * reveal UI is offered once — after that this flips permanently true, the same
 * "shown once, then never again" pattern as a cloud provider's secret access
 * key. The phrase itself keeps living in localStorage either way; this flag
 * only gates whether the app volunteers to display it again.
 */
export function hasRevealedRecoveryPhrase(userId: string): boolean {
  return readLocal(`${RECOVERY_REVEALED_PREFIX}:${userId}`) === '1';
}

export function markRecoveryPhraseRevealed(userId: string): void {
  writeLocal(`${RECOVERY_REVEALED_PREFIX}:${userId}`, '1');
}

export type RestoreKeypairResult =
  | {success: true}
  | {
      success: false;
      reason:
        | 'invalid-phrase'
        | 'key-mismatch'
        /** Couldn't reach the server to check the phrase, so nothing changed. */
        | 'verification-unavailable'
        /** Phrase was right, but publishing it failed; nothing changed. */
        | 'publish-failed';
    };

/**
 * Imports a previously-revealed recovery phrase as this browser's keypair, so
 * it can decrypt history that was sealed to that key.
 *
 * The derived public key must match what's currently published for this
 * account before it's accepted — otherwise a mistyped or stale phrase would
 * silently install the wrong key and strand this browser exactly the way it was
 * trying to un-strand itself. `unenrolled` (nothing published yet) is accepted
 * too, so restoring still works for an account that never finished enrolling.
 *
 * All-or-nothing: the new key is published *before* any local state changes, so
 * a failure at any step leaves this browser exactly as it was rather than
 * switching it to a key whose public half never made it out — which would
 * strand it silently, with nothing to retry (getOrCreateDeviceKeypair only
 * publishes on first generation, never for an already-stored key).
 */
export async function restoreDeviceKeypairFromPhrase(
  userId: string,
  phrase: string,
): Promise<RestoreKeypairResult> {
  if (!isValidMnemonic(phrase)) {
    return {success: false, reason: 'invalid-phrase'};
  }

  const secretKey = mnemonicToSecretKey(phrase);
  const publicKey = x25519.getPublicKey(secretKey);

  let publishedKey: Uint8Array | null;
  try {
    publishedKey = await fetchPublishedKeyOrThrow(userId);
  } catch (error) {
    // Deliberately not treated as "unenrolled": that would waive the mismatch
    // check below and let a wrong phrase through on a bad connection, which is
    // the precise failure this check exists to stop.
    console.warn('e2ee restore verification failed:', error);
    return {success: false, reason: 'verification-unavailable'};
  }

  if (publishedKey && bytesToBase64(publishedKey) !== bytesToBase64(publicKey)) {
    return {success: false, reason: 'key-mismatch'};
  }

  try {
    await publishPublicKey(userId, publicKey);
  } catch {
    // Already logged by publishPublicKey. No local state has been touched yet,
    // so the browser keeps working with its existing key and the user can retry.
    return {success: false, reason: 'publish-failed'};
  }

  writeLocal(`${SECRET_KEY_PREFIX}:${userId}`, bytesToHex(secretKey));
  cached.set(userId, {secretKey, publicKey});
  // Bumped explicitly rather than via markActiveKey: a restore replaces the key
  // for the account that is *already* active, so markActiveKey would see no
  // change of user and skip the bump — leaving views still showing decrypt
  // failures from the old key, which is the whole reason this counter exists.
  activeKeyUserId = userId;
  keyGeneration += 1;
  return {success: true};
}

/** Test seam — drops the in-memory keypair cache. */
export function _resetKeypairCache(): void {
  cached.clear();
  activeKeyUserId = null;
}
