/**
 * The store-opening and key-migration logic, which had no tests and is the
 * code in this app with the worst failure mode: a store whose encryption key
 * is lost is not degraded, it is unreadable, and it takes every cached message
 * with it.
 *
 * The MMKV mock therefore models encryption rather than pretending it away —
 * a store opened with the wrong key reads nothing. Without that, every test
 * here would pass against an implementation that re-keys to a value it can
 * never retrieve, which is precisely the bug worth catching.
 */
const mockStores = new Map<string, {data: Map<string, string | number | boolean>; key?: string}>();
const mockKeychain = {available: true, secrets: new Map<string, string>(), writesSucceed: true};

jest.mock('react-native-mmkv', () => ({
  createMMKV: ({id, encryptionKey}: {id: string; encryptionKey?: string}) => {
    let backing = mockStores.get(id);
    if (!backing) {
      backing = {data: new Map(), key: encryptionKey};
      mockStores.set(id, backing);
    }
    // Opening with the wrong key yields a store that reads nothing, which is
    // the real consequence of a key and a store file disagreeing. Without
    // this, every test here would pass against an implementation that records
    // a key which opens nothing.
    const readable = () => backing!.key === encryptionKey;
    return {
      getString: (k: string) => (readable() ? (backing!.data.get(k) as string | undefined) : undefined),
      getBoolean: (k: string) =>
        readable() ? (backing!.data.get(k) as boolean | undefined) : undefined,
      getNumber: (k: string) => (readable() ? (backing!.data.get(k) as number | undefined) : undefined),
      contains: (k: string) => (readable() ? backing!.data.has(k) : false),
      set: (k: string, v: string | number | boolean) => backing!.data.set(k, v),
      remove: (k: string) => backing!.data.delete(k),
      getAllKeys: () => (readable() ? [...backing!.data.keys()] : []),
      clearAll: () => backing!.data.clear(),
      // A tripwire, not a stub. The implementation deliberately never
      // re-encrypts: changing the store's key and the record of that key are
      // two non-atomic steps, and a process killed between them leaves an
      // unopenable file. If a recrypt is ever reintroduced, this fails with
      // the reason rather than passing quietly.
      recrypt: () => {
        throw new Error(
          'storageMMKV must not re-encrypt the store: the key and the record of ' +
            'it cannot be changed atomically, so an interrupted rotation leaves a ' +
            'store no key opens. Migrate the existing key instead.',
        );
      },
    };
  },
}));

jest.mock('../secureKeyStore', () => ({
  isSecureStoreAvailable: () => mockKeychain.available,
  getSecret: async (service: string) => mockKeychain.secrets.get(service) ?? null,
  setSecretVerified: async (service: string, secret: string) => {
    if (!mockKeychain.writesSucceed) return false;
    mockKeychain.secrets.set(service, secret);
    return true;
  },
  removeSecret: async (service: string) => {
    mockKeychain.secrets.delete(service);
  },
}));

jest.mock('../errorLog', () => ({reportError: jest.fn()}));

const SECURE = 'chatterbox-storage';
const PREFS = 'chatterbox-prefs';
const BOOTSTRAP = 'chatterbox-bootstrap';
const KEY_SERVICE = 'com.chatterbox.mmkv.encryptionKey';

/** Imports the module fresh, so its module-load migration runs against the
 * state each test has just set up. */
function loadModule() {
  let mod!: typeof import('../storageMMKV');
  jest.isolateModules(() => {
    mod = require('../storageMMKV');
  });
  return mod;
}

function seedStore(id: string, key: string | undefined, entries: Record<string, unknown> = {}) {
  mockStores.set(id, {data: new Map(Object.entries(entries)) as Map<string, never>, key});
}

function storeData(id: string) {
  return mockStores.get(id)?.data;
}

beforeEach(() => {
  mockStores.clear();
  mockKeychain.available = true;
  mockKeychain.writesSucceed = true;
  mockKeychain.secrets.clear();
});

describe('fresh install', () => {
  it('puts the encryption key in the key store and not in the bootstrap store', async () => {
    const {mmkvStorage} = loadModule();
    await mmkvStorage.setItem('cached_messages', 'hello');

    expect(mockKeychain.secrets.get(KEY_SERVICE)).toMatch(/^[0-9a-f]{64}$/);
    // The entire point: the key is not lying next to the data it protects.
    expect(storeData(BOOTSTRAP)?.get('enc_key')).toBeUndefined();
  });

  it('opens a store the written data can be read back from', async () => {
    const {mmkvStorage} = loadModule();
    await mmkvStorage.setItem('k', 'v');
    expect(await mmkvStorage.getItem('k')).toBe('v');
  });
});

describe('upgrading an install that has data under the bootstrap key', () => {
  const LEGACY_KEY = 'a'.repeat(64);

  function seedLegacyInstall(entries: Record<string, unknown> = {}) {
    seedStore(BOOTSTRAP, undefined, {enc_key: LEGACY_KEY});
    seedStore(SECURE, LEGACY_KEY, entries);
  }

  it('keeps the cached data readable after re-keying', async () => {
    // The failure this is really guarding: a migration that loses the key
    // takes every cached message with it, unrecoverably.
    seedLegacyInstall({cached_messages: 'important history'});
    const {mmkvStorage} = loadModule();

    expect(await mmkvStorage.getItem('cached_messages')).toBe('important history');
  });

  it('adopts the existing key rather than generating a new one', async () => {
    // Moving the key verbatim is what makes this migration windowless. A new
    // key would have to be recorded and the store re-encrypted as two separate
    // steps, and a process killed between them leaves a store encrypted under
    // one key and a record naming another — an unopenable file.
    seedLegacyInstall({k: 'v'});
    const {mmkvStorage} = loadModule();
    await mmkvStorage.getItem('k');

    expect(mockKeychain.secrets.get(KEY_SERVICE)).toBe(LEGACY_KEY);
    expect(storeData(BOOTSTRAP)?.get('enc_key')).toBeUndefined();
    expect(mockStores.get(SECURE)?.key).toBe(LEGACY_KEY);
  });

  it('survives being killed between the key store write and the delete', async () => {
    // The one interruptible moment. Both copies hold the same value, so the
    // next launch opens the store correctly and tidies up.
    seedLegacyInstall({k: 'v'});
    mockKeychain.secrets.set(KEY_SERVICE, LEGACY_KEY);

    const {mmkvStorage} = loadModule();
    expect(await mmkvStorage.getItem('k')).toBe('v');
    expect(storeData(BOOTSTRAP)?.get('enc_key')).toBeUndefined();
  });

  it('copies preferences into the unencrypted store at module load', async () => {
    // Synchronously, and before anything awaits: a preference that read as its
    // default until an async migration finished would silently turn screenshot
    // protection off for the first moments after an upgrade.
    seedLegacyInstall({screenshot_protection: true, auto_lock_delay: 30});
    const {mmkvStorage} = loadModule();

    expect(mmkvStorage.getBoolean('screenshot_protection')).toBe(true);
    expect(mmkvStorage.getNumber('auto_lock_delay')).toBe(30);
  });

  it('does not overwrite a preference the user has already changed', () => {
    seedLegacyInstall({screenshot_protection: true});
    seedStore(PREFS, undefined, {screenshot_protection: false});
    const {mmkvStorage} = loadModule();

    expect(mmkvStorage.getBoolean('screenshot_protection')).toBe(false);
  });

  it('leaves the legacy preference entries in place rather than moving them', () => {
    seedLegacyInstall({screenshot_protection: true});
    loadModule();
    expect(storeData(SECURE)?.get('screenshot_protection')).toBe(true);
  });

  it('does not copy secrets into the unencrypted preferences store', async () => {
    seedLegacyInstall({cached_messages: 'secret', app_lock_pin: 'hash', typing_indicator: true});
    loadModule();

    expect(storeData(PREFS)?.has('cached_messages')).toBe(false);
    expect(storeData(PREFS)?.has('app_lock_pin')).toBe(false);
    expect(storeData(PREFS)?.get('typing_indicator')).toBe(true);
  });
});

describe('second launch, already migrated', () => {
  it('opens straight from the key store', async () => {
    const key = 'b'.repeat(64);
    mockKeychain.secrets.set(KEY_SERVICE, key);
    seedStore(SECURE, key, {k: 'v'});
    seedStore(BOOTSTRAP, undefined, {});

    const {mmkvStorage} = loadModule();
    expect(await mmkvStorage.getItem('k')).toBe('v');
  });

  it('clears a bootstrap key left behind by an interrupted migration', async () => {
    // Re-key succeeded, then the app died before the delete. The stale copy
    // no longer opens anything, but it is the exact thing this change exists
    // to remove, so it must not wait for some later launch.
    const key = 'b'.repeat(64);
    mockKeychain.secrets.set(KEY_SERVICE, key);
    seedStore(SECURE, key, {k: 'v'});
    seedStore(BOOTSTRAP, undefined, {enc_key: 'c'.repeat(64)});

    const {mmkvStorage} = loadModule();
    await mmkvStorage.getItem('k');

    expect(storeData(BOOTSTRAP)?.get('enc_key')).toBeUndefined();
  });
});

describe('when the key store cannot be used', () => {
  it('falls back to the bootstrap key, exactly as before it existed', async () => {
    mockKeychain.available = false;
    const {mmkvStorage} = loadModule();
    await mmkvStorage.setItem('k', 'v');

    expect(storeData(BOOTSTRAP)?.get('enc_key')).toMatch(/^[0-9a-f]{64}$/);
    expect(await mmkvStorage.getItem('k')).toBe('v');
  });

  it('keeps an existing install readable with no key store', async () => {
    mockKeychain.available = false;
    const legacy = 'a'.repeat(64);
    seedStore(BOOTSTRAP, undefined, {enc_key: legacy});
    seedStore(SECURE, legacy, {k: 'v'});

    const {mmkvStorage} = loadModule();
    expect(await mmkvStorage.getItem('k')).toBe('v');
  });

  it('does not re-key when the key store write cannot be read back', async () => {
    // Writing succeeded but reading returned something else. Re-keying to a
    // value we cannot retrieve makes the store unopenable on the next launch,
    // so the old key has to stay.
    mockKeychain.writesSucceed = false;
    const legacy = 'a'.repeat(64);
    seedStore(BOOTSTRAP, undefined, {enc_key: legacy});
    seedStore(SECURE, legacy, {k: 'v'});

    const {mmkvStorage} = loadModule();
    expect(await mmkvStorage.getItem('k')).toBe('v');
    expect(mockStores.get(SECURE)?.key).toBe(legacy);
    expect(storeData(BOOTSTRAP)?.get('enc_key')).toBe(legacy);
  });

  it('never re-encrypts the store, so no key can be recorded that does not open it', async () => {
    // Guards the property directly rather than a symptom of it: whatever
    // happens, the key on the store equals the key that was recorded.
    const legacy = 'a'.repeat(64);
    seedStore(BOOTSTRAP, undefined, {enc_key: legacy});
    seedStore(SECURE, legacy, {k: 'v'});

    const {mmkvStorage} = loadModule();
    await mmkvStorage.getItem('k');

    const recorded = mockKeychain.secrets.get(KEY_SERVICE) ?? storeData(BOOTSTRAP)?.get('enc_key');
    expect(mockStores.get(SECURE)?.key).toBe(recorded);
  });
});

describe('the synchronous API', () => {
  it('reads and writes preferences', () => {
    const {mmkvStorage} = loadModule();
    mmkvStorage.setBoolean('typing_indicator', true);
    mmkvStorage.setNumber('auto_lock_delay', 60);

    expect(mmkvStorage.getBoolean('typing_indicator')).toBe(true);
    expect(mmkvStorage.getNumber('auto_lock_delay')).toBe(60);
  });

  it('accepts generated per-chat keys', () => {
    const {mmkvStorage} = loadModule();
    mmkvStorage.setBoolean('chat_locked_abc123', true);
    expect(mmkvStorage.getBoolean('chat_locked_abc123')).toBe(true);
  });

  it('refuses to write anything that is not a declared preference', () => {
    // The failure mode this prevents is a secret written to the unencrypted
    // store by code that looks entirely correct.
    const {mmkvStorage} = loadModule();
    expect(() => mmkvStorage.setBoolean('secret_flag', true)).toThrow(/not a declared preference/);
    expect(storeData(PREFS)?.has('secret_flag')).toBe(false);
  });

  it('returns undefined rather than throwing when reading an undeclared key', () => {
    const {mmkvStorage} = loadModule();
    expect(mmkvStorage.getBoolean('cached_messages')).toBeUndefined();
  });

  it('never touches the encrypted store', () => {
    const {mmkvStorage} = loadModule();
    mmkvStorage.setBoolean('typing_indicator', true);
    // Not merely absent from the secure store — the secure store has not even
    // been opened, since a synchronous path cannot wait for the key.
    expect(storeData(SECURE)?.has('typing_indicator')).toBeFalsy();
  });
});

describe('clear', () => {
  it('wipes both stores', async () => {
    const {mmkvStorage} = loadModule();
    await mmkvStorage.setItem('cached', 'data');
    mmkvStorage.setBoolean('typing_indicator', true);

    await mmkvStorage.clear();

    expect(storeData(SECURE)?.size).toBe(0);
    expect(storeData(PREFS)?.size).toBe(0);
    expect(storeData(BOOTSTRAP)?.get('enc_key')).toBeUndefined();
  });

  it('leaves the encryption key in place', async () => {
    // Deleting it would leave a file on disk still encrypted under a key
    // nothing holds, so signing back in would land on a store that cannot be
    // opened. The data is already gone, so the key protects nothing either
    // way — the only thing left to get wrong is usability.
    const {mmkvStorage} = loadModule();
    await mmkvStorage.setItem('cached', 'data');
    const before = mockKeychain.secrets.get(KEY_SERVICE);

    await mmkvStorage.clear();

    expect(mockKeychain.secrets.get(KEY_SERVICE)).toBe(before);
    expect(mockStores.get(SECURE)?.key).toBe(before);
  });

  it('leaves the store usable afterwards', async () => {
    // Sign-out is followed by sign-in. A handle whose key has just been
    // deleted would write through to a store nothing can open again.
    const {mmkvStorage} = loadModule();
    await mmkvStorage.setItem('k', 'v');
    await mmkvStorage.clear();

    await mmkvStorage.setItem('k2', 'v2');
    expect(await mmkvStorage.getItem('k2')).toBe('v2');
    expect(mockKeychain.secrets.get(KEY_SERVICE)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('concurrent access', () => {
  it('opens the store once however many callers arrive together', async () => {
    const {mmkvStorage} = loadModule();
    await Promise.all([
      mmkvStorage.setItem('a', '1'),
      mmkvStorage.setItem('b', '2'),
      mmkvStorage.getItem('a'),
      mmkvStorage.getAllKeys(),
    ]);

    // Two opens would mean two generated keys, and whichever lost the race
    // would leave data behind that the winner's key cannot read.
    expect(await mmkvStorage.getItem('a')).toBe('1');
    expect(await mmkvStorage.getItem('b')).toBe('2');
  });
});

describe('warmSecureStorage', () => {
  it('opens the store without throwing', async () => {
    const {warmSecureStorage, mmkvStorage} = loadModule();
    await expect(warmSecureStorage()).resolves.toBeUndefined();
    await mmkvStorage.setItem('k', 'v');
    expect(await mmkvStorage.getItem('k')).toBe('v');
  });
});
