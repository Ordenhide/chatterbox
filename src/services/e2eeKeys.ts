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
import {doc, getDoc, getFirestore, serverTimestamp, setDoc} from './firebase/firestore';
import {x25519} from '@noble/curves/ed25519.js';
import {bytesToBase64, base64ToBytes, bytesToHex, hexToBytes} from './crypto';
import {generateKeypair, type Keypair} from './e2ee';
import {isValidMnemonic, mnemonicToSecretKey, secretKeyToMnemonic} from './e2eeMnemonic';
import {clearRecoveryPhrase} from './keyBackup';
import {mmkvStorage} from './storageMMKV';
import {
  getSecret,
  isSecureStoreAvailable,
  removeSecret,
  secretKeyService,
  setSecretVerified,
} from './secureKeyStore';
import {reportError} from './errorLog';

// Scoped per account: this device can see more than one account across a
// sign-out/sign-in within the same app process, and neither the secret key
// nor the "have I shown this account its phrase" flag may leak between them.
const SECRET_KEY_STORAGE_PREFIX = 'e2ee_secret_key_v1_';
const RECOVERY_REVEALED_STORAGE_PREFIX = 'e2ee_recovery_revealed_v1_';
// Pre-scoping storage key, kept only so a device's existing (single) key
// survives the upgrade — see the migration in getOrCreateDeviceKeypair.
const LEGACY_SECRET_KEY_STORAGE = 'e2ee_secret_key_v1';

const db = getFirestore();

/**
 * Reads this account's secret key, preferring the OS key store and migrating
 * into it opportunistically.
 *
 * The ordering is the safety property. A device that has never run a build
 * with the Keychain linked has its key in MMKV; one that has, has it in the
 * Keychain; and one mid-migration may briefly have both. Reading the Keychain
 * first and MMKV second covers all three without needing to know which.
 *
 * Migration only ever *adds* a copy. The MMKV copy is deleted only after
 * setSecretVerified has read the value back out of the key store — never on
 * the strength of a write having resolved. If anything about the secure store
 * is broken or absent, every step degrades to "leave MMKV alone", which is
 * exactly today's behaviour. The one thing this must never do is destroy the
 * only copy of a user's identity key, since losing it means losing every
 * message they can decrypt, recoverable only from a phrase most users will
 * not have written down.
 */
async function readSecretKeyHex(storageKey: string, userId: string): Promise<string | null> {
  const service = secretKeyService(userId);

  if (isSecureStoreAvailable()) {
    const fromKeychain = await getSecret(service);
    if (fromKeychain) return fromKeychain;
  }

  const fromMmkv = await mmkvStorage.getItem(storageKey);
  if (!fromMmkv) return null;

  // Present in MMKV but not the key store: either this build just gained the
  // native module, or a previous migration attempt failed. Either way, try
  // again — and only drop the MMKV copy once the new one reads back.
  if (isSecureStoreAvailable() && (await setSecretVerified(service, fromMmkv))) {
    await mmkvStorage.removeItem(storageKey);
  }
  return fromMmkv;
}

/**
 * Writes a newly generated secret key, preferring the OS key store.
 *
 * Falls back to MMKV when the store is unavailable *or* when the write can't
 * be read back, so a key is never generated with nowhere durable to live.
 */
async function writeSecretKeyHex(
  storageKey: string,
  userId: string,
  secretHex: string,
): Promise<void> {
  if (isSecureStoreAvailable() && (await setSecretVerified(secretKeyService(userId), secretHex))) {
    // Clear any older MMKV copy for this account so the weaker location does
    // not keep a stale key around after a restore overwrites it.
    await mmkvStorage.removeItem(storageKey);
    return;
  }
  await mmkvStorage.setItem(storageKey, secretHex);
}

/**
 * Removes this account's secret key from wherever it lives.
 *
 * Exported for account deletion (services/account.ts). Before the key store
 * existed, wiping MMKV was enough to erase it — with the key now in the
 * Keychain/Keystore, an MMKV-only wipe would leave the user's identity key on
 * the device forever after they deleted their account, which is the opposite
 * of what deletion promises. Clears both locations rather than assuming which
 * one this build used.
 */
export async function clearDeviceKeypair(userId: string): Promise<void> {
  await removeSecret(secretKeyService(userId));
  await mmkvStorage.removeItem(SECRET_KEY_STORAGE_PREFIX + userId);
  // The platform backup too, and for the same reason the other two go: an
  // account deleted from this device must not leave a copy of its identity in
  // iCloud Keychain or Block Store, ready to restore itself onto the next
  // device the user signs in on — or, worse, to be handed back to this one on
  // a later reinstall of an account that no longer exists.
  await clearRecoveryPhrase(userId);
  cached = null;
}

let cached: {userId: string; keypair: Keypair} | null = null;

// Bumped every time restoreDeviceKeypairFromPhrase installs a different
// device key, so screens that cache per-message decrypt results (keyed by
// message id, not by which key decrypted them) know to discard that cache
// and retry — otherwise a message that failed under the old key stays
// stuck showing that failure forever, even after the right key is restored.
let keyGeneration = 0;

export function getKeyGeneration(): number {
  return keyGeneration;
}

export type EnrollmentReadiness =
  /** This device already holds this account's key, or no key exists anywhere. */
  | 'safe'
  /** The account has a key published elsewhere that this device doesn't hold. */
  | 'needs-restore'
  /**
   * This device holds a key, but it is no longer the one the account
   * publishes — another device replaced it. Distinct from 'needs-restore'
   * because nothing here is missing: the device looks enrolled, sends fine,
   * and silently fails to open anything addressed to the new key.
   */
  | 'superseded'
  /** Couldn't find out — treat as "don't touch anything yet". */
  | 'unknown';

/**
 * Whether it's safe to let an *automatic* trigger enroll this device.
 *
 * A plain getOrCreateDeviceKeypair call mints and publishes a new keypair
 * whenever this device has no local key. If the account already published one
 * from another device, that silently overwrites it and permanently strands
 * any history still recoverable from the saved recovery phrase — and it would
 * happen within milliseconds of sign-in, long before the user could reach the
 * restore screen.
 *
 * Passive triggers (sign-in, the "save your recovery phrase" reminder) should
 * enroll only on `safe`. `unknown` is deliberately not folded into `safe`:
 * that's how a network blip would turn into an overwrite. Holding off costs
 * nothing — the device simply stays unenrolled, messaging degrades to
 * plaintext exactly as it does before first enrollment (see e2eeMessages.ts),
 * and the next sign-in tries again. A user who explicitly sends a message
 * still gets a keypair via the normal getOrCreateDeviceKeypair path.
 *
 * It answers a second question the callers all need and none could ask before:
 * whether the key this device holds is still the account's. Those are the same
 * lookup — both are "does local agree with published" — and splitting them
 * into two functions would have meant two round trips and two chances for the
 * answers to disagree.
 */
export async function enrollmentReadiness(userId: string): Promise<EnrollmentReadiness> {
  // Holding *a* key was previously enough to answer 'safe', without ever
  // asking which key the account publishes. That made the worst state in the
  // system unreportable: a device whose key has been replaced from elsewhere
  // holds one, so it answered 'safe', so nothing anywhere ever told the user
  // their key was the wrong one. It is also the state that looks most like
  // working — sending succeeds, because that seals to the *peer's* key — while
  // every incoming message fails to open. The comparison is the whole point of
  // the check, so it happens before any answer.
  const local = await getDeviceKeypairIfEnrolled(userId);

  let publishedKey: Uint8Array | null;
  try {
    publishedKey = await fetchPublishedKeyOrThrow(userId);
  } catch (error) {
    reportError(error, 'e2ee_enrollment_readiness_failed');
    // An enrolled device keeps its old answer when the server is unreachable.
    // 'unknown' exists to stop a device with no key from guessing its way into
    // an overwrite; a device that already holds one has nothing to overwrite,
    // and every passive trigger is a no-op for it. Returning 'unknown' here
    // would cost it the phrase reveal and the save-your-phrase reminder for
    // the duration of a network blip, protecting nothing.
    return local ? 'safe' : 'unknown';
  }

  // No published key: nothing can be stranded, whether or not this device
  // holds one. Enrolling is what *creates* the published key.
  if (!publishedKey) return 'safe';
  if (!local) return 'needs-restore';
  return bytesToBase64(local.publicKey) === bytesToBase64(publishedKey) ? 'safe' : 'superseded';
}

/**
 * This device's keypair if it already has one, or null — never mints one.
 *
 * For *readers*. getOrCreateDeviceKeypair publishes on first call, so calling
 * it merely to decrypt turns opening a chat into an enrollment: a second
 * device would mint a key and overwrite the account's published one within
 * milliseconds of the first sealed message scrolling into view, stranding
 * every message sealed to the first device's key — the exact damage
 * enrollmentReadiness exists to prevent, done by the code that was trying to
 * read the messages it just orphaned.
 *
 * Returning null is the correct outcome for a reader: it has no key, so it
 * cannot decrypt, and inventing one would not have helped it decrypt anything
 * either. The caller shows the restore prompt instead.
 */
export async function getDeviceKeypairIfEnrolled(userId: string): Promise<Keypair | null> {
  if (cached && cached.userId === userId) return cached.keypair;

  const storedHex =
    (await readSecretKeyHex(SECRET_KEY_STORAGE_PREFIX + userId, userId)) ??
    // The legacy key counts as enrolled, but is deliberately not *consumed*
    // here — migration stays the sole responsibility of the writer path, so
    // there is exactly one place that can move it.
    (await mmkvStorage.getItem(LEGACY_SECRET_KEY_STORAGE));

  if (!storedHex) return null;

  const keypair = keypairFromSecret(hexToBytes(storedHex));
  cached = {userId, keypair};
  return keypair;
}

/**
 * Returns this device's keypair, generating and publishing one on first call.
 * The public key is written to users/{uid}/private/e2ee.
 *
 * Enrolls as a side effect, so this is for *senders* — anything that needs to
 * read should use getDeviceKeypairIfEnrolled above.
 */
export async function getOrCreateDeviceKeypair(userId: string): Promise<Keypair> {
  if (cached && cached.userId === userId) return cached.keypair;

  const storageKey = SECRET_KEY_STORAGE_PREFIX + userId;
  // Reads the key store first and migrates the MMKV copy into it if that is
  // where the key still lives — see readSecretKeyHex.
  let storedHex = await readSecretKeyHex(storageKey, userId);

  if (!storedHex) {
    // One-time migration from the pre-scoping, device-wide key: covers the
    // overwhelming common case (a device that has only ever had one account
    // signed in) so that account doesn't get silently re-enrolled with a new
    // key on first launch after this fix. Consumed and deleted immediately,
    // so it can only ever be claimed by the first account that asks for it —
    // a second account on this device always gets its own fresh keypair.
    //
    // Order matters: the scoped copy is written (to the key store, or MMKV if
    // that isn't available) *before* the legacy one is deleted, so a failure
    // between the two leaves the key still readable rather than nowhere.
    const legacyHex = await mmkvStorage.getItem(LEGACY_SECRET_KEY_STORAGE);
    if (legacyHex) {
      await writeSecretKeyHex(storageKey, userId, legacyHex);
      await mmkvStorage.removeItem(LEGACY_SECRET_KEY_STORAGE);
      storedHex = legacyHex;
    }
  }

  if (storedHex) {
    const secretKey = hexToBytes(storedHex);
    const keypair = keypairFromSecret(secretKey);
    cached = {userId, keypair};
    return keypair;
  }

  const keypair = generateKeypair();
  await writeSecretKeyHex(storageKey, userId, bytesToHex(keypair.secretKey));
  cached = {userId, keypair};
  await publishPublicKey(userId, keypair.publicKey);
  return keypair;
}

/**
 * Installs `seed` as this account's device key, because for this account the
 * seed *is* the account (services/anonymousIdentity.ts).
 *
 * The difference from getOrCreateDeviceKeypair is that this one is
 * authoritative rather than lazy. That function's contract is "whatever key
 * this device already has, or a new random one" — correct when the key is
 * incidental to the account, wrong when it is derived from the same phrase
 * that opened it. Here there is exactly one key this account may hold, so an
 * existing local key is overwritten rather than preferred, and the public half
 * is republished even when it looks unchanged.
 *
 * ## Failure is safe, and retrying is the fix
 *
 * Throws if the public key cannot be published, which fails the sign-in that
 * called it. That is the intended behaviour, and it is only tolerable because
 * the account is deterministic: the same phrase reaches the same account, so
 * "try again" re-runs this in full. The alternative — letting sign-in succeed
 * with an unpublished key — leaves an account nobody can encrypt to, and
 * nothing would ever retry it, because getOrCreateDeviceKeypair publishes only
 * on first generation and this device would by then hold a stored key.
 *
 * The local write happens before the publish so that a failure here leaves the
 * device holding the right key, not a half-swapped one.
 */
export async function adoptSeedAsDeviceKey(userId: string, seed: Uint8Array): Promise<void> {
  const keypair = keypairFromSecret(seed);
  await writeSecretKeyHex(SECRET_KEY_STORAGE_PREFIX + userId, userId, bytesToHex(seed));
  cached = {userId, keypair};
  // Screens cache decrypt failures by message id, not by the key that failed,
  // so a device that just changed keys has to be told to retry.
  keyGeneration += 1;
  await publishPublicKey(userId, keypair.publicKey);
}

/**
 * Republishes this device's public key if the account is advertising none.
 *
 * This is what runs on every launch in place of the automatic enrolment that
 * used to. That enrolment *minted* a keypair when this device had none, which
 * an account whose identity is its recovery phrase cannot tolerate: sign-in
 * and the auth-state callback that triggers enrolment start at the same
 * moment, so a minted key could be published after the seed's and leave the
 * account permanently advertising a key its own phrase does not match. There
 * is no ordering to arrange here that fixes that, only a racer to remove — so
 * this one cannot mint. It publishes a key this device already holds, or does
 * nothing at all.
 *
 * Only the "nothing published" case is acted on. A published key that
 * *differs* is the 'superseded' state — another device replaced this account's
 * key — and republishing over it would strand whatever was encrypted to the
 * newer one. That case belongs to the user, and the restore screen already
 * puts it in front of them.
 *
 * What it exists to repair is the one hole adoptSeedAsDeviceKey leaves: if its
 * publish failed, this device holds the right key and the account advertises
 * nothing, and nothing else would ever try again — getOrCreateDeviceKeypair
 * publishes only on the call that generates, and by then a stored key exists.
 * Failures here are swallowed, because this is a repair, not a step anything
 * is waiting on.
 */
export async function republishKeyIfAccountHasNone(userId: string): Promise<void> {
  try {
    const local = await getDeviceKeypairIfEnrolled(userId);
    // No local key means this device is not enrolled and has nothing to
    // publish. The user restores from their phrase; that path publishes.
    if (!local) return;
    if (await fetchPublishedKeyOrThrow(userId)) return;
    await publishPublicKey(userId, local.publicKey);
  } catch (error) {
    reportError(error, 'e2ee_republish_missing_key');
  }
}

function keypairFromSecret(secretKey: Uint8Array): Keypair {
  // Recomputing the public half is cheap and avoids storing it twice, so the
  // secret key remains the single source of truth.
  return {secretKey, publicKey: x25519.getPublicKey(secretKey)};
}

/**
 * Capability this client advertises for encrypted attachment *bytes*
 * (services/mediaCrypto.ts).
 *
 * Needed because encrypting the object is not a change a reader can ignore.
 * Text degrades gracefully — an older client that cannot open a ratchet
 * envelope simply never receives one — but an older client handed a message
 * whose `image` URL points at ciphertext will fetch it and render a broken
 * image, with no way to tell that from a genuinely corrupt upload.
 *
 * So the sender checks first, and only encrypts when *every* recipient
 * advertises this. Published on the existing public-key document, which is
 * already owner-written and world-readable, so this needs no rules change and
 * no extra read on the send path.
 */
export const MEDIA_CAPABILITY = 'media-v1';

/** What this build supports. Sent on every key publish. */
const CAPABILITIES = [MEDIA_CAPABILITY];

export async function publishPublicKey(userId: string, publicKey: Uint8Array): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', userId, 'publicKeys', 'e2ee'),
      {publicKey: bytesToBase64(publicKey), caps: CAPABILITIES, updatedAt: serverTimestamp()},
      {merge: true},
    );
  } catch (error) {
    reportError(error, 'e2ee_publish_public_key');
    throw error;
  }
}

/**
 * @deprecated Use fetchPeerPublicKeyChecked. This collapses "peer has no key"
 * and "couldn't reach the server" into the same null, and callers answer that
 * null by sending in clear — so every caller of this is one network failure
 * away from transmitting plaintext. It has no callers left; it is kept only
 * because the shape is referenced in tests and docs.
 *
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
    // A permission error here is expected until the rules below are deployed;
    // treat it as "peer not enrolled" so messaging degrades to plaintext
    // rather than breaking entirely.
    reportError(error, 'e2ee_fetch_peer_public_key');
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

/**
 * Whether every one of `peerUserIds` can read encrypted attachment bytes.
 *
 * Throws when any peer's capabilities cannot be determined. That is
 * deliberate and matches how the send path already treats an undeterminable
 * peer key: answering "I could not find out" with "then send it in the clear"
 * is how one flaky network turns into a permanently downgraded conversation.
 * The callers queue to the outbox and retry, so the cost of throwing is a
 * delayed attachment rather than an unencrypted one.
 *
 * A peer who is definitely *reachable* and definitely lacks the capability is
 * a different answer, and returns false — that is an older client, and
 * sending them ciphertext they cannot open would be worse than sending them
 * a photo the server can also see.
 */
export async function peersSupportEncryptedMedia(peerUserIds: string[]): Promise<boolean> {
  for (const peerUserId of peerUserIds) {
    const snap = await getDoc(doc(db, 'users', peerUserId, 'publicKeys', 'e2ee'));
    if (!snap.exists()) return false;
    const caps = snap.data()?.caps;
    if (!Array.isArray(caps) || !caps.includes(MEDIA_CAPABILITY)) return false;
  }
  return true;
}

const PEER_KEY_CACHE_PREFIX = 'e2ee_peer_key_v1_';

async function getCachedPeerKey(peerUserId: string): Promise<string | null> {
  return mmkvStorage.getItem(PEER_KEY_CACHE_PREFIX + peerUserId);
}

async function cachePeerKey(peerUserId: string, publicKeyBase64: string): Promise<void> {
  await mmkvStorage.setItem(PEER_KEY_CACHE_PREFIX + peerUserId, publicKeyBase64);
}

export type PeerKeyStatus =
  /**
   * Peer hasn't published a key — caller falls back to plaintext.
   *
   * This is a *positive* answer from the server, not an absence of one. Only
   * this status licenses sending in clear; see 'unavailable'.
   */
  | 'unenrolled'
  /** First time this device has ever seen a key for this peer. */
  | 'first-contact'
  | 'unchanged'
  /** The key differs from what this device saw last time — see below. */
  | 'changed'
  /**
   * Couldn't reach the server, so whether this peer has a key is unknown.
   *
   * Distinct from 'unenrolled' because conflating the two is a plaintext leak.
   * This used to return null, which callers read as "no key, send in clear" —
   * so any network failure silently disabled encryption for that message, and
   * a *sustained* failure (a captive portal, a blocked region) disabled it for
   * every message, with nothing shown to the user. Callers must treat this as
   * "try again later", never as "send it unsealed".
   */
  | 'unavailable';

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
  // Deliberately the throwing read, not fetchPeerPublicKey. That one maps every
  // failure onto null, which is indistinguishable from "this peer has no key" —
  // and the caller acts on that difference by sending in clear.
  let key: Uint8Array | null;
  try {
    key = await fetchPublishedKeyOrThrow(peerUserId);
  } catch (error) {
    reportError(error, 'e2ee_fetch_peer_public_key');
    return {key: null, status: 'unavailable'};
  }
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

/**
 * The device secret key, encoded as a 24-word recovery phrase the user can
 * write down and later type back in via restoreDeviceKeypairFromPhrase to
 * regain decryption after a reinstall — see e2ee.ts's "SINGLE DEVICE PER
 * USER" caveat, which this exists to soften. Generates the keypair first if
 * this device doesn't have one yet.
 */
export async function getRecoveryPhrase(userId: string): Promise<string> {
  const {secretKey} = await getOrCreateDeviceKeypair(userId);
  return secretKeyToMnemonic(secretKey);
}

/**
 * Whether this device has ever shown the user their recovery phrase. The
 * reveal UI is offered once — after that this flips permanently true, the
 * same "shown once, then never again" pattern as a cloud provider's secret
 * access key. The phrase itself keeps living in MMKV either way; this flag
 * only gates whether the app volunteers to display it again.
 */
export async function hasRevealedRecoveryPhrase(userId: string): Promise<boolean> {
  return (await mmkvStorage.getItem(RECOVERY_REVEALED_STORAGE_PREFIX + userId)) === '1';
}

export async function markRecoveryPhraseRevealed(userId: string): Promise<void> {
  await mmkvStorage.setItem(RECOVERY_REVEALED_STORAGE_PREFIX + userId, '1');
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
 * Imports a previously-revealed recovery phrase as this device's keypair,
 * so it can decrypt history that was sealed to that key.
 *
 * The derived public key must match what's currently published for this
 * account before it's accepted — otherwise a mistyped or stale phrase would
 * silently install the wrong key and strand this device exactly the way it
 * was trying to un-strand itself. `unenrolled` (nothing published yet) is
 * accepted too, so restoring still works for an account that never finished
 * enrolling a device.
 *
 * All-or-nothing: the new key is published *before* any local state changes,
 * so a failure at any step leaves this device exactly as it was rather than
 * switching it to a key whose public half never made it out — which would
 * strand it silently, with nothing to retry (getOrCreateDeviceKeypair only
 * publishes on first generation, never for an already-stored key).
 */
export async function restoreDeviceKeypairFromPhrase(
  userId: string,
  phrase: string,
  options: {
    /**
     * Accept a phrase whose key isn't the one currently published.
     *
     * The mismatch check below cannot tell a wrong phrase from a *superseded*
     * one, and the second case is the whole reason someone reaches this
     * screen: a device that enrolled later republished over the original key,
     * so the phrase that opens the stranded history is guaranteed not to match
     * what's on file. Refusing it unconditionally closed the only door out of
     * the exact situation recovery exists for.
     *
     * So the check stays on by default and the ambiguity is handed to the one
     * party who can resolve it — the user, who knows which device the phrase
     * came from — after being told what it costs (see RecoveryPhraseScreen).
     */
    allowKeyMismatch?: boolean;
  } = {},
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
    // Deliberately not treated as "unenrolled": that would waive the
    // mismatch check below and let a wrong phrase through on a bad
    // connection, which is the precise failure this check exists to stop.
    reportError(error, 'e2ee_restore_verify_failed');
    return {success: false, reason: 'verification-unavailable'};
  }

  if (
    !options.allowKeyMismatch &&
    publishedKey &&
    bytesToBase64(publishedKey) !== bytesToBase64(publicKey)
  ) {
    return {success: false, reason: 'key-mismatch'};
  }

  try {
    await publishPublicKey(userId, publicKey);
  } catch {
    // Already reported by publishPublicKey. No local state has been touched
    // yet, so the device keeps working with its existing key and the user
    // can simply retry.
    return {success: false, reason: 'publish-failed'};
  }

  await writeSecretKeyHex(SECRET_KEY_STORAGE_PREFIX + userId, userId, bytesToHex(secretKey));
  cached = {userId, keypair: {secretKey, publicKey}};
  keyGeneration += 1;
  return {success: true};
}

/** Test seam — drops the in-memory cache. */
export function _resetKeypairCache(): void {
  cached = null;
}
