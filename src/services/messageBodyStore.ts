/**
 * Local plaintext for messages this device has already decrypted.
 *
 * ## Why a message store has to exist at all
 *
 * The ciphertext in Firestore is not a substitute for one. A stateless
 * envelope (services/e2ee.ts) can be opened again on every read, so it was
 * possible to pretend the server held the messages and the client merely
 * rendered them. The ratchet ends that: a message key is destroyed as it is
 * used, so an envelope opens exactly once (see the "history is not re-readable"
 * tests in ratchet/__tests__/doubleRatchet.test.ts). Re-decrypting a thread
 * already shown fails for everything already read.
 *
 * That is forward secrecy working, and it is not negotiable — but it means the
 * client is now the only place a conversation's history can live. Every real
 * ratchet messenger reaches the same conclusion for the same reason.
 *
 * ## Why it also makes chats open faster
 *
 * The old path decrypted only inside the Firestore snapshot callback, while
 * the offline cache it rendered first held ciphertext. So every sealed message
 * sat at "🔒 …" for a full network round trip, even though the bytes needed to
 * read it had been on disk the whole time. Seeding from here removes the
 * network from the critical path entirely: a returning reader sees text
 * immediately, and the snapshot only adds what is new.
 *
 * ## Where it lives
 *
 * Same shape as ratchetSessionStore.ts, and for the same reason set out in its
 * header: one 32-byte key in the OS key store, every blob encrypted with it and
 * written to MMKV. MMKV's own encryption key can still fall back to the legacy
 * unencrypted bootstrap store on a build without the native key store, so
 * "MMKV is encrypted" is not by itself a strong enough claim for message text.
 * Encrypting here makes it one.
 *
 * The two stores deliberately use separate key-store entries. They hold
 * different things with different lifetimes — losing session state breaks
 * future messages, losing bodies loses history — and a single key would mean
 * one compromise reaches both.
 *
 * ## What is deliberately *not* here
 *
 * Bodies only: no attachments. Decrypted media are large, already have a home
 * in mediaVault.ts, and re-fetch from the network on demand — putting them here
 * would trade a bounded text cache for an unbounded binary one.
 */
import {mmkvStorage} from './storageMMKV';
import {getSecret, isSecureStoreAvailable, removeSecret, setSecretVerified} from './secureKeyStore';
import {decryptWithKey, encryptWithKey, generateKeyHex, hexToBytes} from './crypto';
import {reportError} from './telemetry';

const BODY_PREFIX = 'message_bodies_v1_';
const BODY_KEY_STORAGE_PREFIX = 'message_bodies_key_v1_';
const BODY_KEY_SERVICE_PREFIX = 'com.chatterbox.messageBodies.key';

/**
 * Bodies retained per conversation.
 *
 * Comfortably more than the 50-message window a chat opens with, so scrolling
 * back a few pages still comes from disk, and far short of anything that would
 * make the encrypt-and-write cost noticeable. Oldest-first eviction: a Map
 * preserves insertion order, and messages are inserted oldest-first.
 */
export const MAX_BODIES_PER_CHAT = 400;

function bodyKeyService(userId: string): string {
  return `${BODY_KEY_SERVICE_PREFIX}.${userId}`;
}

/** Exported for tests, which need a cold cache per case. */
export function _bodyStorageKey(userId: string, chatId: string): string {
  return `${BODY_PREFIX}${userId}_${chatId}`;
}

// ---- at-rest encryption ----------------------------------------------------

const cachedBodyKeys = new Map<string, Uint8Array>();

/** Exported for tests. */
export function _resetBodyKeyCache(): void {
  cachedBodyKeys.clear();
}

/**
 * The key every body blob is encrypted with, created on first use.
 *
 * Mirrors ratchetSessionStore's sessionEncryptionKey, including its fallback:
 * on a build where the native key store is not linked this degrades to "no
 * better than MMKV" rather than refusing to store anything, because the
 * alternative — no local history at all — breaks the feature outright.
 */
async function bodyEncryptionKey(userId: string): Promise<Uint8Array> {
  const cached = cachedBodyKeys.get(userId);
  if (cached) return cached;

  const service = bodyKeyService(userId);
  const storageKey = BODY_KEY_STORAGE_PREFIX + userId;

  let hex: string | null = null;
  if (isSecureStoreAvailable()) hex = await getSecret(service);
  if (!hex) {
    const fromMmkv = await mmkvStorage.getItem(storageKey);
    if (fromMmkv) {
      hex = fromMmkv;
      // Only drop the MMKV copy once the key store has read the value back.
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
  cachedBodyKeys.set(userId, key);
  return key;
}

// ---- public API ------------------------------------------------------------

/**
 * Every body this device has stored for `chatId`, keyed by message id.
 *
 * Returns an empty map rather than throwing on any failure. A body cache that
 * cannot be read is a slower chat, not a broken one — the snapshot path still
 * decrypts whatever it can. Unreadable state is reported rather than swallowed
 * so it does not become invisible, but never surfaced to the reader.
 */
export async function loadBodies(userId: string, chatId: string): Promise<Map<string, string>> {
  if (!userId || !chatId) return new Map();
  try {
    const stored = await mmkvStorage.getItem(_bodyStorageKey(userId, chatId));
    if (!stored) return new Map();
    const key = await bodyEncryptionKey(userId);
    const raw = JSON.parse(decryptWithKey(stored, key)) as [string, string][];
    if (!Array.isArray(raw)) return new Map();
    // Filter defensively: a hand-edited or partially written blob must not put
    // non-strings into the render path.
    return new Map(
      raw.filter(
        entry =>
          Array.isArray(entry) &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'string',
      ),
    );
  } catch (error) {
    reportError(error, 'message_bodies_unreadable');
    return new Map();
  }
}

/**
 * Merges `bodies` into what is already stored for `chatId`.
 *
 * A merge rather than a replace: the caller only ever holds the window it has
 * on screen, and replacing would discard the scrollback it cannot see. Existing
 * entries win over new ones with the same id — a body already recorded came
 * from a successful decrypt, and the ratchet may not be able to produce it a
 * second time, so it must never be overwritten by a later failure placeholder.
 */
export async function saveBodies(
  userId: string,
  chatId: string,
  bodies: Map<string, string> | Iterable<[string, string]>,
): Promise<void> {
  if (!userId || !chatId) return;
  const incoming = bodies instanceof Map ? bodies : new Map(bodies);
  if (incoming.size === 0) return;
  try {
    const merged = await loadBodies(userId, chatId);
    let changed = false;
    for (const [id, text] of incoming) {
      if (typeof text !== 'string' || merged.has(id)) continue;
      merged.set(id, text);
      changed = true;
    }
    if (!changed) return;

    while (merged.size > MAX_BODIES_PER_CHAT) {
      const oldest = merged.keys().next();
      if (oldest.done) break;
      merged.delete(oldest.value);
    }

    const key = await bodyEncryptionKey(userId);
    await mmkvStorage.setItem(
      _bodyStorageKey(userId, chatId),
      encryptWithKey(JSON.stringify([...merged]), key),
    );
  } catch (error) {
    reportError(error, 'message_bodies_write_failed');
  }
}

/**
 * Removes every stored body for `userId`, and the key that encrypted them.
 *
 * Called on sign-out as well as account deletion. Sign-out matters most: the
 * next person to use the phone must not be one tap from the previous account's
 * message history, and unlike the ciphertext caches this one is readable
 * without ever reaching the network.
 */
export async function clearBodies(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const prefix = `${BODY_PREFIX}${userId}_`;
    const keys = (await mmkvStorage.getAllKeys()).filter(k => k.startsWith(prefix));
    for (const key of keys) {
      await mmkvStorage.removeItem(key);
    }
    await mmkvStorage.removeItem(BODY_KEY_STORAGE_PREFIX + userId);
    if (isSecureStoreAvailable()) await removeSecret(bodyKeyService(userId));
  } catch (error) {
    reportError(error, 'message_bodies_clear_failed');
  } finally {
    // Dropped even if the wipe failed partway: holding the key in memory after
    // a sign-out is the thing this is trying to avoid.
    cachedBodyKeys.delete(userId);
  }
}
