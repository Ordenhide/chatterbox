import {createMMKV} from 'react-native-mmkv';

const logError = (context: string, error: unknown) => {
  if (__DEV__) {
    console.error(`[MMKV] ${context}:`, error);
  }
};

// Bootstrap store: unencrypted, holds only the per-device encryption key.
// The key itself is not sensitive data — it's a random token generated on first
// launch that protects the main store against offline extraction of the device.
const bootstrap = createMMKV({id: 'chatterbox-bootstrap'});

const ENC_KEY_STORAGE = 'enc_key';

function getOrCreateEncryptionKey(): string {
  const existing = bootstrap.getString(ENC_KEY_STORAGE);
  if (existing) return existing;

  // Generate a 32-byte random key as hex on first launch.
  const array = new Uint8Array(32);
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  const key = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
