// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockReauthenticateWithCredential = jest.fn();
const mockDeleteStorageObjectByUrl = jest.fn();
const mockGetOrCreateDeviceKeypair = jest.fn();

let mockCurrentUser: {uid: string; email: string | null} | null = {
  uid: 'uid1',
  email: 'a@b.com',
};

const mockFixtures: {
  collections: Map<string, Array<{id: string; data: Record<string, unknown>}>>;
  /** Every document path the purge deleted, batched or single. */
  deleted: string[];
  /** Deletes and participant-list writes in the order they happened. */
  ops: string[];
} = {collections: new Map(), deleted: [], ops: []};

function mockClauseMatches(data: Record<string, unknown>, clause: {field: string; op: string; value: unknown}): boolean {
  const fieldValue = clause.field.split('.').reduce<unknown>((o, k) => (o as any)?.[k], data);
  if (clause.op === '==') return fieldValue === clause.value;
  if (clause.op === 'array-contains') return Array.isArray(fieldValue) && fieldValue.includes(clause.value);
  return true;
}

jest.mock('../firebase/auth', () => ({
  EmailAuthProvider: {credential: (email: string, password: string) => ({email, password})},
  deleteUser: jest.fn(async () => undefined),
  getAuth: () => ({
    get currentUser() {
      return mockCurrentUser;
    },
  }),
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthenticateWithCredential(...args),
  updatePassword: jest.fn(async () => undefined),
}));

jest.mock('../firebase/firestore', () => ({
  arrayRemove: (v: unknown) => v,
  collection: (_db: unknown, ...segments: string[]) => ({path: segments.join('/'), clauses: []}),
  deleteDoc: jest.fn(async (ref: any) => {
    mockFixtures.deleted.push(ref.path);
    mockFixtures.ops.push(`delete ${ref.path}`);
  }),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDocs: async (ref: any) => {
    const all = mockFixtures.collections.get(ref.path) || [];
    const filtered = all.filter(d => (ref.clauses || []).every((c: any) => mockClauseMatches(d.data, c)));
    return {
      docs: filtered.map(d => ({id: d.id, ref: {id: d.id, path: `${ref.path}/${d.id}`}, data: () => d.data})),
      empty: filtered.length === 0,
      size: filtered.length,
    };
  },
  getFirestore: () => ({}),
  limit: () => ({}),
  orderBy: () => ({}),
  query: (ref: any, ...clauses: any[]) => ({
    ...ref,
    clauses: [...(ref.clauses || []), ...clauses.filter(c => c && 'field' in c)],
  }),
  updateDoc: jest.fn(async (ref: any, data: Record<string, unknown>) => {
    if ('participants' in data) mockFixtures.ops.push(`leave ${ref.path}`);
  }),
  where: (field: string, op: string, value: unknown) => ({field, op, value}),
  // Records what it was asked to delete AND removes it from the fixture, so a
  // paging loop terminates the way the real one does.
  writeBatch: () => ({
    delete: (ref: any) => {
      mockFixtures.deleted.push(ref.path);
      mockFixtures.ops.push(`delete ${ref.path}`);
      const slash = ref.path.lastIndexOf('/');
      const parent = ref.path.slice(0, slash);
      const id = ref.path.slice(slash + 1);
      const docs = mockFixtures.collections.get(parent);
      if (docs) mockFixtures.collections.set(parent, docs.filter(d => d.id !== id));
    },
    commit: jest.fn(async () => undefined),
  }),
}));

// Modular shape, matching the call site — and matching what the Firebase JS
// SDK exposes, so this mock stays valid on a platform with no native SDK.
jest.mock('../firebase/storage', () => ({
  getStorage: () => ({}),
  ref: (_storage: unknown, path: string) => ({path}),
  listAll: jest.fn(async () => ({items: [], prefixes: []})),
  deleteObject: jest.fn(async () => undefined),
}));
const mockMmkvClear = jest.fn();
jest.mock('../storageMMKV', () => ({mmkvStorage: {clear: (...a: unknown[]) => mockMmkvClear(...a)}}));
const mockClearDeviceKeypair = jest.fn();
const mockClearRatchetKeys = jest.fn();
const mockClearRatchetSessions = jest.fn();
const mockClearMediaCache = jest.fn();
jest.mock('../errorLog', () => ({reportError: jest.fn()}));
jest.mock('../firebaseChat', () => ({
  deleteStorageObjectByUrl: (...args: unknown[]) => mockDeleteStorageObjectByUrl(...args),
}));
jest.mock('../e2eeKeys', () => ({
  getOrCreateDeviceKeypair: (...args: unknown[]) => mockGetOrCreateDeviceKeypair(...args),
  getDeviceKeypairIfEnrolled: (...args: unknown[]) => mockGetOrCreateDeviceKeypair(...args),
  clearDeviceKeypair: (...args: unknown[]) => mockClearDeviceKeypair(...args),
}));
jest.mock('../ratchetKeys', () => ({
  clearRatchetKeys: (...args: unknown[]) => mockClearRatchetKeys(...args),
}));
jest.mock('../ratchetSessionStore', () => ({
  clearRatchetSessions: (...args: unknown[]) => mockClearRatchetSessions(...args),
}));

jest.mock('../mediaVault', () => ({clearMediaCache: (...args: unknown[]) => mockClearMediaCache(...args)}));

import {clearLocalData, purgeUserData} from '../account';
import {USER_SUBCOLLECTIONS} from '../userSubcollections';
import {encryptMessage, generateKeypair} from '../e2ee';

beforeEach(() => {
  mockCurrentUser = {uid: 'uid1', email: 'a@b.com'};
  mockReauthenticateWithCredential.mockReset().mockResolvedValue(undefined);
  mockDeleteStorageObjectByUrl.mockReset().mockResolvedValue(true);
  mockGetOrCreateDeviceKeypair.mockReset();
  mockMmkvClear.mockReset().mockResolvedValue(undefined);
  mockClearDeviceKeypair.mockReset().mockResolvedValue(undefined);
  mockClearRatchetKeys.mockReset().mockResolvedValue(undefined);
  mockClearRatchetSessions.mockReset().mockResolvedValue(undefined);
  mockClearMediaCache.mockReset().mockResolvedValue(undefined);
  mockFixtures.collections = new Map();
  mockFixtures.deleted = [];
  mockFixtures.ops = [];
});

describe('purgeUserData media cleanup', () => {
  const CHAT_ID = 'chat1';

  function seedChatWithMedia() {
    const me = generateKeypair();
    const peer = generateKeypair();
    const encryptedPayload = encryptMessage(
      'https://storage.example/secret.jpg',
      me.secretKey,
      peer.publicKey,
      CHAT_ID,
    );

    mockFixtures.collections.set('chats', [
      {id: CHAT_ID, data: {participants: ['uid1', 'uid2']}},
    ]);
    mockFixtures.collections.set(`chats/${CHAT_ID}/messages`, [
      {id: 'm1', data: {user: {_id: 'uid1'}, image: 'https://storage.example/plain.jpg', createdAt: 1}},
      {id: 'm2', data: {user: {_id: 'uid1'}, encryptedImage: encryptedPayload, createdAt: 2}},
    ]);
    return {me, peer};
  }

  it('cleans up both plaintext and encrypted media once the device key resolves', async () => {
    const {me} = seedChatWithMedia();
    mockGetOrCreateDeviceKeypair.mockResolvedValue(me);

    const report = await purgeUserData('uid1');

    const deletedUrls = mockDeleteStorageObjectByUrl.mock.calls.map(([url]) => url);
    expect(deletedUrls.sort()).toEqual(
      ['https://storage.example/plain.jpg', 'https://storage.example/secret.jpg'].sort(),
    );
    expect(report.storageObjectsDeleted).toBe(2);
    expect(report.errors).toEqual([]);
  });

  it('still cleans up plaintext media but leaves encrypted media orphaned when the device key is unavailable — same degraded fallback as before this fix', async () => {
    seedChatWithMedia();
    mockGetOrCreateDeviceKeypair.mockRejectedValue(new Error('no key material'));

    const report = await purgeUserData('uid1');

    const deletedUrls = mockDeleteStorageObjectByUrl.mock.calls.map(([url]) => url);
    expect(deletedUrls).toEqual(['https://storage.example/plain.jpg']);
    expect(report.storageObjectsDeleted).toBe(1);
    expect(report.errors.some(e => e.includes('device key unavailable'))).toBe(true);
  });
});

describe('clearLocalData', () => {
  // Every secret that lives in the OS key store has to be named here: the
  // wholesale MMKV wipe does not reach it, so anything omitted outlives the
  // deleted account. That already happened once with the E2EE identity key.
  it('clears every key-store secret, not just MMKV', async () => {
    await clearLocalData('uid1');
    expect(mockClearDeviceKeypair).toHaveBeenCalledWith('uid1');
    expect(mockClearRatchetKeys).toHaveBeenCalledWith('uid1');
    expect(mockClearRatchetSessions).toHaveBeenCalledWith('uid1');
    expect(mockMmkvClear).toHaveBeenCalled();
  });

  // Decrypted attachments are plaintext files outside MMKV, so the wholesale
  // wipe does not reach them either. Omitting this would leave a readable copy
  // of every photo the user opened on a device whose account was deleted.
  it('clears decrypted attachments from the filesystem', async () => {
    await clearLocalData('uid1');
    expect(mockClearMediaCache).toHaveBeenCalled();
  });

  it('still clears the rest when one step fails', async () => {
    // Otherwise a single failing key-store call silently leaves everything
    // after it behind.
    mockClearDeviceKeypair.mockRejectedValue(new Error('keychain unavailable'));
    await clearLocalData('uid1');
    expect(mockClearRatchetKeys).toHaveBeenCalledWith('uid1');
    expect(mockClearRatchetSessions).toHaveBeenCalledWith('uid1');
    expect(mockClearMediaCache).toHaveBeenCalled();
    expect(mockMmkvClear).toHaveBeenCalled();
  });
});

/**
 * Deleting a Firestore document does not delete its subcollections, and every
 * rule inside a chat is gated on being a participant — so anything the purge
 * fails to name before it leaves is not merely left behind. deleteAccount
 * removes the auth user immediately afterwards, and that uid can never sign in
 * again to finish the job.
 */
describe('purgeUserData leaves nothing reachable behind', () => {
  beforeEach(() => {
    mockGetOrCreateDeviceKeypair.mockResolvedValue({secretKey: new Uint8Array(32)});
    mockFixtures.collections.set('chats', [
      {id: 'chat1', data: {participants: ['uid1', 'uid2']}},
    ]);
    mockFixtures.collections.set('chats/chat1/messages', []);
    mockFixtures.collections.set('chats/chat1/scheduledMessages', [
      {id: 's1', data: {text: 'send this later', user: {_id: 'uid1'}}},
      {id: 's2', data: {text: "not mine", user: {_id: 'uid2'}}},
    ]);
    mockFixtures.collections.set('chats/chat1/trash', [
      {id: 't1', data: {deletedBy: 'uid1', text: 'a message I already deleted'}},
      {id: 't2', data: {deletedBy: 'uid2', text: 'theirs'}},
    ]);
    mockFixtures.collections.set('chats/chat1/senderKeys', [
      {id: 'k1', data: {from: 'uid1', to: 'uid2'}},
      {id: 'k2', data: {from: 'uid2', to: 'uid1'}},
    ]);
    mockFixtures.collections.set('users/uid1/oneTimePreKeys', [
      {id: 'p1', data: {publicKey: 'AAAA', claimed: true}},
      {id: 'p2', data: {publicKey: 'BBBB', claimed: false}},
    ]);
  });

  it('deletes the one-time prekeys, which no client could ever reach afterwards', async () => {
    await purgeUserData('uid1');
    expect(mockFixtures.deleted).toContain('users/uid1/oneTimePreKeys/p1');
    expect(mockFixtures.deleted).toContain('users/uid1/oneTimePreKeys/p2');
  });

  // Every name on the shared list has to be visited, not just the ones that
  // happen to be seeded — a subcollection added later and forgotten here is
  // exactly how oneTimePreKeys came to be missed.
  it('visits every subcollection on the shared list', async () => {
    for (const sub of USER_SUBCOLLECTIONS) {
      mockFixtures.collections.set(`users/uid1/${sub}`, [{id: 'd1', data: {}}]);
    }
    await purgeUserData('uid1');
    for (const sub of USER_SUBCOLLECTIONS) {
      expect(mockFixtures.deleted).toContain(`users/uid1/${sub}/d1`);
    }
  });

  it('takes my pending scheduled messages, trash and sender keys out of the chat', async () => {
    await purgeUserData('uid1');
    expect(mockFixtures.deleted).toContain('chats/chat1/scheduledMessages/s1');
    expect(mockFixtures.deleted).toContain('chats/chat1/trash/t1');
    expect(mockFixtures.deleted).toContain('chats/chat1/senderKeys/k1');
    expect(mockFixtures.deleted).toContain('chats/chat1/liveLocations/uid1');
  });

  it("leaves the other participant's documents alone", async () => {
    await purgeUserData('uid1');
    expect(mockFixtures.deleted).not.toContain('chats/chat1/scheduledMessages/s2');
    expect(mockFixtures.deleted).not.toContain('chats/chat1/trash/t2');
    expect(mockFixtures.deleted).not.toContain('chats/chat1/senderKeys/k2');
  });

  // Ordering is the whole game: once participants loses the uid, every rule in
  // the chat denies it, and deleteAccount is one line away.
  it('clears the chat subcollections before leaving the chat', async () => {
    await purgeUserData('uid1');
    const leftAt = mockFixtures.ops.indexOf('leave chats/chat1');
    expect(leftAt).toBeGreaterThan(-1);
    for (const suffix of ['scheduledMessages/s1', 'trash/t1', 'senderKeys/k1', 'liveLocations/uid1']) {
      const deletedAt = mockFixtures.ops.indexOf(`delete chats/chat1/${suffix}`);
      expect(deletedAt).toBeGreaterThan(-1);
      expect(deletedAt).toBeLessThan(leftAt);
    }
  });
});
