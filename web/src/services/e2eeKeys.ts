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
import {doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import {x25519} from '@noble/curves/ed25519.js';
import {db} from '../firebase';
import {bytesToBase64, base64ToBytes, bytesToHex, hexToBytes} from './crypto';
import {generateKeypair, type Keypair} from './e2ee';

const SECRET_KEY_PREFIX = 'e2ee_secret_key_v1';
const PEER_KEY_PREFIX = 'e2ee_peer_key_v1';

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

/**
 * Returns this browser's keypair for `userId`, generating and publishing one
 * on first call. Cached in-memory per account for the life of the tab.
 */
export async function getOrCreateDeviceKeypair(userId: string): Promise<Keypair> {
  const hit = cached.get(userId);
  if (hit) return hit;

  const storedHex = readLocal(`${SECRET_KEY_PREFIX}:${userId}`);
  if (storedHex) {
    const secretKey = hexToBytes(storedHex);
    const keypair = keypairFromSecret(secretKey);
    cached.set(userId, keypair);
    return keypair;
  }

  const keypair = generateKeypair();
  writeLocal(`${SECRET_KEY_PREFIX}:${userId}`, bytesToHex(keypair.secretKey));
  cached.set(userId, keypair);
  await publishPublicKey(userId, keypair.publicKey);
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
      {publicKey: bytesToBase64(publicKey), updatedAt: serverTimestamp()},
      {merge: true},
    );
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
    const snap = await getDoc(doc(db, 'users', peerUserId, 'publicKeys', 'e2ee'));
    const key = snap.exists() ? (snap.data()?.publicKey as string | undefined) : undefined;
    return key ? base64ToBytes(key) : null;
  } catch (error) {
    // A permission error here is expected until rules allow it; treat it as
    // "peer not enrolled" so messaging degrades to plaintext rather than
    // breaking entirely.
    console.warn('e2ee fetch peer public key failed:', error);
    return null;
  }
}

function peerKeyCacheKey(myUserId: string, peerUserId: string): string {
  return `${PEER_KEY_PREFIX}:${myUserId}:${peerUserId}`;
}

export type PeerKeyStatus =
  /** Peer hasn't published a key — caller falls back to plaintext. */
  | 'unenrolled'
  /** First time this account has ever seen a key for this peer. */
  | 'first-contact'
  | 'unchanged'
  /** The key differs from what this account saw last time — see below. */
  | 'changed';

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
  const key = await fetchPeerPublicKey(peerUserId);
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

/** Test seam — drops the in-memory keypair cache. */
export function _resetKeypairCache(): void {
  cached.clear();
}
