const mockMmkvStore = new Map<string, string>();
jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async (key: string) => mockMmkvStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockMmkvStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockMmkvStore.delete(key);
    },
    getAllKeys: async () => [...mockMmkvStore.keys()],
  },
}));

const mockKeychain = {available: false, store: new Map<string, string>()};
jest.mock('../secureKeyStore', () => ({
  isSecureStoreAvailable: () => mockKeychain.available,
  getSecret: async (service: string) =>
    mockKeychain.available ? mockKeychain.store.get(service) ?? null : null,
  setSecretVerified: async (service: string, secret: string) => {
    if (!mockKeychain.available) return false;
    mockKeychain.store.set(service, secret);
    return true;
  },
  removeSecret: async (service: string) => {
    mockKeychain.store.delete(service);
  },
}));

const reported: string[] = [];
jest.mock('../telemetry', () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));

import {
  _bodyStorageKey,
  _resetBodyKeyCache,
  clearBodies,
  loadBodies,
  MAX_BODIES_PER_CHAT,
  saveBodies,
} from '../messageBodyStore';

const ALICE = 'uid-alice';
const BOB = 'uid-bob';
const CHAT = 'chat-1';

beforeEach(() => {
  mockMmkvStore.clear();
  mockKeychain.store.clear();
  mockKeychain.available = true;
  reported.length = 0;
  _resetBodyKeyCache();
});

describe('round-trip', () => {
  it('returns what was saved', async () => {
    await saveBodies(ALICE, CHAT, new Map([['m1', 'hello'], ['m2', 'there']]));
    const got = await loadBodies(ALICE, CHAT);
    expect(got.get('m1')).toBe('hello');
    expect(got.get('m2')).toBe('there');
  });

  it('survives a cold key cache, as a fresh app launch would', async () => {
    await saveBodies(ALICE, CHAT, new Map([['m1', 'persisted']]));
    _resetBodyKeyCache();
    expect((await loadBodies(ALICE, CHAT)).get('m1')).toBe('persisted');
  });

  it('is empty for a chat nothing was ever saved for', async () => {
    expect((await loadBodies(ALICE, 'never-used')).size).toBe(0);
  });

  it('accepts entry pairs as well as a Map', async () => {
    await saveBodies(ALICE, CHAT, [['m1', 'from pairs']]);
    expect((await loadBodies(ALICE, CHAT)).get('m1')).toBe('from pairs');
  });
});

describe('at rest', () => {
  it('does not write message text into MMKV in the clear', async () => {
    await saveBodies(ALICE, CHAT, new Map([['m1', 'meet me at the docks']]));
    const blob = mockMmkvStore.get(_bodyStorageKey(ALICE, CHAT));
    expect(blob).toBeTruthy();
    expect(blob).not.toContain('meet me at the docks');
    expect(blob).not.toContain('docks');
    // The whole store, not just this key — nothing anywhere holds the text.
    expect([...mockMmkvStore.values()].join('\n')).not.toContain('docks');
  });

  it('keeps one account from reading another on the same device', async () => {
    await saveBodies(ALICE, CHAT, new Map([['m1', "alice's message"]]));
    await saveBodies(BOB, CHAT, new Map([['m1', "bob's message"]]));
    expect((await loadBodies(ALICE, CHAT)).get('m1')).toBe("alice's message");
    expect((await loadBodies(BOB, CHAT)).get('m1')).toBe("bob's message");
  });

  it('reports rather than throws when the blob cannot be decrypted', async () => {
    await saveBodies(ALICE, CHAT, new Map([['m1', 'hello']]));
    mockMmkvStore.set(_bodyStorageKey(ALICE, CHAT), 'not a valid ciphertext');
    expect((await loadBodies(ALICE, CHAT)).size).toBe(0);
    expect(reported).toContain('message_bodies_unreadable');
  });
});

describe('merging', () => {
  it('keeps scrollback the caller no longer has on screen', async () => {
    await saveBodies(ALICE, CHAT, new Map([['old', 'older message']]));
    // A later window that knows nothing about `old`.
    await saveBodies(ALICE, CHAT, new Map([['new', 'newer message']]));
    const got = await loadBodies(ALICE, CHAT);
    expect(got.get('old')).toBe('older message');
    expect(got.get('new')).toBe('newer message');
  });

  it('never overwrites a body that was already recorded', async () => {
    // The reason this matters: a ratchet message decrypts exactly once, so a
    // later pass over the same id can only ever be a failure placeholder. If
    // that won, opening the chat twice would erase the history.
    await saveBodies(ALICE, CHAT, new Map([['m1', 'the real text']]));
    await saveBodies(ALICE, CHAT, new Map([['m1', '🔒 Unable to decrypt']]));
    expect((await loadBodies(ALICE, CHAT)).get('m1')).toBe('the real text');
  });

  it('evicts oldest-first past the cap', async () => {
    const many = new Map<string, string>();
    for (let i = 0; i < MAX_BODIES_PER_CHAT + 10; i++) many.set(`m${i}`, `body ${i}`);
    await saveBodies(ALICE, CHAT, many);

    const got = await loadBodies(ALICE, CHAT);
    expect(got.size).toBe(MAX_BODIES_PER_CHAT);
    expect(got.has('m0')).toBe(false);
    expect(got.has('m9')).toBe(false);
    expect(got.get(`m${MAX_BODIES_PER_CHAT + 9}`)).toBe(`body ${MAX_BODIES_PER_CHAT + 9}`);
  });
});

describe('clearing', () => {
  it('removes every chat for the account, and the key', async () => {
    await saveBodies(ALICE, 'chat-1', new Map([['m1', 'one']]));
    await saveBodies(ALICE, 'chat-2', new Map([['m2', 'two']]));

    await clearBodies(ALICE);

    expect(mockMmkvStore.size).toBe(0);
    expect(mockKeychain.store.size).toBe(0);
    expect((await loadBodies(ALICE, 'chat-1')).size).toBe(0);
    expect((await loadBodies(ALICE, 'chat-2')).size).toBe(0);
  });

  it('leaves another account on the device untouched', async () => {
    await saveBodies(ALICE, CHAT, new Map([['m1', "alice's"]]));
    await saveBodies(BOB, CHAT, new Map([['m1', "bob's"]]));

    await clearBodies(ALICE);

    expect((await loadBodies(ALICE, CHAT)).size).toBe(0);
    expect((await loadBodies(BOB, CHAT)).get('m1')).toBe("bob's");
  });

  it('drops the in-memory key even when the wipe fails partway', async () => {
    await saveBodies(ALICE, CHAT, new Map([['m1', 'hello']]));
    const spy = jest
      .spyOn(require('../storageMMKV').mmkvStorage, 'getAllKeys')
      .mockRejectedValueOnce(new Error('storage gone'));

    await clearBodies(ALICE);
    spy.mockRestore();

    // The wipe failed, so it is reported and the blob is still there — the
    // caller can retry. What must NOT survive is the key held in memory.
    expect(reported).toContain('message_bodies_clear_failed');

    // Observing that: take the key out from under the store. If `clearBodies`
    // had kept its cached copy, the next read would still decrypt the blob.
    mockKeychain.store.clear();
    expect((await loadBodies(ALICE, CHAT)).size).toBe(0);
  });

  it('a retry after a failed wipe finishes the job', async () => {
    await saveBodies(ALICE, CHAT, new Map([['m1', 'hello']]));
    const spy = jest
      .spyOn(require('../storageMMKV').mmkvStorage, 'getAllKeys')
      .mockRejectedValueOnce(new Error('storage gone'));
    await clearBodies(ALICE);
    spy.mockRestore();

    await clearBodies(ALICE);
    expect(mockMmkvStore.size).toBe(0);
    expect(mockKeychain.store.size).toBe(0);
  });
});

describe('without a native key store', () => {
  it('still stores and reads back, degrading to MMKV for the key', async () => {
    mockKeychain.available = false;
    await saveBodies(ALICE, CHAT, new Map([['m1', 'degraded but working']]));
    _resetBodyKeyCache();
    expect((await loadBodies(ALICE, CHAT)).get('m1')).toBe('degraded but working');
    // And the body itself is still not sitting in the clear.
    expect(mockMmkvStore.get(_bodyStorageKey(ALICE, CHAT))).not.toContain('degraded');
  });
});
