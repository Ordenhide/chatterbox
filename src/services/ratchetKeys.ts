/**
 * Publication and retrieval of the keys the ratchet needs — phase 2 of the
 * forward-secrecy work. The crypto itself lives in ./ratchet; this file is
 * only about who publishes what, where it is stored, and how a peer gets it.
 *
 * ## Coexistence with the existing identity, not replacement
 *
 * `e2eeKeys.ts` publishes an X25519 key at `users/{uid}/publicKeys/e2ee` and
 * every existing message is sealed to it. That key is left completely alone:
 * it stays published and keeps decrypting history. This module adds a second,
 * independent identity at `users/{uid}/publicKeys/ratchet`.
 *
 * Two identities is a real cost — twice the key material, and a safety number
 * that has to cover both to keep meaning anything. The alternative was to
 * migrate the existing key, which cannot work: the identity must be Ed25519 to
 * sign prekeys (see ratchet/x3dh.ts), the published X25519 keys are not
 * derived from any Ed25519 key, and rotating them would orphan every message
 * already on the server.
 *
 * ## Where the secrets live
 *
 * The identity secret goes to the OS key store, exactly as the E2EE device key
 * does, reusing the same read-back-verified helpers — this key is worth what
 * that one is worth. Prekey secrets go there too: the signed prekey's secret
 * completes X3DH as the responder, so it opens the first message of every
 * conversation started against it.
 *
 * Both fall back to MMKV when the key store is unavailable, which is the same
 * degradation e2eeKeys.ts already makes and for the same reason: on a build
 * where the native module isn't linked, "no key store" must mean "behave as
 * before", never "lose the key".
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from './firebase/firestore';
import {base64ToBytes, bytesToBase64} from './crypto';
import {mmkvStorage} from './storageMMKV';
import {getSecret, isSecureStoreAvailable, removeSecret, setSecretVerified} from './secureKeyStore';
import {reportError} from './errorLog';
import {
  generateIdentityKeypair,
  generatePreKeys,
  verifyPreKeySignature,
  type IdentityKeypair,
  type PreKeyBundle,
  type PreKeySecrets,
} from './ratchet/x3dh';
import type {Keypair} from './ratchet/doubleRatchet';

const db = getFirestore();

/** Published document id, alongside the existing `e2ee` doc. */
const RATCHET_KEY_DOC = 'ratchet';

const IDENTITY_STORAGE_PREFIX = 'ratchet_identity_v1_';
const PREKEY_SECRETS_STORAGE_PREFIX = 'ratchet_prekey_secrets_v1_';

const IDENTITY_SERVICE_PREFIX = 'com.chatterbox.ratchet.identity';
const PREKEY_SERVICE_PREFIX = 'com.chatterbox.ratchet.prekeys';

/** How many one-time prekeys a fresh batch holds. */
export const ONE_TIME_PREKEY_BATCH = 50;
/** Publish a new batch once the published count falls to this. */
export const ONE_TIME_PREKEY_LOW_WATER = 10;

/**
 * How long a signed prekey stays current.
 *
 * Rotation is what limits the damage of a stolen signed-prekey secret: it can
 * open the first message of any conversation started against it, and only
 * until it is replaced. A week is the usual interval and is short enough to
 * matter without churning published state.
 */
export const SIGNED_PREKEY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function identityService(userId: string): string {
  return `${IDENTITY_SERVICE_PREFIX}.${userId}`;
}

function preKeyService(userId: string): string {
  return `${PREKEY_SERVICE_PREFIX}.${userId}`;
}

// ---- protected storage -----------------------------------------------------
//
// Mirrors readSecretKeyHex/writeSecretKeyHex in e2eeKeys.ts, including the
// property that matters most: the MMKV copy is deleted only once the key store
// has read the value back, never on a write that merely didn't throw.

async function readProtected(storageKey: string, service: string): Promise<string | null> {
  if (isSecureStoreAvailable()) {
    const fromStore = await getSecret(service);
    if (fromStore) return fromStore;
  }
  const fromMmkv = await mmkvStorage.getItem(storageKey);
  if (!fromMmkv) return null;
  if (isSecureStoreAvailable() && (await setSecretVerified(service, fromMmkv))) {
    await mmkvStorage.removeItem(storageKey);
  }
  return fromMmkv;
}

async function writeProtected(storageKey: string, service: string, value: string): Promise<void> {
  if (isSecureStoreAvailable() && (await setSecretVerified(service, value))) {
    await mmkvStorage.removeItem(storageKey);
    return;
  }
  await mmkvStorage.setItem(storageKey, value);
}

// ---- serialization ---------------------------------------------------------
//
// Every change to the prekey secrets is read-modify-write across two stores
// (local secrets, then Firestore), and the callers overlap in practice:
// AuthContext re-runs ensureRatchetKeysPublished whenever the user object
// changes, which it does during sign-in, and an incoming handshake burns a
// one-time prekey whenever it arrives. Unserialized, two publishes on a fresh
// device could store one batch and publish the other — leaving a signed prekey
// on the server this device cannot answer, so every conversation started
// against it failed with ratchet_respond_missing_prekey.

const preKeyQueues = new Map<string, Promise<unknown>>();

function serialized<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = preKeyQueues.get(userId) ?? Promise.resolve();
  const run = previous.then(task, task);
  preKeyQueues.set(userId, run.catch(() => undefined));
  return run;
}

// ---- identity --------------------------------------------------------------

type StoredIdentity = {v: 1; secretKey: string; publicKey: string};

let cachedIdentity: {userId: string; identity: IdentityKeypair} | null = null;
let identityInFlight: {userId: string; promise: Promise<IdentityKeypair>} | null = null;

/**
 * This device's Ed25519 ratchet identity, created on first use.
 *
 * Deliberately does not publish. Publication is a separate, explicit step
 * (`publishRatchetKeys`) because generating an identity is local and cheap
 * while publishing is a claim to peers that this device can be reached — and
 * one that must not happen as a side effect of some unrelated read.
 */
export async function getOrCreateRatchetIdentity(userId: string): Promise<IdentityKeypair> {
  if (cachedIdentity?.userId === userId) return cachedIdentity.identity;
  // Two first-time callers at once would each generate an identity, and the
  // one stored last need not be the one that signed what got published.
  if (identityInFlight?.userId === userId) return identityInFlight.promise;

  const promise = loadOrCreateIdentity(userId);
  identityInFlight = {userId, promise};
  try {
    return await promise;
  } finally {
    if (identityInFlight?.promise === promise) identityInFlight = null;
  }
}

async function loadOrCreateIdentity(userId: string): Promise<IdentityKeypair> {
  const storageKey = IDENTITY_STORAGE_PREFIX + userId;
  const stored = await readProtected(storageKey, identityService(userId));
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as StoredIdentity;
      if (parsed.v === 1) {
        const identity: IdentityKeypair = {
          secretKey: base64ToBytes(parsed.secretKey),
          publicKey: base64ToBytes(parsed.publicKey),
        };
        cachedIdentity = {userId, identity};
        return identity;
      }
    } catch (error) {
      // Falling through to generate a new identity would silently orphan every
      // session established under the old one. Surface it instead.
      reportError(error, 'ratchet_identity_unreadable');
      throw new Error('ratchet: stored identity is unreadable');
    }
  }

  const identity = generateIdentityKeypair();
  const payload: StoredIdentity = {
    v: 1,
    secretKey: bytesToBase64(identity.secretKey),
    publicKey: bytesToBase64(identity.publicKey),
  };
  await writeProtected(storageKey, identityService(userId), JSON.stringify(payload));
  cachedIdentity = {userId, identity};
  return identity;
}

// ---- prekey secrets --------------------------------------------------------

type StoredSignedPreKey = {pair: {secretKey: string; publicKey: string}; createdAt: number};

type StoredPreKeySecrets = {
  v: 2;
  /** Current first, then the one it replaced. See the grace-period note below. */
  signedPreKeys: [string, StoredSignedPreKey][];
  currentSignedPreKeyId: string;
  oneTimePreKeys: [string, {secretKey: string; publicKey: string}][];
};

function encodeKeypair(pair: Keypair) {
  return {secretKey: bytesToBase64(pair.secretKey), publicKey: bytesToBase64(pair.publicKey)};
}

function decodeKeypair(raw: {secretKey: string; publicKey: string}): Keypair {
  return {secretKey: base64ToBytes(raw.secretKey), publicKey: base64ToBytes(raw.publicKey)};
}

/**
 * Everything this device needs to answer a handshake.
 *
 * More than one signed prekey on purpose. A peer fetches the bundle and then
 * sends; if rotation lands in between, the message names the key that was
 * current when they looked. Keeping the previous one means that message still
 * opens instead of becoming permanently undecryptable — a rare window, but the
 * failure is silent and unrecoverable, which is the combination worth
 * spending state on. Exactly one generation is retained: the point is to cover
 * a send in flight, not to keep old keys alive indefinitely.
 */
export type LocalPreKeySecrets = {
  signedPreKeys: Map<string, {pair: Keypair; createdAt: number}>;
  currentSignedPreKeyId: string;
  oneTimePreKeys: Map<string, Keypair>;
};

export async function loadPreKeySecrets(userId: string): Promise<LocalPreKeySecrets | null> {
  const stored = await readProtected(PREKEY_SECRETS_STORAGE_PREFIX + userId, preKeyService(userId));
  if (!stored) return null;
  try {
    const raw = JSON.parse(stored) as StoredPreKeySecrets;
    if (raw.v !== 2) return null;
    return {
      signedPreKeys: new Map(
        raw.signedPreKeys.map(([id, s]) => [id, {pair: decodeKeypair(s.pair), createdAt: s.createdAt}]),
      ),
      currentSignedPreKeyId: raw.currentSignedPreKeyId,
      oneTimePreKeys: new Map(raw.oneTimePreKeys.map(([id, pair]) => [id, decodeKeypair(pair)])),
    };
  } catch (error) {
    reportError(error, 'ratchet_prekey_secrets_unreadable');
    return null;
  }
}

async function savePreKeySecrets(userId: string, secrets: LocalPreKeySecrets): Promise<void> {
  const payload: StoredPreKeySecrets = {
    v: 2,
    signedPreKeys: [...secrets.signedPreKeys].map(([id, s]) => [
      id,
      {pair: encodeKeypair(s.pair), createdAt: s.createdAt},
    ]),
    currentSignedPreKeyId: secrets.currentSignedPreKeyId,
    oneTimePreKeys: [...secrets.oneTimePreKeys].map(([id, pair]) => [id, encodeKeypair(pair)]),
  };
  await writeProtected(
    PREKEY_SECRETS_STORAGE_PREFIX + userId,
    preKeyService(userId),
    JSON.stringify(payload),
  );
}

/**
 * The single-signed-prekey view `respondX3DH` expects, selected by the id the
 * incoming message actually names.
 *
 * Returns null when this device holds no such signed prekey — meaning the
 * message was built against a key rotated out more than one generation ago.
 * The caller must treat that as an undecryptable first message rather than
 * substituting the current key, which would derive a different secret and fail
 * later with a far more confusing symptom.
 */
export async function preKeySecretsForResponding(
  userId: string,
  signedPreKeyId: string,
): Promise<PreKeySecrets | null> {
  const secrets = await loadPreKeySecrets(userId);
  const signed = secrets?.signedPreKeys.get(signedPreKeyId);
  if (!secrets || !signed) return null;
  return {
    signedPreKey: signed.pair,
    signedPreKeyId,
    oneTimePreKeys: secrets.oneTimePreKeys,
  };
}

/**
 * Drops a one-time prekey once it has been used.
 *
 * Separate from responding to a handshake so the caller controls the ordering:
 * burning the key before the resulting session is durably stored would make
 * that first message permanently undecryptable if the app died in between.
 */
export function burnOneTimePreKey(userId: string, id: string): Promise<void> {
  return serialized(userId, () => burnOneTimePreKeyNow(userId, id));
}

async function burnOneTimePreKeyNow(userId: string, id: string): Promise<void> {
  const secrets = await loadPreKeySecrets(userId);
  if (!secrets || !secrets.oneTimePreKeys.has(id)) return;
  const next = new Map(secrets.oneTimePreKeys);
  next.delete(id);
  await savePreKeySecrets(userId, {...secrets, oneTimePreKeys: next});
}

// ---- publication -----------------------------------------------------------

function preKeysCollection(userId: string) {
  return collection(doc(collection(db, 'users'), userId), 'oneTimePreKeys');
}

async function publishOneTimePreKeys(
  userId: string,
  keys: {id: string; publicKey: Uint8Array}[],
): Promise<void> {
  await Promise.all(
    keys.map(otp =>
      setDoc(doc(preKeysCollection(userId), otp.id), {
        publicKey: bytesToBase64(otp.publicKey),
        claimed: false,
        createdAt: serverTimestamp(),
      }),
    ),
  );
}

async function publishBundleDoc(
  userId: string,
  published: {
    identityKey: Uint8Array;
    signedPreKey: Uint8Array;
    signedPreKeySignature: Uint8Array;
    signedPreKeyId: string;
  },
): Promise<void> {
  await setDoc(
    doc(collection(doc(collection(db, 'users'), userId), 'publicKeys'), RATCHET_KEY_DOC),
    {
      identityKey: bytesToBase64(published.identityKey),
      signedPreKey: bytesToBase64(published.signedPreKey),
      signedPreKeySignature: bytesToBase64(published.signedPreKeySignature),
      signedPreKeyId: published.signedPreKeyId,
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
}

/**
 * First publication for this device: identity document, signed prekey, and an
 * initial one-time batch.
 *
 * Order matters. The private half is stored *before* anything is published,
 * because publishing first would advertise a prekey this device cannot answer
 * — turning the first message of every conversation started against it into an
 * undecryptable one.
 */
export function publishRatchetKeys(userId: string): Promise<void> {
  return serialized(userId, () => publishRatchetKeysNow(userId));
}

async function publishRatchetKeysNow(userId: string): Promise<void> {
  const identity = await getOrCreateRatchetIdentity(userId);
  const {published, secrets} = generatePreKeys(identity, ONE_TIME_PREKEY_BATCH);

  await savePreKeySecrets(userId, {
    signedPreKeys: new Map([[secrets.signedPreKeyId, {pair: secrets.signedPreKey, createdAt: Date.now()}]]),
    currentSignedPreKeyId: secrets.signedPreKeyId,
    oneTimePreKeys: secrets.oneTimePreKeys,
  });

  await publishBundleDoc(userId, published);
  await publishOneTimePreKeys(userId, published.oneTimePreKeys);
}

/**
 * Adds one-time prekeys without disturbing anything already published.
 *
 * Strictly additive, and that is the point. An earlier version regenerated the
 * whole batch on top-up, which replaced the stored secrets and left every
 * still-published key from the old batch unanswerable: a peer could claim one,
 * complete X3DH against it, and the responder would have no matching secret —
 * a permanently undecryptable first message, reported as nothing at all.
 */
export function topUpOneTimePreKeys(userId: string, count = ONE_TIME_PREKEY_BATCH): Promise<void> {
  return serialized(userId, () => topUpOneTimePreKeysNow(userId, count));
}

async function topUpOneTimePreKeysNow(userId: string, count: number): Promise<void> {
  const identity = await getOrCreateRatchetIdentity(userId);
  const secrets = await loadPreKeySecrets(userId);
  if (!secrets) {
    await publishRatchetKeysNow(userId);
    return;
  }

  // generatePreKeys also mints a signed prekey; only the one-time keys are
  // wanted here, so that one is discarded rather than published and the
  // current signed prekey stays current. Rotation is rotateSignedPreKey's job.
  const generated = generatePreKeys(identity, count);
  const merged = new Map(secrets.oneTimePreKeys);
  for (const [id, pair] of generated.secrets.oneTimePreKeys) merged.set(id, pair);

  await savePreKeySecrets(userId, {...secrets, oneTimePreKeys: merged});
  await publishOneTimePreKeys(userId, generated.published.oneTimePreKeys);
}

/**
 * Replaces the signed prekey, keeping the previous one so a message already in
 * flight against it can still be answered. Exactly one generation is retained.
 */
export function rotateSignedPreKey(userId: string): Promise<void> {
  return serialized(userId, () => rotateSignedPreKeyNow(userId));
}

async function rotateSignedPreKeyNow(userId: string): Promise<void> {
  const identity = await getOrCreateRatchetIdentity(userId);
  const secrets = await loadPreKeySecrets(userId);
  if (!secrets) {
    await publishRatchetKeysNow(userId);
    return;
  }

  const {published, secrets: fresh} = generatePreKeys(identity, 0);
  const previous = secrets.signedPreKeys.get(secrets.currentSignedPreKeyId);

  const kept = new Map<string, {pair: Keypair; createdAt: number}>();
  kept.set(fresh.signedPreKeyId, {pair: fresh.signedPreKey, createdAt: Date.now()});
  if (previous) kept.set(secrets.currentSignedPreKeyId, previous);

  await savePreKeySecrets(userId, {
    signedPreKeys: kept,
    currentSignedPreKeyId: fresh.signedPreKeyId,
    oneTimePreKeys: secrets.oneTimePreKeys,
  });
  await publishBundleDoc(userId, published);
}

/**
 * Removes prekeys this device has already answered.
 *
 * Only claimed ones: an unclaimed published key still has a live secret here,
 * and deleting it would throw away a usable key for nothing.
 */
async function purgeClaimedPreKeys(userId: string): Promise<void> {
  const snap = await getDocs(query(preKeysCollection(userId), where('claimed', '==', true)));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref).catch(() => undefined)));
}

export type RatchetKeyStatus = {
  /** A bundle exists for this account — published by some device. */
  published: boolean;
  /**
   * ...and its identity key is the one *this* device holds.
   *
   * Asking only whether a bundle exists is not enough, and the difference is
   * a silent failure. An account is reachable over the ratchet at exactly one
   * identity, so a second device publishing replaces the first's. The first
   * then holds valid local secrets, sees a bundle on the server, concludes
   * there is nothing to do — and cannot open a single new ratchet message,
   * because peers are now sealing to an identity it does not have. Nothing
   * reports it: sending still works, and every incoming message just fails to
   * open. It is the same shape as the 'superseded' state enrollmentReadiness
   * exists to catch for the static key.
   */
  publishedByThisDevice: boolean;
  /**
   * ...and the signed prekey it advertises is one this device holds the
   * secret for. Identity alone does not establish that: if the two ever
   * diverge, every conversation a peer starts against the bundle fails to open
   * (ratchet_respond_missing_prekey) while the identity check sees nothing
   * wrong.
   */
  signedPreKeyAnswerable: boolean;
  unclaimedPreKeys: number;
  signedPreKeyAgeMs: number | null;
};

export async function ratchetKeyStatus(userId: string): Promise<RatchetKeyStatus> {
  const bundleSnap = await getDoc(
    doc(collection(doc(collection(db, 'users'), userId), 'publicKeys'), RATCHET_KEY_DOC),
  );
  const secrets = await loadPreKeySecrets(userId);
  const unclaimed = await getDocs(query(preKeysCollection(userId), where('claimed', '==', false)));
  const current = secrets?.signedPreKeys.get(secrets.currentSignedPreKeyId);

  const published = bundleSnap.exists()
    ? (bundleSnap.data() as {identityKey?: string; signedPreKeyId?: string} | undefined)
    : undefined;
  const publishedIdentity = published?.identityKey;
  const mine = await getOrCreateRatchetIdentity(userId);

  return {
    published: bundleSnap.exists(),
    publishedByThisDevice: !!publishedIdentity && publishedIdentity === bytesToBase64(mine.publicKey),
    signedPreKeyAnswerable: !!published?.signedPreKeyId && !!secrets?.signedPreKeys.has(published.signedPreKeyId),
    unclaimedPreKeys: unclaimed.size,
    signedPreKeyAgeMs: current ? Date.now() - current.createdAt : null,
  };
}

/**
 * Publishes if nothing is published, tops up a depleted batch, and rotates an
 * aged signed prekey. Safe and cheap to call on app start.
 *
 * The three are separate operations rather than one republish, because a
 * republish invalidates keys that are still published and still claimable —
 * see topUpOneTimePreKeys.
 */
export async function ensureRatchetKeysPublished(userId: string): Promise<void> {
  try {
    await serialized(userId, () => ensureRatchetKeysPublishedNow(userId));
  } catch (error) {
    // Never fatal. A device that cannot publish simply cannot be reached over
    // the ratchet yet, which the send path treats as "no ratchet session" —
    // it must not take the app down or block signing in.
    reportError(error, 'ratchet_ensure_keys_published');
  }
}

async function ensureRatchetKeysPublishedNow(userId: string): Promise<void> {
  const status = await ratchetKeyStatus(userId);
  const secrets = await loadPreKeySecrets(userId);

  // Republishing when the bundle is someone else's is not the destructive
  // case the comment above warns about. Those published prekeys belong to
  // the other device and this one could never have answered them; taking
  // the identity back is the only way it becomes reachable again.
  if (!status.published || !status.publishedByThisDevice || !secrets) {
    await publishRatchetKeysNow(userId);
    return;
  }

  // Our identity, but a signed prekey we cannot answer. Rotating rather than
  // republishing keeps the one-time prekeys still held here answerable.
  if (!status.signedPreKeyAnswerable) {
    await rotateSignedPreKeyNow(userId);
  }

  // Claimed keys are dead weight on both sides; clear them before counting
  // what still needs topping up.
  await purgeClaimedPreKeys(userId).catch(() => undefined);

  if (status.unclaimedPreKeys <= ONE_TIME_PREKEY_LOW_WATER) {
    await topUpOneTimePreKeysNow(userId, ONE_TIME_PREKEY_BATCH - status.unclaimedPreKeys);
  }
  if (
    status.signedPreKeyAnswerable &&
    status.signedPreKeyAgeMs !== null &&
    status.signedPreKeyAgeMs > SIGNED_PREKEY_MAX_AGE_MS
  ) {
    await rotateSignedPreKeyNow(userId);
  }
}

export async function clearRatchetKeys(userId: string): Promise<void> {
  cachedIdentity = null;
  identityInFlight = null;
  await removeSecret(identityService(userId));
  await removeSecret(preKeyService(userId));
  await mmkvStorage.removeItem(IDENTITY_STORAGE_PREFIX + userId);
  await mmkvStorage.removeItem(PREKEY_SECRETS_STORAGE_PREFIX + userId);
}

// ---- fetching a peer's bundle ----------------------------------------------

const PEER_IDENTITY_CACHE_PREFIX = 'ratchet_peer_identity_v1_';

/** Mirrors PeerKeyStatus in e2eeKeys.ts, for the ratchet identity. */
export type PeerRatchetStatus = 'unenrolled' | 'first-contact' | 'unchanged' | 'changed' | 'unavailable';

/**
 * The peer's ratchet identity, read without claiming a one-time prekey.
 *
 * Separate from fetchPeerPreKeyBundle because claiming has a cost: showing a
 * safety number, or checking whether an identity changed, must not consume a
 * prekey from someone's batch. Doing that would let a screen the user opens
 * repeatedly drain a peer's supply.
 *
 * Trust-on-first-use, the same shape e2eeKeys.ts already applies to the X25519
 * key — and necessary for the same reason. The signature check inside the
 * bundle proves the signed prekey belongs to the identity in that bundle; it
 * proves nothing about whether that identity is the peer's. A server that
 * substitutes *both* passes verification cleanly, so the only thing standing
 * against identity substitution is noticing that it changed.
 */
export async function fetchPeerRatchetIdentity(
  myUserId: string,
  peerUserId: string,
): Promise<{identityKey: Uint8Array | null; status: PeerRatchetStatus}> {
  let snap;
  try {
    snap = await getDoc(
      doc(collection(doc(collection(db, 'users'), peerUserId), 'publicKeys'), RATCHET_KEY_DOC),
    );
  } catch (error) {
    reportError(error, 'ratchet_fetch_identity');
    return {identityKey: null, status: 'unavailable'};
  }
  const raw = snap.exists() ? (snap.data()?.identityKey as string | undefined) : undefined;
  if (!raw) return {identityKey: null, status: 'unenrolled'};

  const identityKey = base64ToBytes(raw);
  const cacheKey = `${PEER_IDENTITY_CACHE_PREFIX}${myUserId}_${peerUserId}`;
  const cached = await mmkvStorage.getItem(cacheKey);

  if (!cached) {
    await mmkvStorage.setItem(cacheKey, raw);
    return {identityKey, status: 'first-contact'};
  }
  if (cached === raw) return {identityKey, status: 'unchanged'};
  await mmkvStorage.setItem(cacheKey, raw);
  return {identityKey, status: 'changed'};
}

export class PreKeyBundleUnavailableError extends Error {
  readonly code = 'prekey-bundle-unavailable';
  constructor(message = 'could not retrieve the peer prekey bundle') {
    super(message);
    this.name = 'PreKeyBundleUnavailableError';
  }
}

/**
 * Claims one unclaimed one-time prekey, atomically.
 *
 * A transaction, not a plain read: two people starting a conversation with the
 * same peer at the same moment must not receive the same one-time prekey, or
 * neither gets the replay resistance it exists to provide.
 *
 * The claim deliberately records only *that* the key was taken, never by whom.
 * Writing the claimer's uid would hand the server a precise record of who
 * started talking to whom — the exact metadata an end-to-end encrypted app is
 * supposed to be reducing — in return for nothing, since the responder locates
 * the matching secret by id from its own storage.
 *
 * Returns null when the batch is exhausted, which is a supported state: X3DH
 * without a one-time prekey still authenticates and is still forward-secret,
 * it just loses replay resistance for the first message. Failing the whole
 * handshake instead would let anyone disable messaging to a user by draining
 * their batch.
 */
async function claimOneTimePreKey(
  peerUserId: string,
): Promise<{id: string; publicKey: Uint8Array} | null> {
  const available = await getDocs(
    query(preKeysCollection(peerUserId), where('claimed', '==', false), limit(5)),
  );
  for (const candidate of available.docs) {
    try {
      const claimed = await runTransaction(db, async tx => {
        const fresh = await tx.get(candidate.ref);
        if (!fresh.exists() || fresh.data()?.claimed === true) return null;
        tx.update(candidate.ref, {claimed: true, claimedAt: serverTimestamp()});
        return fresh.data()?.publicKey as string | undefined;
      });
      if (claimed) return {id: candidate.id, publicKey: base64ToBytes(claimed)};
    } catch {
      // Lost the race to another claimer; try the next candidate.
    }
  }
  return null;
}

/**
 * The peer's bundle, ready to hand to initiateX3DH.
 *
 * Returns null only when the peer has genuinely not published a ratchet
 * identity — an old client, or one that has not upgraded yet. Every other
 * failure throws, because the two must not be confused: treating an
 * unreachable server as "peer has no ratchet" is precisely the silent
 * downgrade this project has already had to fix once elsewhere.
 */
export async function fetchPeerPreKeyBundle(
  myUserId: string,
  peerUserId: string,
): Promise<{bundle: PreKeyBundle; identityStatus: PeerRatchetStatus} | null> {
  // Trust-on-first-use on the identity, before anything is claimed. The
  // signature inside the bundle proves the signed prekey belongs to the
  // identity in that bundle — it proves nothing about whether that identity is
  // the peer's, and a server substituting both passes verification cleanly.
  // Noticing the identity changed is the only defence against that.
  const identity = await fetchPeerRatchetIdentity(myUserId, peerUserId);
  if (identity.status === 'unavailable') throw new PreKeyBundleUnavailableError();
  if (identity.status === 'unenrolled') return null;

  let snap;
  try {
    snap = await getDoc(
      doc(collection(doc(collection(db, 'users'), peerUserId), 'publicKeys'), RATCHET_KEY_DOC),
    );
  } catch (error) {
    reportError(error, 'ratchet_fetch_bundle');
    throw new PreKeyBundleUnavailableError();
  }
  if (!snap.exists()) return null;

  const data = snap.data() as
    | {
        identityKey?: string;
        signedPreKey?: string;
        signedPreKeySignature?: string;
        signedPreKeyId?: string;
      }
    | undefined;
  if (!data?.identityKey || !data.signedPreKey || !data.signedPreKeySignature || !data.signedPreKeyId) {
    return null;
  }

  const identityKey = base64ToBytes(data.identityKey);
  const signedPreKey = base64ToBytes(data.signedPreKey);
  const signedPreKeySignature = base64ToBytes(data.signedPreKeySignature);

  // Verified here as well as inside initiateX3DH. This is the point where a
  // hostile or compromised server would substitute its own prekey, and
  // catching it here means the caller never even claims a one-time prekey
  // against a bundle that was going to be rejected.
  if (!verifyPreKeySignature(identityKey, signedPreKey, signedPreKeySignature)) {
    reportError(new Error('signed prekey signature invalid'), 'ratchet_bundle_signature');
    throw new PreKeyBundleUnavailableError('signed prekey signature did not verify');
  }

  const oneTimePreKey = await claimOneTimePreKey(peerUserId).catch(() => null);

  return {
    bundle: {
      identityKey,
      signedPreKey,
      signedPreKeySignature,
      signedPreKeyId: data.signedPreKeyId,
      ...(oneTimePreKey ? {oneTimePreKey} : null),
    },
    identityStatus: identity.status,
  };
}

export function _resetRatchetIdentityCache(): void {
  cachedIdentity = null;
  identityInFlight = null;
}
