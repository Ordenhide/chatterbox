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
} = {collections: new Map()};

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
  deleteDoc: jest.fn(async () => undefined),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDocs: async (ref: any) => {
    const all = mockFixtures.collections.get(ref.path) || [];
    const filtered = all.filter(d => (ref.clauses || []).every((c: any) => mockClauseMatches(d.data, c)));
    return {
      docs: filtered.map(d => ({id: d.id, ref: {id: d.id}, data: () => d.data})),
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
  updateDoc: jest.fn(async () => undefined),
  where: (field: string, op: string, value: unknown) => ({field, op, value}),
  writeBatch: () => ({delete: jest.fn(), commit: jest.fn(async () => undefined)}),
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
jest.mock('../telemetry', () => ({reportError: jest.fn()}));
jest.mock('../firebaseChat', () => ({
  deleteStorageObjectByUrl: (...args: unknown[]) => mockDeleteStorageObjectByUrl(...args),
}));
jest.mock('../e2eeKeys', () => ({
  getOrCreateDeviceKeypair: (...args: unknown[]) => mockGetOrCreateDeviceKeypair(...args),
  clearDeviceKeypair: (...args: unknown[]) => mockClearDeviceKeypair(...args),
}));
jest.mock('../ratchetKeys', () => ({
  clearRatchetKeys: (...args: unknown[]) => mockClearRatchetKeys(...args),
}));
jest.mock('../ratchetSessionStore', () => ({
  clearRatchetSessions: (...args: unknown[]) => mockClearRatchetSessions(...args),
}));

import {clearLocalData, purgeUserData} from '../account';
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
  mockFixtures.collections = new Map();
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

  it('still clears the rest when one step fails', async () => {
    // Otherwise a single failing key-store call silently leaves everything
    // after it behind.
    mockClearDeviceKeypair.mockRejectedValue(new Error('keychain unavailable'));
    await clearLocalData('uid1');
    expect(mockClearRatchetKeys).toHaveBeenCalledWith('uid1');
    expect(mockClearRatchetSessions).toHaveBeenCalledWith('uid1');
    expect(mockMmkvClear).toHaveBeenCalled();
  });
});
