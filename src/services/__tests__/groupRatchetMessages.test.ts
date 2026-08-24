/**
 * A three-member group exchanging real messages through the real sender-key
 * stack.
 *
 * Only the two edges are faked — Firestore (a path->doc map) and the OS key
 * store. Everything between is production code: the pairwise ratchet that
 * carries each distribution, the session store, and the sender-key chains.
 * Group forward secrecy is a property of that whole path, not of any one
 * piece, so testing the pieces separately would not establish it.
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

jest.mock('../telemetry', () => ({reportError: () => undefined}));


import {
  handleMembershipChange,
  isGroupEnvelope,
  openGroupEnvelope,
  sealGroupText,
  type GroupEnvelope,
} from '../groupRatchetMessages';
import {publishRatchetKeys, _resetRatchetIdentityCache} from '../ratchetKeys';
import {_resetSessionKeyCache} from '../ratchetSessionStore';

const A = 'alice';
const B = 'bob';
const C = 'carol';
const CHAT = 'group1';
const MEMBERS = [A, B, C];

/** Runs `fn` as though it were executing on `uid`'s install. */
async function on<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  mockActive.device = uid;
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
  mockActive.device = A;
});

async function everyonePublishes(members: string[] = MEMBERS) {
  for (const uid of members) await on(uid, () => publishRatchetKeys(uid));
}

async function send(uid: string, text: string, members: string[] = MEMBERS): Promise<GroupEnvelope> {
  return on(uid, async () => {
    const outcome = await sealGroupText(uid, CHAT, members, text);
    if (outcome.protection !== 'sender-key') {
      throw new Error(`expected sender-key, got ${outcome.protection}`);
    }
    return outcome.envelope;
  });
}

async function read(uid: string, envelope: GroupEnvelope) {
  return on(uid, () => openGroupEnvelope(envelope, uid, CHAT));
}

describe('a group message', () => {
  it('is encrypted once and readable by every other member', async () => {
    // The efficiency claim made concrete: one ciphertext, not one per member.
    await everyonePublishes();
    const envelope = await send(A, 'hello everyone');

    expect(isGroupEnvelope(envelope)).toBe(true);
    expect(await read(B, envelope)).toEqual({status: 'ok', text: 'hello everyone'});
    expect(await read(C, envelope)).toEqual({status: 'ok', text: 'hello everyone'});
  });

  it('carries a conversation between several senders', async () => {
    await everyonePublishes();
    const fromA = await send(A, 'from alice');
    expect((await read(B, fromA)).status).toBe('ok');

    const fromB = await send(B, 'from bob');
    expect(await read(A, fromB)).toEqual({status: 'ok', text: 'from bob'});
    expect(await read(C, fromB)).toEqual({status: 'ok', text: 'from bob'});
  });

  it('gives every message a different ciphertext', async () => {
    await everyonePublishes();
    const bodies = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const e = await send(A, 'identical text');
      await read(B, e);
      bodies.add(e.message.body);
    }
    expect(bodies.size).toBe(4);
  });

  it('never puts the chain key where the server can read it', async () => {
    // The distribution is stored on the server. If it were not sealed to each
    // member through their pairwise session, the operator would hold the key
    // to every group message.
    await everyonePublishes();
    await send(A, 'hello');
    const stored = JSON.stringify([...mockDocs.entries()].filter(([k]) => k.includes('senderKeys')));
    expect(stored).toContain('chatterbox-ratchet-envelope-v1');
    expect(stored).not.toContain('"chainKey"');
  });
});

describe('falling back', () => {
  it('reports unavailable when any single member lacks a ratchet identity', async () => {
    // All-or-nothing, matching the fan-out rule: a message some members
    // cannot read is worse than one everybody can.
    await everyonePublishes([A, B]); // carol never published
    const outcome = await on(A, () => sealGroupText(A, CHAT, MEMBERS, 'hello'));
    expect(outcome.protection).toBe('unavailable');
  });

  it('does not send a message that only some members could open', async () => {
    await everyonePublishes([A, B]);
    await on(A, () => sealGroupText(A, CHAT, MEMBERS, 'hello')).catch(() => undefined);
    const messages = [...mockDocs.keys()].filter(k => k.includes('/messages/'));
    expect(messages).toEqual([]);
  });
});

describe('a member joining', () => {
  it('cannot read anything sent before they had the key', async () => {
    // Not enforced by anyone remembering to withhold history: the chain KDF is
    // one-way, so a key handed out at index 3 cannot produce the keys for 0-2.
    await everyonePublishes();
    const early = await send(A, 'before dave', [A, B, C]);
    await read(B, early);
    await send(A, 'filler', [A, B, C]);

    const DAVE = 'dave';
    await on(DAVE, () => publishRatchetKeys(DAVE));
    const withDave = [...MEMBERS, DAVE];
    const afterJoin = await send(A, 'after dave', withDave);

    expect(await read(DAVE, afterJoin)).toEqual({status: 'ok', text: 'after dave'});
    expect((await read(DAVE, early)).status).toBe('undecryptable');
  });

  it('does not rotate on a join', async () => {
    await everyonePublishes();
    await send(A, 'hi');
    const rotated = await on(A, () => handleMembershipChange(A, CHAT, [A, B], [A, B, C]));
    expect(rotated).toBe(false);
  });
});

describe('a member being removed', () => {
  it('rotates, and the removed member can no longer read', async () => {
    // The only healing this construction has. A departing member holds the
    // current chain key and can advance it themselves, so without rotation
    // they keep reading every future message.
    await everyonePublishes();
    const before = await send(A, 'while carol was here');
    expect((await read(C, before)).status).toBe('ok');

    const remaining = [A, B];
    const rotated = await on(A, () => handleMembershipChange(A, CHAT, MEMBERS, remaining));
    expect(rotated).toBe(true);

    const after = await send(A, 'after carol left', remaining);
    expect(await read(B, after)).toEqual({status: 'ok', text: 'after carol left'});
    expect((await read(C, after)).status).toBe('undecryptable');
  });

  it('redistributes the new chain to everyone who stayed', async () => {
    await everyonePublishes();
    await send(A, 'first');
    await on(A, () => handleMembershipChange(A, CHAT, MEMBERS, [A, B]));

    const after = await send(A, 'second', [A, B]);
    // Bob picks up the rotation without any extra step.
    expect(await read(B, after)).toEqual({status: 'ok', text: 'second'});
  });
});

describe('failure handling', () => {
  it('reports a tampered message as undecryptable', async () => {
    await everyonePublishes();
    const envelope = await send(A, 'hello');
    const tampered = {...envelope, message: {...envelope.message, body: 'AAAAAAAAAAAAAAAAAAAAAAAA'}};
    expect((await read(B, tampered)).status).toBe('undecryptable');
  });

  it('rejects a message forged as another member', async () => {
    // Every member holds the chain key, so the group key proves membership,
    // not authorship. The per-sender signature is what proves that.
    await everyonePublishes();
    const fromB = await send(B, 'genuine bob');
    const forged = {...fromB, from: A};
    expect((await read(C, forged)).status).toBe('undecryptable');
  });

  it('does not let a bad message destroy the chain', async () => {
    await everyonePublishes();
    const first = await send(A, 'first');
    await read(B, first);

    const good = await send(A, 'good');
    const tampered = {...good, message: {...good.message, body: 'AAAAAAAAAAAAAAAAAAAAAAAA'}};
    expect((await read(B, tampered)).status).toBe('undecryptable');
    expect(await read(B, good)).toEqual({status: 'ok', text: 'good'});
  });

  it('cannot be opened in a different chat', async () => {
    await everyonePublishes();
    const envelope = await send(A, 'hello');
    const moved = await on(B, () => openGroupEnvelope(envelope, B, 'another-chat'));
    expect(moved.status).toBe('undecryptable');
  });

  it('reports undecryptable when no distribution exists for the sender', async () => {
    await everyonePublishes();
    const envelope = await send(A, 'hello');
    // Bob's copy of the distribution goes missing.
    for (const k of [...mockDocs.keys()].filter(p => p.includes(`senderKeys/${A}__${B}`))) {
      mockDocs.delete(k);
    }
    expect((await read(B, envelope)).status).toBe('undecryptable');
  });
});

describe('isGroupEnvelope', () => {
  it('accepts a real envelope and rejects everything else', async () => {
    await everyonePublishes();
    expect(isGroupEnvelope(await send(A, 'x'))).toBe(true);
    for (const bad of [null, undefined, 'x', 7, {}, {alg: 'other'}]) {
      expect(isGroupEnvelope(bad)).toBe(false);
    }
  });
});

describe('a member who was offline across a rotation', () => {
  it('can still bootstrap and read once they come back', async () => {
    // The failure the per-chain distribution channel exists to prevent. Bob
    // never opened the first distribution; rotation then overwrote the
    // document holding it. If distributions shared one session per chat, the
    // only copy of the X3DH handshake would be gone and Bob could never read
    // anything from Alice in this group again — silently, and invisibly to
    // Alice.
    await everyonePublishes();
    await send(A, 'while bob was away');          // Bob does not read this
    await on(A, () => handleMembershipChange(A, CHAT, MEMBERS, [A, B]));

    const afterRotation = await send(A, 'bob is back', [A, B]);
    expect(await read(B, afterRotation)).toEqual({status: 'ok', text: 'bob is back'});
  });

  it('bootstraps from a distribution written before it ever came online', async () => {
    await everyonePublishes();
    const first = await send(A, 'first');
    const second = await send(A, 'second');
    // Bob's very first act is reading the *second* message.
    expect(await read(B, second)).toEqual({status: 'ok', text: 'second'});
    // ...and the earlier one still opens, from the keys skipped past.
    expect(await read(B, first)).toEqual({status: 'ok', text: 'first'});
  });
});

describe('a chain cannot be relocated to another chat', () => {
  it('rejects a message replayed into another chat with its distribution moved too', async () => {
    // The plain "different chat" case above is stopped by storage namespacing
    // alone. This one copies the distribution across as well, so what stops
    // it is the cryptographic binding: the distribution was sealed under a
    // pairwise channel derived from the original chat id, and no longer opens
    // once relocated. Worth stating precisely, because the group envelope's
    // own associated data is NOT what fails here — see groupAd.
    await everyonePublishes();
    const envelope = await send(A, 'meant for group1');

    const OTHER = 'group2';
    for (const [path, data] of [...mockDocs.entries()]) {
      if (path.startsWith(`chats/${CHAT}/senderKeys/`)) {
        mockDocs.set(path.replace(`chats/${CHAT}/`, `chats/${OTHER}/`), data);
      }
    }

    const moved = await on(B, () => openGroupEnvelope(envelope, B, OTHER));
    expect(moved.status).toBe('undecryptable');
  });
});
