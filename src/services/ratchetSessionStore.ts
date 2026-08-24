/**
 * Durable storage for ratchet state — phase 2b of the forward-secrecy work.
 *
 * Two problems, both of which will silently destroy conversations if got
 * wrong, and neither of which is obvious from the crypto layer.
 *
 * ## 1. Concurrent read-modify-write
 *
 * Every ratchet operation is read state → transform → write state. Firestore
 * listeners deliver messages in bursts, so two decrypts can be in flight at
 * once. Both would read the same stored session, and the second write would
 * land on top of the first — discarding one chain advance. The message whose
 * advance was lost is then undecryptable, and so is everything after it in
 * that chain.
 *
 * JavaScript being single-threaded does not help: the hazard is the `await`
 * between the read and the write, not parallelism. So access to each session
 * is serialized through a per-key promise chain, and `withSession` exists so
 * the safe pattern is also the shortest one to write.
 *
 * ## 2. Where the state lives
 *
 * A session contains live chain keys. Whoever holds them can decrypt the rest
 * of that chain, and any skipped keys it carries open specific messages
 * outright. That makes session state roughly as sensitive as the identity key
 * — which lives in the OS key store.
 *
 * Sessions cannot go there directly: there is one per conversation, and key
 * stores are meant for a handful of small secrets, not an unbounded and
 * frequently-rewritten set. Instead, a single 32-byte *session encryption key*
 * is held in the key store, and each session is encrypted with it and written
 * to MMKV. One key-store entry, any number of sessions, and the plaintext
 * never touches the MMKV store — whose own encryption key sits in an
 * unencrypted bootstrap store (see storageMMKV.ts), which is exactly why
 * relying on MMKV alone would not have been good enough here.
 */
import {mmkvStorage} from './storageMMKV';
import {getSecret, isSecureStoreAvailable, removeSecret, setSecretVerified} from './secureKeyStore';
import {decryptWithKey, encryptWithKey, generateKeyHex, hexToBytes} from './crypto';
import {reportError} from './telemetry';
import {
  deserializeSession,
  serializeSession,
  type RatchetSession,
} from './ratchet/doubleRatchet';
import {
  deserializeReceiverState,
  deserializeSenderKeyState,
  serializeReceiverState,
  serializeSenderKeyState,
  type SenderKeyReceiverState,
  type SenderKeyState,
} from './ratchet/senderKeys';

const SESSION_PREFIX = 'ratchet_session_v1_';
const SENDER_KEY_PREFIX = 'ratchet_sender_key_v1_';
const RECEIVER_KEY_PREFIX = 'ratchet_receiver_key_v1_';
const SESSION_KEY_STORAGE_PREFIX = 'ratchet_session_key_v1_';
const SESSION_KEY_SERVICE_PREFIX = 'com.chatterbox.ratchet.sessionKey';

function sessionKeyService(userId: string): string {
  return `${SESSION_KEY_SERVICE_PREFIX}.${userId}`;
}

// ---- serialized access -----------------------------------------------------

const chains = new Map<string, Promise<unknown>>();

/**
 * Runs `fn` after every operation already queued for `key`.
 *
 * Errors are deliberately not propagated into the chain: one failed decrypt
 * must not wedge every later operation on that session.
 */
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, settled);
  // Drop the entry once nothing else has queued behind it, so the map does not
  // grow for the lifetime of the process.
  settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });
  return run;
}

// ---- at-rest encryption ----------------------------------------------------

const cachedSessionKeys = new Map<string, Uint8Array>();

/**
 * The key every session blob is encrypted with, created on first use.
 *
 * Kept in the OS key store, with the same MMKV fallback as every other secret
 * here: on a build where the native module is not linked, this degrades to
 * "no better than MMKV" rather than losing the sessions.
 */
async function sessionEncryptionKey(userId: string): Promise<Uint8Array> {
  const cached = cachedSessionKeys.get(userId);
  if (cached) return cached;

  const service = sessionKeyService(userId);
  const storageKey = SESSION_KEY_STORAGE_PREFIX + userId;

  let hex: string | null = null;
  if (isSecureStoreAvailable()) hex = await getSecret(service);
  if (!hex) {
    const fromMmkv = await mmkvStorage.getItem(storageKey);
    if (fromMmkv) {
      hex = fromMmkv;
      // Same migration shape as the identity key: only drop the MMKV copy once
      // the key store has read the value back.
      if (isSecureStoreAvailable() && (await setSecretVerified(service, fromMmkv))) {
        await mmkvStorage.removeItem(storageKey);
      }
    }
  }

  if (!hex) {
    hex = generateKeyHex();
    if (!(isSecureStoreAvailable() && (await setSecretVerified(service, hex)))) {
      await mmkvStorage.setItem(storageKey, hex);
    }
  }

  const key = hexToBytes(hex);
  cachedSessionKeys.set(userId, key);
  return key;
}

async function writeEncrypted(userId: string, storageKey: string, plaintext: string): Promise<void> {
  const key = await sessionEncryptionKey(userId);
  await mmkvStorage.setItem(storageKey, encryptWithKey(plaintext, key));
}

/**
 * Returns null both when nothing is stored and when what is stored cannot be
 * read.
 *
 * Unreadable state is reported rather than swallowed, because the consequence
 * is severe and otherwise invisible: the caller will establish a fresh session,
 * which the peer knows nothing about, and messages already in flight under the
 * old one stay undecryptable until both sides have re-handshaked. Deleting the
 * blob here instead would hide the same outcome behind a "clean" state.
 */
async function readEncrypted(userId: string, storageKey: string): Promise<string | null> {
  const stored = await mmkvStorage.getItem(storageKey);
  if (!stored) return null;
  try {
    const key = await sessionEncryptionKey(userId);
    return decryptWithKey(stored, key);
  } catch (error) {
    reportError(error, 'ratchet_session_unreadable');
    return null;
  }
}

// ---- pairwise sessions -----------------------------------------------------

function sessionKey(userId: string, chatId: string, peerUid: string): string {
  return `${SESSION_PREFIX}${userId}_${chatId}_${peerUid}`;
}

export async function loadSession(
  userId: string,
  chatId: string,
  peerUid: string,
): Promise<RatchetSession | null> {
  const raw = await readEncrypted(userId, sessionKey(userId, chatId, peerUid));
  if (!raw) return null;
  try {
    return deserializeSession(raw);
  } catch (error) {
    reportError(error, 'ratchet_session_undeserializable');
    return null;
  }
}

export async function saveSession(
  userId: string,
  chatId: string,
  peerUid: string,
  session: RatchetSession,
): Promise<void> {
  await writeEncrypted(userId, sessionKey(userId, chatId, peerUid), serializeSession(session));
}

export async function deleteSession(userId: string, chatId: string, peerUid: string): Promise<void> {
  await mmkvStorage.removeItem(sessionKey(userId, chatId, peerUid));
}

/**
 * Reads a session, hands it to `fn`, and stores whatever `fn` returns — with
 * every other operation on the same session held back for the duration.
 *
 * This is the only safe way to advance a ratchet, and every caller should use
 * it rather than load/save directly. `fn` returning a session commits it;
 * returning null (or throwing) leaves the stored state exactly as it was,
 * which is what makes a failed decrypt harmless.
 */
export async function withSession<T>(
  userId: string,
  chatId: string,
  peerUid: string,
  fn: (session: RatchetSession | null) => Promise<{session: RatchetSession | null; result: T}>,
): Promise<T> {
  return withLock(sessionKey(userId, chatId, peerUid), async () => {
    const current = await loadSession(userId, chatId, peerUid);
    const {session, result} = await fn(current);
    if (session) await saveSession(userId, chatId, peerUid, session);
    return result;
  });
}

// ---- group sender keys -----------------------------------------------------

function ownSenderKeyKey(userId: string, chatId: string): string {
  return `${SENDER_KEY_PREFIX}${userId}_${chatId}`;
}

function receiverKeyKey(userId: string, chatId: string, senderUid: string): string {
  return `${RECEIVER_KEY_PREFIX}${userId}_${chatId}_${senderUid}`;
}

export async function loadOwnSenderKey(
  userId: string,
  chatId: string,
): Promise<SenderKeyState | null> {
  const raw = await readEncrypted(userId, ownSenderKeyKey(userId, chatId));
  if (!raw) return null;
  try {
    return deserializeSenderKeyState(raw);
  } catch (error) {
    reportError(error, 'ratchet_sender_key_undeserializable');
    return null;
  }
}

export async function saveOwnSenderKey(
  userId: string,
  chatId: string,
  state: SenderKeyState,
): Promise<void> {
  await writeEncrypted(userId, ownSenderKeyKey(userId, chatId), serializeSenderKeyState(state));
}

/** Serialized the same way as pairwise sessions, and for the same reason:
 * every send advances the chain, and a lost advance breaks the chain. */
export async function withOwnSenderKey<T>(
  userId: string,
  chatId: string,
  fn: (state: SenderKeyState | null) => Promise<{state: SenderKeyState | null; result: T}>,
): Promise<T> {
  return withLock(ownSenderKeyKey(userId, chatId), async () => {
    const current = await loadOwnSenderKey(userId, chatId);
    const {state, result} = await fn(current);
    if (state) await saveOwnSenderKey(userId, chatId, state);
    return result;
  });
}

export async function loadReceiverKey(
  userId: string,
  chatId: string,
  senderUid: string,
): Promise<SenderKeyReceiverState | null> {
  const raw = await readEncrypted(userId, receiverKeyKey(userId, chatId, senderUid));
  if (!raw) return null;
  try {
    return deserializeReceiverState(raw);
  } catch (error) {
    reportError(error, 'ratchet_receiver_key_undeserializable');
    return null;
  }
}

export async function saveReceiverKey(
  userId: string,
  chatId: string,
  senderUid: string,
  state: SenderKeyReceiverState,
): Promise<void> {
  await writeEncrypted(userId, receiverKeyKey(userId, chatId, senderUid), serializeReceiverState(state));
}

export async function withReceiverKey<T>(
  userId: string,
  chatId: string,
  senderUid: string,
  fn: (
    state: SenderKeyReceiverState | null,
  ) => Promise<{state: SenderKeyReceiverState | null; result: T}>,
): Promise<T> {
  return withLock(receiverKeyKey(userId, chatId, senderUid), async () => {
    const current = await loadReceiverKey(userId, chatId, senderUid);
    const {state, result} = await fn(current);
    if (state) await saveReceiverKey(userId, chatId, senderUid, state);
    return result;
  });
}

// ---- teardown --------------------------------------------------------------

/**
 * Removes every stored session and the key protecting them.
 *
 * Called from account deletion. The key-store entry is the part that matters:
 * MMKV is wiped wholesale there, but a key left in the Keychain would outlive
 * the account — the same bug already fixed once for the identity key.
 */
export async function clearRatchetSessions(userId: string): Promise<void> {
  cachedSessionKeys.delete(userId);
  await removeSecret(sessionKeyService(userId));
  await mmkvStorage.removeItem(SESSION_KEY_STORAGE_PREFIX + userId);

  const keys = await mmkvStorage.getAllKeys();
  const mine = keys.filter(
    k =>
      k.startsWith(`${SESSION_PREFIX}${userId}_`) ||
      k.startsWith(`${SENDER_KEY_PREFIX}${userId}_`) ||
      k.startsWith(`${RECEIVER_KEY_PREFIX}${userId}_`),
  );
  await Promise.all(mine.map(k => mmkvStorage.removeItem(k)));
}

/** Drops a chat's group state — used when membership changes force rotation. */
export async function clearGroupState(userId: string, chatId: string): Promise<void> {
  const keys = await mmkvStorage.getAllKeys();
  const mine = keys.filter(
    k =>
      k === ownSenderKeyKey(userId, chatId) ||
      k.startsWith(`${RECEIVER_KEY_PREFIX}${userId}_${chatId}_`),
  );
  await Promise.all(mine.map(k => mmkvStorage.removeItem(k)));
}

export function _resetSessionKeyCache(): void {
  cachedSessionKeys.clear();
  chains.clear();
}

/** Exposed so tests can assert what is actually written to disk. */
export function _sessionStorageKey(userId: string, chatId: string, peerUid: string): string {
  return sessionKey(userId, chatId, peerUid);
}
