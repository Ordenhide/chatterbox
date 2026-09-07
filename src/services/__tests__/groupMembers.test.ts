const mockDocs = new Map<string, {participants?: string[]}>();
const mockWrites: Array<{path: string; data: Record<string, unknown>}> = [];

jest.mock('../firebase/firestore', () => ({
  arrayUnion: (...ids: string[]) => ({__op: 'union', ids}),
  arrayRemove: (...ids: string[]) => ({__op: 'remove', ids}),
  collection: (_db: unknown, ...s: string[]) => ({path: s.join('/')}),
  doc: (refOrDb: any, ...s: string[]) =>
    ({path: [refOrDb?.path, ...s].filter(Boolean).join('/')}),
  getDoc: async (ref: {path: string}) => {
    const d = mockDocs.get(ref.path);
    return {exists: () => !!d, data: () => d};
  },
  setDoc: async (ref: {path: string}, data: Record<string, unknown>) => {
    mockWrites.push({path: ref.path, data});
  },
  getDocs: async () => ({empty: true, docs: [], size: 0}),
  getFirestore: () => ({}),
  deleteField: jest.fn(),
  deleteDoc: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: () => 'TS',
  startAfter: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(),
}));
jest.mock('../firebase/storage', () => ({
  getStorage: () => ({}),
  getDownloadURL: jest.fn(),
  putFile: jest.fn(),
  ref: jest.fn(),
  refFromURL: jest.fn(),
  deleteObject: jest.fn(),
}));
jest.mock('../errorLog', () => ({reportError: jest.fn()}));
jest.mock('../privacyGuard', () => ({isStealthMode: () => false}));
jest.mock('../recipient', () => ({assertRecipientReachable: jest.fn()}));
jest.mock('../messageTrash', () => ({purgeExpiredTrash: jest.fn(), trashMessages: jest.fn()}));
jest.mock('../e2eeKeys', () => ({getOrCreateDeviceKeypair: jest.fn()}));

import {MAX_GROUP_MEMBERS} from '../e2ee';
import {addChatMembers, GroupFullError, leaveChat} from '../firebaseChat';

beforeEach(() => {
  mockDocs.clear();
  mockWrites.length = 0;
  mockDocs.set('chats/g1', {participants: ['alice', 'bob']});
});

describe('addChatMembers', () => {
  // arrayUnion, not a rewritten array: two people adding someone at the same
  // moment must not clobber each other, since a dropped member would never be
  // sealed to and could not read anything.
  it('adds via arrayUnion rather than rewriting the member list', async () => {
    await addChatMembers('g1', ['carol']);
    expect(mockWrites).toHaveLength(1);
    expect(mockWrites[0].data.participants).toEqual({__op: 'union', ids: ['carol']});
  });

  it('de-duplicates the ids it is handed', async () => {
    await addChatMembers('g1', ['carol', 'carol', '']);
    expect(mockWrites[0].data.participants).toEqual({__op: 'union', ids: ['carol']});
  });

  it('writes nothing when there is nobody to add', async () => {
    await addChatMembers('g1', []);
    expect(mockWrites).toHaveLength(0);
  });

  it('refuses to exceed the cap, and writes nothing when it refuses', async () => {
    mockDocs.set('chats/g1', {
      participants: Array.from({length: MAX_GROUP_MEMBERS}, (_, i) => `u${i}`),
    });
    await expect(addChatMembers('g1', ['one-too-many'])).rejects.toThrow(GroupFullError);
    expect(mockWrites).toHaveLength(0);
  });

  it('allows a re-add that does not actually grow the group', async () => {
    mockDocs.set('chats/g1', {
      participants: Array.from({length: MAX_GROUP_MEMBERS}, (_, i) => `u${i}`),
    });
    await expect(addChatMembers('g1', ['u0'])).resolves.toBeUndefined();
  });
});

describe('leaveChat', () => {
  it('removes only the leaving user', async () => {
    await leaveChat('g1', 'bob');
    expect(mockWrites[0].data.participants).toEqual({__op: 'remove', ids: ['bob']});
  });
});

// The cap is a shared contract: the two clients seal into the same documents
// and the Firestore rule enforces the same number, so a drift here would let
// one client create groups another refuses to write to.
describe('cap agreement', () => {
  it('matches the value the rules and the web client enforce', () => {
    expect(MAX_GROUP_MEMBERS).toBe(32);
  });
});
