/**
 * Device key management for the E2EE prototype — web client.
 *
 * Ports the mobile app's src/services/e2eeKeys.ts to the browser. The Firestore
 * schema is identical and shared: `users/{uid}/publicKeys/e2ee` holds one
 * X25519 public key per *account*, not per device, so signing in on web is
 * exactly "a new device" under the same single-keypair-per-account model
 * mobile already documents (see the module doc in e2ee.ts, limitation #3).
 * That means switching between phone and browser will surface a `changed`
 * warning to your contacts, same as a mobile reinstall would — this is a known,
 * accepted limitation of the prototype, not new breakage.
 *
 * Storage differs from mobile in one deliberate way: everything here is keyed
 * by the *local* account id (`myUserId`), not just the peer id. Unlike the
 * mobile app, this browser can be signed into different Chatterbox accounts
 * across sessions (see drafts.ts, which namespaces the same way for the same
 * reason) — without that namespacing, account B could silently inherit
 * account A's cached trust history for a shared contact from earlier in the
 * same browser, masking a genuine key substitution that happened in between.
 */
import {collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc} from 'firebase/firestore';
import {x25519} from '@noble/curves/ed25519.js';
import {db} from '../firebase';
import {bytesToBase64, base64ToBytes, bytesToHex, hexToBytes} from './crypto';
import {generateKeypair, type Keypair} from './e2ee';
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
    // Storage blocked (private mode / disabled / quota) — the keypair simply
    // won't survive a reload; getOrCreateDeviceKeypair will mint a new one.
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
 * Returns this browser's keypair for `userId`, generating and publishing one
 * on first call. Cached in-memory per account for the life of the tab.
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

  const keypair = generateKeypair();
  writeLocal(`${SECRET_KEY_PREFIX}:${userId}`, bytesToHex(keypair.secretKey));
  cached.set(userId, keypair);
  markActiveKey(userId);
  await publishPublicKey(userId, keypair.publicKey);
  return keypair;
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

function keypairFromSecret(secretKey: Uint8Array): Keypair {
  // Recomputing the public half is cheap and avoids storing it twice, so the
  // secret key remains the single source of truth.
  return {secretKey, publicKey: x25519.getPublicKey(secretKey)};
}

export async function publishPublicKey(userId: string, publicKey: Uint8Array): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', userId, 'publicKeys', 'e2ee'),
      {
        publicKey: bytesToBase64(publicKey),
        // Cleared, not omitted. `merge: true` leaves absent fields alone, so
        // omitting this would let a capability published by the user's phone
        // survive on the document after the web client became the account's
        // active device — and senders would keep encrypting attachment bytes
        // this client cannot decrypt, producing a broken image with no error
        // on either side. Same reasoning as retractRatchetBundle below: an
        // unhonoured capability claim is worse than none.
        caps: [],
        updatedAt: serverTimestamp(),
      },
      {merge: true},
    );
    await retractRatchetBundle(userId);
  } catch (error) {
    console.warn('e2ee publish public key failed:', error);
    throw error;
  }
}

/**
 * Removes any forward-secrecy prekey bundle published by another device.
 *
 * A published bundle is a claim that this *account* can be reached over the
 * ratchet, and senders act on it in preference to the static path. This client
 * does not implement the ratchet, so once it becomes the account's active
 * device that claim is false — and leaving it standing would make every
 * incoming message unreadable here while looking perfectly fine to the sender.
 *
 * The situation is narrow (a user moves from the mobile app to the web client)
 * but the failure is total and silent, which is what makes it worth the write.
 * It is the same single-device assumption the rest of enrollment already makes:
 * publishing an identity means "this device is the one to reach me on".
 *
 * Best-effort — a failure here leaves messaging working over whichever path
 * the sender picks, so it must not block enrolling.
 */
async function retractRatchetBundle(userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'publicKeys', 'ratchet'));
    const stale = await getDocs(collection(db, 'users', userId, 'oneTimePreKeys'));
    await Promise.all(stale.docs.map(d => deleteDoc(d.ref).catch(() => undefined)));
  } catch (error) {
    console.warn('e2ee retract ratchet bundle failed:', error);
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
