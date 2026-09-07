/**
 * Two simulated devices exchanging real messages through the real ratchet.
 *
 * Only the two edges are faked — Firestore (a path->doc map) and the OS key
 * store. Everything between, including session storage and the crypto, is the
 * production code, because the properties worth testing here are exactly the
 * ones that only appear when the whole path runs end to end.
 */
const mockDocs = new Map<string, Record<string, unknown>>();
const mockOutage = {read: false};

jest.mock('../firebase/firestore', () => {
  const refFor = (path: string) => ({path, id: path.split('/').pop() as string});
  return {
    getFirestore: () => ({}),
    collection: (parent: unknown, name: string) => {
      const base = (parent as {path?: string})?.path;
      return {path: base ? `${base}/${name}` : name};
    },
    doc: (parent: unknown, ...segments: string[]) => {
      const base = (parent as {path?: string})?.path;
      return refFor([base, ...segments].filter(Boolean).join('/'));
    },
    getDoc: async (ref: {path: string}) => {
      if (mockOutage.read) throw new Error('network unavailable');
      const data = mockDocs.get(ref.path);
      return {exists: () => !!data, data: () => data};
    },
    setDoc: async (ref: {path: string}, data: Record<string, unknown>, opts?: {merge?: boolean}) => {
      const existing = opts?.merge ? mockDocs.get(ref.path) : undefined;
      mockDocs.set(ref.path, {...existing, ...data});
    },
    deleteDoc: async (ref: {path: string}) => {
      mockDocs.delete(ref.path);
    },
    getDocs: async (q: {path: string; field?: string; value?: unknown; max?: number}) => {
      if (mockOutage.read) throw new Error('network unavailable');
      let docs = [...mockDocs.entries()]
        .filter(
          ([path]) =>
            path.startsWith(`${q.path}/`) && !path.slice(q.path.length + 1).includes('/'),
        )
        .map(([path, data]) => ({id: path.split('/').pop() as string, ref: refFor(path), data: () => data}));
      if (q.field !== undefined) docs = docs.filter(d => (d.data() as never)[q.field!] === q.value);
      if (q.max !== undefined) docs = docs.slice(0, q.max);
      return {docs, size: docs.length, empty: docs.length === 0};
    },
    query: (base: {path: string}, ...clauses: Record<string, unknown>[]) =>
      Object.assign({path: base.path}, ...clauses),
    where: (field: string, _op: string, value: unknown) => ({field, value}),
    limit: (max: number) => ({max}),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: async (ref: {path: string}) => {
          const data = mockDocs.get(ref.path);
          return {exists: () => !!data, data: () => data};
        },
        update: (ref: {path: string}, patch: Record<string, unknown>) => {
          mockDocs.set(ref.path, {...(mockDocs.get(ref.path) as object), ...patch});
        },
      }),
    serverTimestamp: () => 'TS',
  };
});

/**
 * One MMKV per simulated device. `activeDevice` selects which one the module
 * under test sees, so two installs can be driven from a single test process.
 */
const mockDevices = new Map<string, Map<string, string>>();
const mockActive = {device: 'A'};
const deviceStore = () => {
  let store = mockDevices.get(mockActive.device);
  if (!store) {
    store = new Map<string, string>();
    mockDevices.set(mockActive.device, store);
  }
  return store;
};

jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async (key: string) => deviceStore().get(key) ?? null,
    setItem: async (key: string, value: string) => {
      deviceStore().set(key, value);
    },
    removeItem: async (key: string) => {
      deviceStore().delete(key);
    },
    getAllKeys: async () => [...deviceStore().keys()],
  },
}));

jest.mock('../secureKeyStore', () => ({
  isSecureStoreAvailable: () => false,
  getSecret: async () => null,
  setSecretVerified: async () => false,
  removeSecret: async () => undefined,
}));

jest.mock('../errorLog', () => ({reportError: () => undefined}));

import {openEnvelope, sealText, isRatchetEnvelope, type RatchetEnvelope} from '../ratchetMessages';
import {publishRatchetKeys} from '../ratchetKeys';
import {_resetRatchetIdentityCache} from '../ratchetKeys';
import {_resetSessionKeyCache} from '../ratchetSessionStore';

const ALICE = 'alice';
const BOB = 'bob';
const CHAT = 'chat1';

/** Runs `fn` as though it were executing on `device`'s install. */
async function on<T>(device: string, fn: () => Promise<T>): Promise<T> {
  mockActive.device = device;
  _resetRatchetIdentityCache();
  _resetSessionKeyCache();
  try {
    return await fn();
  } finally {
    _resetRatchetIdentityCache();
    _resetSessionKeyCache();
  }
}

beforeEach(() => {
  mockDocs.clear();
  mockDevices.clear();
  mockOutage.read = false;
  mockActive.device = 'A';
});

async function bobPublishes() {
  await on('B', () => publishRatchetKeys(BOB));
}

async function aliceSends(text: string): Promise<RatchetEnvelope> {
  return on('A', async () => {
    const outcome = await sealText(ALICE, CHAT, BOB, text);
    if (outcome.protection !== 'ratchet') throw new Error(`expected ratchet, got ${outcome.protection}`);
    return outcome.envelope;
  });
}

async function bobOpens(envelope: RatchetEnvelope) {
  return on('B', () => openEnvelope(envelope, BOB, CHAT));
}

/** Narrows an outcome to the success case, failing the test if it is not. */
function expectOk(outcome: Awaited<ReturnType<typeof openEnvelope>>) {
  if (outcome.status !== 'ok') throw new Error(`expected ok, got ${outcome.status}`);
  return outcome;
}

describe('a first message', () => {
  it('establishes a session and is readable by the recipient', async () => {
    await bobPublishes();
    const envelope = await aliceSends('hello');

    expect(isRatchetEnvelope(envelope)).toBe(true);
    expect(envelope.initial).toBeDefined(); // carries the X3DH half

    const opened = await bobOpens(envelope);
    expect(opened).toEqual({status: 'ok', text: 'hello', sessionReset: false});
  });

  it('reports "unavailable" when the peer has published nothing', async () => {
    // An older client. The caller answers this by using the static path — and
    // must be told, not left to assume.
    const outcome = await on('A', () => sealText(ALICE, CHAT, BOB, 'hello'));
    expect(outcome.protection).toBe('unavailable');
  });

  it('throws rather than reporting "unavailable" when the lookup fails', async () => {
    // The distinction that keeps an intermittent network from permanently
    // downgrading a conversation.
    await bobPublishes();
    mockOutage.read = true;
    await expect(on('A', () => sealText(ALICE, CHAT, BOB, 'hello'))).rejects.toThrow();
  });

  it('rejects a replay of the first message, and keeps the session intact', async () => {
    // This is what the one-time prekey buys. Once it is burned the handshake
    // cannot be repeated, and the live session has already advanced past that
    // message — so a captured first message opens nothing a second time.
    await bobPublishes();
    const envelope = await aliceSends('hello');
    const otpId = envelope.initial!.oneTimePreKeyId!;
    expect(otpId).toBeDefined();

    expect((await bobOpens(envelope)).status).toBe('ok');
    expect(mockDocs.get(`users/${BOB}/oneTimePreKeys/${otpId}`)?.claimed).toBe(true);

    expect((await bobOpens(envelope)).status).toBe('undecryptable');

    // The failed replay must not have cost the conversation.
    const next = await aliceSends('still talking');
    expect(expectOk(await bobOpens(next)).text).toBe('still talking');
  });
});

describe('an ongoing conversation', () => {
  it('carries messages in both directions', async () => {
    await bobPublishes();
    const first = await aliceSends('from alice');
    expect((await bobOpens(first)).status).toBe('ok');

    const reply = await on('B', async () => {
      const outcome = await sealText(BOB, CHAT, ALICE, 'from bob');
      if (outcome.protection !== 'ratchet') throw new Error('expected ratchet');
      return outcome.envelope;
    });
    const back = await on('A', () => openEnvelope(reply, ALICE, CHAT));
    expect(back).toEqual({status: 'ok', text: 'from bob', sessionReset: false});
  });

  it('only sends the X3DH half on the very first message', async () => {
    await bobPublishes();
    const first = await aliceSends('one');
    await bobOpens(first);
    const second = await aliceSends('two');
    expect(second.initial).toBeUndefined();
    expect(expectOk(await bobOpens(second)).text).toBe('two');
  });

  it('gives every message a different ciphertext', async () => {
    // Forward secrecy, visible at this level: the chain has moved on.
    await bobPublishes();
    const bodies = new Set<string>();
    const first = await aliceSends('same text');
    await bobOpens(first);
    bodies.add(first.message.body);
    for (let i = 0; i < 4; i++) {
      const next = await aliceSends('same text');
      await bobOpens(next);
      bodies.add(next.message.body);
    }
    expect(bodies.size).toBe(5);
  });

  it('delivers messages that arrive out of order', async () => {
    await bobPublishes();
    const first = await aliceSends('m0');
    await bobOpens(first);
    const m1 = await aliceSends('m1');
    const m2 = await aliceSends('m2');

    expect(expectOk(await bobOpens(m2)).text).toBe('m2');
    expect(expectOk(await bobOpens(m1)).text).toBe('m1');
  });
});

describe('failure handling', () => {
  it('reports a tampered message as undecryptable', async () => {
    await bobPublishes();
    const first = await aliceSends('hello');
    await bobOpens(first);
    const second = await aliceSends('second');
    const tampered = {...second, message: {...second.message, body: 'AAAAAAAAAAAAAAAAAAAAAAAA'}};
    expect((await bobOpens(tampered)).status).toBe('undecryptable');
  });

  it('does not let a bad message destroy the live session', async () => {
    // A forged message must not cost the conversation. This is the property
    // withSession and the pure ratchet operations exist to guarantee, checked
    // here through the whole stack.
    await bobPublishes();
    const first = await aliceSends('hello');
    await bobOpens(first);

    const good = await aliceSends('good');
    const tampered = {...good, message: {...good.message, body: 'AAAAAAAAAAAAAAAAAAAAAAAA'}};
    expect((await bobOpens(tampered)).status).toBe('undecryptable');

    // The genuine message still opens afterwards.
    expect(expectOk(await bobOpens(good)).text).toBe('good');
  });

  it('reports undecryptable when a message arrives with no session and no X3DH half', async () => {
    await bobPublishes();
    const first = await aliceSends('hello');
    const orphan = {...first, initial: undefined};
    expect((await bobOpens(orphan)).status).toBe('undecryptable');
  });

  it('cannot be opened by a third party in a different conversation', async () => {
    // The associated data binds the ciphertext to this chat.
    await bobPublishes();
    const first = await aliceSends('hello');
    const moved = await on('B', () => openEnvelope(first, BOB, 'a-different-chat'));
    expect(moved.status).toBe('undecryptable');
  });
});

describe('a peer reinstalling', () => {
  it('establishes a fresh session and flags it, rather than failing forever', async () => {
    // From here a genuine reinstall and an attacker substituting themselves
    // look identical, so this is surfaced rather than handled silently — the
    // same reasoning as the existing key-change banner.
    await bobPublishes();
    const first = await aliceSends('hello');
    await bobOpens(first);

    // Alice's device is wiped and starts over.
    mockDevices.delete('A');
    const afterReinstall = await aliceSends('hello again');
    expect(afterReinstall.initial).toBeDefined();

    expect(expectOk(await bobOpens(afterReinstall)).sessionReset).toBe(true);
  });
});
