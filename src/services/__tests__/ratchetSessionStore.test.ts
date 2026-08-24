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

jest.mock('../telemetry', () => ({reportError: () => undefined}));

import {
  _resetSessionKeyCache,
  _sessionStorageKey,
  clearGroupState,
  clearRatchetSessions,
  loadOwnSenderKey,
  loadReceiverKey,
  loadSession,
  saveSession,
  withOwnSenderKey,
  withReceiverKey,
  withSession,
} from '../ratchetSessionStore';
import {
  generateRatchetKeypair,
  initSessionAsInitiator,
  initSessionAsResponder,
  ratchetDecrypt,
  ratchetEncrypt,
  type RatchetSession,
} from '../ratchet/doubleRatchet';
import {
  acceptDistribution,
  createSenderKey,
  distributionFor,
  senderKeyEncrypt,
} from '../ratchet/senderKeys';
import {bytesToBase64, secureRandomBytes, utf8ToBytes} from '../crypto';

const ME = 'me';
const PEER = 'peer';
const CHAT = 'chat1';
const AD = utf8ToBytes('ad');

function pair(): {alice: RatchetSession; bob: RatchetSession} {
  const shared = secureRandomBytes(32);
  const spk = generateRatchetKeypair();
  return {
    alice: initSessionAsInitiator(shared, spk.publicKey),
    bob: initSessionAsResponder(shared, spk),
  };
}

beforeEach(() => {
  mockMmkvStore.clear();
  mockKeychain.store.clear();
  mockKeychain.available = false;
  _resetSessionKeyCache();
});

describe('round-tripping a session', () => {
  it('returns null before anything is stored', async () => {
    expect(await loadSession(ME, CHAT, PEER)).toBeNull();
  });

  it('restores a session faithfully enough to keep decrypting', async () => {
    // Not just field equality — the restored session has to actually work,
    // which is the only property that matters after an app restart.
    let {alice, bob} = pair();
    const first = ratchetEncrypt(alice, 'before restart', AD);
    alice = first.session;
    bob = ratchetDecrypt(bob, first.message, AD).session;

    await saveSession(ME, CHAT, PEER, bob);
    _resetSessionKeyCache();
    const restored = await loadSession(ME, CHAT, PEER);

    const second = ratchetEncrypt(alice, 'after restart', AD);
    expect(ratchetDecrypt(restored!, second.message, AD).plaintext).toBe('after restart');
  });

  it('keeps sessions separate per chat and per peer', async () => {
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    expect(await loadSession(ME, 'other-chat', PEER)).toBeNull();
    expect(await loadSession(ME, CHAT, 'other-peer')).toBeNull();
    expect(await loadSession('other-user', CHAT, PEER)).toBeNull();
  });
});

describe('encryption at rest', () => {
  it('never writes chain keys to MMKV in the clear', async () => {
    // Session state contains live chain keys. MMKV's own encryption key sits
    // in an unencrypted bootstrap store, so writing sessions there as
    // plaintext would put the chain keys one file read away.
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);

    const stored = mockMmkvStore.get(_sessionStorageKey(ME, CHAT, PEER))!;
    expect(stored).toBeDefined();
    expect(stored).not.toContain(bytesToBase64(alice.rk));
    expect(stored).not.toContain(bytesToBase64(alice.cks!));
    expect(stored).not.toContain(bytesToBase64(alice.dhs.secretKey));
    expect(stored).not.toContain('"rk"');
  });

  it('puts the session key in the OS key store when it is available', async () => {
    mockKeychain.available = true;
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    expect([...mockKeychain.store.keys()].some(k => k.includes('sessionKey'))).toBe(true);
    expect([...mockMmkvStore.keys()].some(k => k.startsWith('ratchet_session_key'))).toBe(false);
  });

  it('reports rather than guesses when a stored session cannot be decrypted', async () => {
    // Returning null makes the caller establish a fresh session the peer knows
    // nothing about. That is the honest outcome, but it must be visible, not
    // hidden behind a silently deleted blob.
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    mockMmkvStore.set(_sessionStorageKey(ME, CHAT, PEER), 'not a valid ciphertext');
    expect(await loadSession(ME, CHAT, PEER)).toBeNull();
    // The blob is left in place rather than destroyed.
    expect(mockMmkvStore.has(_sessionStorageKey(ME, CHAT, PEER))).toBe(true);
  });

  it('cannot read sessions written under a different session key', async () => {
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    // Simulate the key being lost (reinstall, key store wiped).
    mockMmkvStore.delete('ratchet_session_key_v1_' + ME);
    mockKeychain.store.clear();
    _resetSessionKeyCache();
    expect(await loadSession(ME, CHAT, PEER)).toBeNull();
  });
});

describe('withSession serializes access', () => {
  it('does not lose a chain advance when two decrypts overlap', async () => {
    // The bug this exists to prevent. Both operations read the same stored
    // session; without serialization the second write lands on top of the
    // first and one advance is discarded, making that message — and
    // everything after it in the chain — undecryptable.
    let {alice, bob} = pair();
    const m0 = ratchetEncrypt(alice, 'm0', AD);
    alice = m0.session;
    const m1 = ratchetEncrypt(alice, 'm1', AD);
    alice = m1.session;

    await saveSession(ME, CHAT, PEER, bob);

    const decryptOne = (message: typeof m0.message) =>
      withSession<string>(ME, CHAT, PEER, async session => {
        // A real await between read and write — the gap the hazard lives in.
        await new Promise(resolve => setTimeout(resolve, 0));
        const got = ratchetDecrypt(session!, message, AD);
        return {session: got.session, result: got.plaintext};
      });

    const [a, b] = await Promise.all([decryptOne(m0.message), decryptOne(m1.message)]);
    expect([a, b].sort()).toEqual(['m0', 'm1']);

    // Both advances survived: the stored session is past both messages.
    const after = await loadSession(ME, CHAT, PEER);
    expect(after!.nr).toBe(2);
  });

  it('runs queued operations in order', async () => {
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    const order: number[] = [];
    await Promise.all(
      [0, 1, 2, 3].map(i =>
        withSession<void>(ME, CHAT, PEER, async session => {
          await new Promise(resolve => setTimeout(resolve, (4 - i) * 2));
          order.push(i);
          return {session, result: undefined};
        }),
      ),
    );
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it('leaves the stored session untouched when the operation throws', async () => {
    // A corrupt or forged message must not cost the session.
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    const before = mockMmkvStore.get(_sessionStorageKey(ME, CHAT, PEER));

    await expect(
      withSession(ME, CHAT, PEER, async () => {
        throw new Error('bad ciphertext');
      }),
    ).rejects.toThrow('bad ciphertext');

    expect(mockMmkvStore.get(_sessionStorageKey(ME, CHAT, PEER))).toBe(before);
  });

  it('does not wedge the session after a failure', async () => {
    // One failed decrypt must not block every later operation on the chain.
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    await expect(
      withSession(ME, CHAT, PEER, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow();

    const ok = await withSession<string>(ME, CHAT, PEER, async session => ({
      session,
      result: 'still working',
    }));
    expect(ok).toBe('still working');
  });

  it('commits nothing when the operation returns no session', async () => {
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    const before = mockMmkvStore.get(_sessionStorageKey(ME, CHAT, PEER));
    await withSession<void>(ME, CHAT, PEER, async () => ({session: null, result: undefined}));
    expect(mockMmkvStore.get(_sessionStorageKey(ME, CHAT, PEER))).toBe(before);
  });

  it('serializes per session, not globally', async () => {
    // Two different conversations must not block each other.
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    await saveSession(ME, 'chat2', PEER, alice);
    let released = false;
    const slow = withSession<void>(ME, CHAT, PEER, async session => {
      await new Promise(resolve => setTimeout(resolve, 20));
      released = true;
      return {session, result: undefined};
    });
    const fast = await withSession<boolean>(ME, 'chat2', PEER, async session => ({
      session,
      result: released,
    }));
    expect(fast).toBe(false); // finished before the slow one on the other chat
    await slow;
  });
});

describe('group sender key state', () => {
  it('round-trips an own sender key and keeps the chain advancing', async () => {
    const created = createSenderKey();
    await withOwnSenderKey<void>(ME, CHAT, async () => ({state: created, result: undefined}));

    const advanced = await withOwnSenderKey<string>(ME, CHAT, async state => {
      const sent = senderKeyEncrypt(state!, 'hello', AD);
      return {state: sent.state, result: sent.message.body};
    });
    expect(advanced).toBeDefined();

    const stored = await loadOwnSenderKey(ME, CHAT);
    expect(stored!.index).toBe(1);
    expect(stored!.chainId).toBe(created.chainId);
  });

  it('round-trips a receiver key per sender', async () => {
    const sender = createSenderKey();
    const state = acceptDistribution(distributionFor(sender));
    await withReceiverKey<void>(ME, CHAT, PEER, async () => ({state, result: undefined}));

    expect((await loadReceiverKey(ME, CHAT, PEER))!.chainId).toBe(sender.chainId);
    expect(await loadReceiverKey(ME, CHAT, 'someone-else')).toBeNull();
  });

  it('never writes a sender chain key to MMKV in the clear', async () => {
    const created = createSenderKey();
    await withOwnSenderKey<void>(ME, CHAT, async () => ({state: created, result: undefined}));
    const stored = [...mockMmkvStore.entries()].find(([k]) => k.includes('sender_key'))![1];
    expect(stored).not.toContain(bytesToBase64(created.chainKey));
    expect(stored).not.toContain(created.chainId);
  });
});

describe('teardown', () => {
  it('removes every session and the key protecting them', async () => {
    mockKeychain.available = true;
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    await saveSession(ME, 'chat2', 'peer2', alice);
    await withOwnSenderKey<void>(ME, CHAT, async () => ({state: createSenderKey(), result: undefined}));

    await clearRatchetSessions(ME);

    expect(mockKeychain.store.size).toBe(0);
    expect([...mockMmkvStore.keys()].filter(k => k.startsWith('ratchet_'))).toEqual([]);
  });

  it('does not touch another account\'s sessions', async () => {
    const {alice} = pair();
    await saveSession(ME, CHAT, PEER, alice);
    await saveSession('other-user', CHAT, PEER, alice);
    await clearRatchetSessions(ME);
    expect(await loadSession('other-user', CHAT, PEER)).not.toBeNull();
  });

  it('clears one chat\'s group state without disturbing another', async () => {
    const sender = createSenderKey();
    await withOwnSenderKey<void>(ME, CHAT, async () => ({state: sender, result: undefined}));
    await withOwnSenderKey<void>(ME, 'chat2', async () => ({state: createSenderKey(), result: undefined}));
    await withReceiverKey<void>(ME, CHAT, PEER, async () => ({
      state: acceptDistribution(distributionFor(sender)),
      result: undefined,
    }));

    await clearGroupState(ME, CHAT);

    expect(await loadOwnSenderKey(ME, CHAT)).toBeNull();
    expect(await loadReceiverKey(ME, CHAT, PEER)).toBeNull();
    expect(await loadOwnSenderKey(ME, 'chat2')).not.toBeNull();
  });
});
