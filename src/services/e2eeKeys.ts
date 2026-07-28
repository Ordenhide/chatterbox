/**
 * Device key management for the E2EE prototype.
 *
 * The secret key lives only in the MMKV store (encrypted at rest under a
 * CSPRNG-derived device key — see storageMMKV.ts) and is never sent anywhere.
 * Only the public half is published, to a dedicated publicKeys subcollection,
 * which the Firestore rules already restrict to `request.auth.uid == userId`
 * for writes while allowing participants to read what they need.
 *
 * Prototype limitation: one keypair per device with no sync, so installing on
 * a second device republishes a new public key and strands messages encrypted
 * to the first. Multi-device needs a per-device key list; see e2ee.ts.
 */
import {doc, getDoc, getFirestore, serverTimestamp, setDoc} from '@react-native-firebase/firestore';
import {x25519} from '@noble/curves/ed25519.js';
import {bytesToBase64, base64ToBytes, bytesToHex, hexToBytes} from './crypto';
import {generateKeypair, type Keypair} from './e2ee';
import {mmkvStorage} from './storageMMKV';
import {reportError} from './telemetry';

const SECRET_KEY_STORAGE = 'e2ee_secret_key_v1';

const db = getFirestore();

let cached: Keypair | null = null;

/**
 * Returns this device's keypair, generating and publishing one on first call.
 * The public key is written to users/{uid}/private/e2ee.
 */
export async function getOrCreateDeviceKeypair(userId: string): Promise<Keypair> {
  if (cached) return cached;

  const storedHex = await mmkvStorage.getItem(SECRET_KEY_STORAGE);
  if (storedHex) {
    const secretKey = hexToBytes(storedHex);
    const {publicKey} = keypairFromSecret(secretKey);
    cached = {secretKey, publicKey};
    return cached;
  }

  const keypair = generateKeypair();
  await mmkvStorage.setItem(SECRET_KEY_STORAGE, bytesToHex(keypair.secretKey));
  cached = keypair;
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
    reportError(error, 'e2ee_publish_public_key');
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
    const key = snap.exists ? (snap.data()?.publicKey as string | undefined) : undefined;
    return key ? base64ToBytes(key) : null;
  } catch (error) {
    // A permission error here is expected until the rules below are deployed;
    // treat it as "peer not enrolled" so messaging degrades to plaintext
    // rather than breaking entirely.
    reportError(error, 'e2ee_fetch_peer_public_key');
    return null;
  }
}

const PEER_KEY_CACHE_PREFIX = 'e2ee_peer_key_v1_';

async function getCachedPeerKey(peerUserId: string): Promise<string | null> {
  return mmkvStorage.getItem(PEER_KEY_CACHE_PREFIX + peerUserId);
}

async function cachePeerKey(peerUserId: string, publicKeyBase64: string): Promise<void> {
  await mmkvStorage.setItem(PEER_KEY_CACHE_PREFIX + peerUserId, publicKeyBase64);
}

export type PeerKeyStatus =
  /** Peer hasn't published a key — caller falls back to plaintext. */
  | 'unenrolled'
  /** First time this device has ever seen a key for this peer. */
  | 'first-contact'
  | 'unchanged'
  /** The key differs from what this device saw last time — see below. */
  | 'changed';

/**
 * Fetches a peer's public key and compares it against what this device saw
 * last time, so a substituted key (compromised server, or the peer genuinely
 * reinstalling) doesn't pass silently.
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
  peerUserId: string,
): Promise<{key: Uint8Array | null; status: PeerKeyStatus}> {
  const key = await fetchPeerPublicKey(peerUserId);
  if (!key) return {key: null, status: 'unenrolled'};

  const keyBase64 = bytesToBase64(key);
  const cached = await getCachedPeerKey(peerUserId);

  if (!cached) {
    await cachePeerKey(peerUserId, keyBase64);
    return {key, status: 'first-contact'};
  }
  if (cached === keyBase64) {
    return {key, status: 'unchanged'};
  }
  await cachePeerKey(peerUserId, keyBase64);
  return {key, status: 'changed'};
}

/** Test seam — drops the in-memory cache. */
export function _resetKeypairCache(): void {
  cached = null;
}
