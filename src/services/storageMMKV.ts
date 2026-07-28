import {createMMKV} from 'react-native-mmkv';
import {generateKeyHex} from './crypto';
import {reportError} from './telemetry';

const logError = (context: string, error: unknown) => {
  if (__DEV__) {
    console.error(`[MMKV] ${context}:`, error);
  }
};

// Bootstrap store: unencrypted, holds only the per-device encryption key.
// That key IS sensitive — it is the only thing protecting the cached message
// store against offline extraction from the device — so it must come from a
// cryptographically secure source.
const bootstrap = createMMKV({id: 'chatterbox-bootstrap'});

const ENC_KEY_STORAGE = 'enc_key';

/**
 * Best-effort entropy for the rare case generateKeyHex() itself is unavailable
 * (e.g. the native RNGetRandomValues module isn't linked into this build).
 * Weaker than a real CSPRNG, but this only runs on that failure path — see the
 * try/catch below — and reportError() surfaces it so the gap doesn't go
 * unnoticed. Mixing several independent Math.random() draws with a high-
 * resolution timestamp is meaningfully harder to predict than a single call,
 * even though it is still not cryptographically secure.
 */
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

function getOrCreateEncryptionKey(): string {
  const existing = bootstrap.getString(ENC_KEY_STORAGE);
  if (existing) return existing;

  // Previously this used Math.random() unconditionally, which is not a CSPRNG:
  // V8/Hermes seed a small internal state and an attacker who observes some
  // output can predict the rest, so the "32-byte" key carried far less real
  // entropy than its length suggested. generateKeyHex() draws from
  // crypto.getRandomValues, a real CSPRNG.
  //
  // That call depends on a native module, so it must not be allowed to crash
  // the whole app at module-load time — before React, and ErrorBoundary, even
  // mount. If it throws, fall back rather than hard-crashing; report it so a
  // genuine native-linking regression doesn't go unnoticed. This is a backstop
  // for an exceptional path, not the intended steady state.
  let key: string;
  try {
    key = generateKeyHex();
  } catch (error) {
    logError('generateKeyHex unavailable, using degraded fallback key', error);
    reportError(error, 'mmkv_encryption_key_fallback');
    key = fallbackWeakKeyHex();
  }

  // Existing installs keep their old key (the branch above) — rotating it would
  // orphan the encrypted store and wipe local history. New installs are secure
  // (or, on the failure path above, best-effort). Migrating existing installs
  // to a stronger key needs a re-encrypt pass, tracked separately.
  bootstrap.set(ENC_KEY_STORAGE, key);
  return key;
}

const storage = createMMKV({
  id: 'chatterbox-storage',
  encryptionKey: getOrCreateEncryptionKey(),
});

export const mmkvStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = storage.getString(key);
      return value ?? null;
    } catch (error) {
      logError(`getItem error for key "${key}"`, error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      storage.set(key, value);
    } catch (error) {
      logError(`setItem error for key "${key}"`, error);
      throw error;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      storage.delete(key);
    } catch (error) {
      logError(`removeItem error for key "${key}"`, error);
      throw error;
    }
  },

  getAllKeys: async (): Promise<string[]> => {
    try {
      return storage.getAllKeys();
    } catch (error) {
      logError('getAllKeys error', error);
      return [];
    }
  },

  clear: async (): Promise<void> => {
    try {
      storage.clearAll();
    } catch (error) {
      logError('clear error', error);
      throw error;
    }
  },

  getBoolean: (key: string): boolean | undefined => {
    try {
      return storage.getBoolean(key);
    } catch (error) {
      logError(`getBoolean error for key "${key}"`, error);
      return undefined;
    }
  },

  setBoolean: (key: string, value: boolean): void => {
    try {
      storage.set(key, value);
    } catch (error) {
      logError(`setBoolean error for key "${key}"`, error);
      throw error;
    }
  },

  getNumber: (key: string): number | undefined => {
    try {
      return storage.getNumber(key);
    } catch (error) {
      logError(`getNumber error for key "${key}"`, error);
      return undefined;
    }
  },

  setNumber: (key: string, value: number): void => {
    try {
      storage.set(key, value);
    } catch (error) {
      logError(`setNumber error for key "${key}"`, error);
      throw error;
    }
  },

  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    try {
      return keys.map(key => [key, storage.getString(key) ?? null]);
    } catch (error) {
      logError('multiGet error', error);
      return keys.map(key => [key, null]);
    }
  },

  multiSet: async (pairs: [string, string][]): Promise<void> => {
    try {
      pairs.forEach(([key, value]) => {
        storage.set(key, value);
      });
    } catch (error) {
      logError('multiSet error', error);
      throw error;
    }
  },

  multiRemove: async (keys: string[]): Promise<void> => {
    try {
      keys.forEach(key => storage.delete(key));
    } catch (error) {
      logError('multiRemove error', error);
      throw error;
    }
  },

  remove: (key: string): void => {
    try {
      storage.delete(key);
    } catch (error) {
      logError(`remove error for key "${key}"`, error);
    }
  },
};

export default mmkvStorage;
