import AsyncStorage from '@react-native-async-storage/async-storage';
import {decryptWithKey, encryptWithKey, generateKeyHex, hexToBytes} from './crypto';
import {reportError} from './telemetry';

/**
 * HarmonyOS implementation of the mmkvStorage interface. See ../../.ts for
 * the iOS/Android one and the shape both must match exactly.
 *
 * `react-native-mmkv` v4 depends on Nitro Modules, which has no HarmonyOS
 * port anywhere — not even an unofficial one. The only harmony port that
 * exists on GitHub (react-native-oh-library/react-native-mmkv) targets the
 * pre-Nitro v3 API, is unpublished to any package registry, and would mean
 * running a different major version of the library on this one platform. This
 * reimplements the same public interface on
 * `@react-native-async-storage/async-storage` instead, which does have a
 * harmony port (@react-native-oh-tpl/async-storage, already installed — see
 * harmony/README.md) and needs no version split.
 *
 * Two properties of the original this has to preserve deliberately, not
 * incidentally:
 *
 * ENCRYPTION AT REST. MMKV encrypts the "chatterbox-storage" file with a
 * per-device key; that store holds the E2EE secret key among other things, so
 * losing that protection on this platform would be a real regression, not a
 * cosmetic one. AsyncStorage has no native encryption, so every value is
 * encrypted here with the app's own XChaCha20-Poly1305 primitives
 * (services/crypto.ts — the same cipher e2ee.ts uses for messages) before it
 * reaches AsyncStorage, and decrypted on read. The key itself lives in a
 * separate, unencrypted AsyncStorage entry, exactly mirroring the original's
 * bootstrap/storage split — protecting the key by encrypting it with itself
 * would be circular, not more secure.
 *
 * SYNCHRONOUS READS. getBoolean/setBoolean/getNumber/setNumber/remove are
 * synchronous in the original, because MMKV is a memory-mapped file — the
 * native read has no bridge crossing to wait on. AsyncStorage's bridge call
 * is unavoidably async, so there is no way to make these genuinely
 * synchronous here. Instead an in-memory cache is populated once, as early as
 * possible (see bootstrap() below), and the sync methods read/write that
 * cache directly — writes land in the cache immediately (so a set-then-get in
 * the same tick is still correct) and persist to AsyncStorage in the
 * background.
 *
 * The unavoidable gap: between module load and bootstrap() resolving, a sync
 * read returns undefined for a key that does have a persisted value. Every
 * current call site already treats undefined as "not set yet" (`?? false`,
 * `?? 0`) — see privacyGuard.ts, appLock.ts and tutorial.ts — so the practical
 * effect is a brief window where security/privacy toggles read as their
 * default rather than their saved value on a cold start. appLock.ts's
 * `isAppLockEnabled`/`isBiometricsEnabled` are the two call sites where that
 * window actually matters; whoever verifies this on-device should check
 * those first.
 */

const logError = (context: string, error: unknown) => {
  if (__DEV__) {
    console.error(`[MMKV/harmony] ${context}:`, error);
  }
};

const BOOTSTRAP_KEY = '@chatterbox-bootstrap:enc_key';
const STORAGE_PREFIX = '@chatterbox-storage:';

/** Same weak-entropy last resort as the original — see its own comment. */
function fallbackWeakKeyHex(): string {
  let mixed = `${Date.now()}:${Math.random()}`;
  for (let i = 0; i < 8; i++) mixed += `:${Math.random()}:${Date.now()}`;
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < mixed.length; i++) {
    hash1 = (Math.imul(hash1, 31) + mixed.charCodeAt(i)) | 0;
    hash2 = (Math.imul(hash2, 131) + mixed.charCodeAt(mixed.length - 1 - i)) | 0;
  }
  const seed = `${hash1 >>> 0}${hash2 >>> 0}${Date.now()}${Math.random()}`.replace(/\D/g, '');
  return seed.padEnd(64, '0').slice(0, 64);
}

async function getOrCreateEncryptionKeyHex(): Promise<string> {
  const existing = await AsyncStorage.getItem(BOOTSTRAP_KEY);
  if (existing) return existing;

  let key: string;
  try {
    key = generateKeyHex();
  } catch (error) {
    logError('generateKeyHex unavailable, using degraded fallback key', error);
    reportError(error, 'mmkv_encryption_key_fallback');
    key = fallbackWeakKeyHex();
  }

  await AsyncStorage.setItem(BOOTSTRAP_KEY, key);
  return key;
}

// In-memory cache backing the synchronous methods. Populated by bootstrap()
// below; every entry is plaintext (decrypted), matching what MMKV's
// synchronous getters would have handed back directly from its
// memory-mapped, transparently-decrypted file.
const cache = new Map<string, string>();
let encryptionKeyBytes: Uint8Array | null = null;

/**
 * Kicked off once at module load, not awaited by anything — there is no
 * top-level await in this bundle. Sync methods below simply read whatever is
 * in `cache` at call time; before this resolves, that is "nothing yet",
 * which every call site already treats as "use the default".
 */
const ready: Promise<void> = (async () => {
  try {
    const keyHex = await getOrCreateEncryptionKeyHex();
    encryptionKeyBytes = hexToBytes(keyHex);

    const allKeys = await AsyncStorage.getAllKeys();
    const storageKeys = allKeys.filter(k => k.startsWith(STORAGE_PREFIX));
    if (storageKeys.length === 0) return;

    const pairs = await AsyncStorage.multiGet(storageKeys);
    for (const [prefixedKey, encrypted] of pairs) {
      if (encrypted == null) continue;
      const key = prefixedKey.slice(STORAGE_PREFIX.length);
      try {
        cache.set(key, decryptWithKey(encrypted, encryptionKeyBytes));
      } catch (error) {
        // One corrupt entry must not take down every other cached value —
        // skip it and let it read back as "not set" going forward, same
        // failure shape as a bad MMKV entry returning undefined.
        logError(`bootstrap: could not decrypt "${key}", skipping`, error);
      }
    }
  } catch (error) {
    logError('bootstrap failed', error);
    reportError(error, 'mmkv_harmony_bootstrap_failed');
  }
})();

function encryptValue(value: string): string {
  if (!encryptionKeyBytes) throw new Error('encryption key not ready');
  return encryptWithKey(value, encryptionKeyBytes);
}

/** Writes through to AsyncStorage in the background; errors are reported, not thrown — callers of the synchronous setters have no promise to reject. */
function persistAsync(key: string, value: string) {
  ready
    .then(() => AsyncStorage.setItem(STORAGE_PREFIX + key, encryptValue(value)))
    .catch(error => {
      logError(`background persist failed for key "${key}"`, error);
      reportError(error, 'mmkv_harmony_persist_failed');
    });
}

export const mmkvStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      await ready;
      const encrypted = await AsyncStorage.getItem(STORAGE_PREFIX + key);
      if (encrypted == null) return null;
      return decryptWithKey(encrypted, encryptionKeyBytes!);
    } catch (error) {
      logError(`getItem error for key "${key}"`, error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await ready;
      await AsyncStorage.setItem(STORAGE_PREFIX + key, encryptValue(value));
      cache.set(key, value);
    } catch (error) {
      logError(`setItem error for key "${key}"`, error);
      throw error;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await ready;
      await AsyncStorage.removeItem(STORAGE_PREFIX + key);
      cache.delete(key);
    } catch (error) {
      logError(`removeItem error for key "${key}"`, error);
      throw error;
    }
  },

  getAllKeys: async (): Promise<string[]> => {
    try {
      await ready;
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys.filter(k => k.startsWith(STORAGE_PREFIX)).map(k => k.slice(STORAGE_PREFIX.length));
    } catch (error) {
      logError('getAllKeys error', error);
      return [];
    }
  },

  clear: async (): Promise<void> => {
    try {
      await ready;
      const allKeys = await AsyncStorage.getAllKeys();
      const storageKeys = allKeys.filter(k => k.startsWith(STORAGE_PREFIX));
      await AsyncStorage.multiRemove(storageKeys);
      cache.clear();
    } catch (error) {
      logError('clear error', error);
      throw error;
    }
  },

  getBoolean: (key: string): boolean | undefined => {
    try {
      const raw = cache.get(key);
      return raw === undefined ? undefined : raw === 'true';
    } catch (error) {
      logError(`getBoolean error for key "${key}"`, error);
      return undefined;
    }
  },

  setBoolean: (key: string, value: boolean): void => {
    try {
      const raw = value ? 'true' : 'false';
      cache.set(key, raw);
      persistAsync(key, raw);
    } catch (error) {
      logError(`setBoolean error for key "${key}"`, error);
      throw error;
    }
  },

  getNumber: (key: string): number | undefined => {
    try {
      const raw = cache.get(key);
      if (raw === undefined) return undefined;
      const n = Number(raw);
      return Number.isNaN(n) ? undefined : n;
    } catch (error) {
      logError(`getNumber error for key "${key}"`, error);
      return undefined;
    }
  },

  setNumber: (key: string, value: number): void => {
    try {
      const raw = String(value);
      cache.set(key, raw);
      persistAsync(key, raw);
    } catch (error) {
      logError(`setNumber error for key "${key}"`, error);
      throw error;
    }
  },

  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    try {
      await ready;
      const pairs = await AsyncStorage.multiGet(keys.map(k => STORAGE_PREFIX + k));
      return pairs.map(([prefixedKey, encrypted]) => {
        const key = prefixedKey.slice(STORAGE_PREFIX.length);
        if (encrypted == null) return [key, null];
        try {
          return [key, decryptWithKey(encrypted, encryptionKeyBytes!)];
        } catch (error) {
          logError(`multiGet: could not decrypt "${key}"`, error);
          return [key, null];
        }
      });
    } catch (error) {
      logError('multiGet error', error);
      return keys.map(key => [key, null]);
    }
  },

  multiSet: async (pairs: [string, string][]): Promise<void> => {
    try {
      await ready;
      const encrypted: [string, string][] = pairs.map(([key, value]) => [
        STORAGE_PREFIX + key,
        encryptValue(value),
      ]);
      await AsyncStorage.multiSet(encrypted);
      pairs.forEach(([key, value]) => cache.set(key, value));
    } catch (error) {
      logError('multiSet error', error);
      throw error;
    }
  },

  multiRemove: async (keys: string[]): Promise<void> => {
    try {
      await ready;
      await AsyncStorage.multiRemove(keys.map(k => STORAGE_PREFIX + k));
      keys.forEach(key => cache.delete(key));
    } catch (error) {
      logError('multiRemove error', error);
      throw error;
    }
  },

  remove: (key: string): void => {
    try {
      cache.delete(key);
      ready
        .then(() => AsyncStorage.removeItem(STORAGE_PREFIX + key))
        .catch(error => logError(`background remove failed for key "${key}"`, error));
    } catch (error) {
      logError(`remove error for key "${key}"`, error);
    }
  },
};

export default mmkvStorage;
