import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MAX_GROUP_MEMBERS} from './e2ee';

/** Firestore stand-in keyed by doc path, recording what was written. */
const docs = new Map<string, {participants?: string[]}>();
const writes: Array<{path: string; data: Record<string, unknown>}> = [];

vi.mock('firebase/firestore', () => ({
  arrayUnion: (...ids: string[]) => ({__op: 'union', ids}),
  arrayRemove: (...ids: string[]) => ({__op: 'remove', ids}),
  collection: (_db: unknown, ...s: string[]) => ({path: s.join('/')}),
  doc: (_db: unknown, ...s: string[]) => ({path: s.join('/')}),
  getDoc: async (ref: {path: string}) => {
    const d = docs.get(ref.path);
    return {exists: () => !!d, data: () => d};
  },
  setDoc: async (ref: {path: string}, data: Record<string, unknown>) => {
    writes.push({path: ref.path, data});
  },
  getDocs: async () => ({empty: true, docs: []}),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: () => 'TS',
  startAfter: vi.fn(),
  where: vi.fn(),
  runTransaction: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: {fromMillis: (n: number) => n},
}));
vi.mock('../firebase', () => ({db: {}}));
vi.mock('./firestoreBatch', () => ({deleteQueryInChunks: vi.fn()}));
vi.mock('./recipient', () => ({assertRecipientReachable: vi.fn()}));
vi.mock('./messageTrash', () => ({purgeExpiredTrash: vi.fn(), trashMessages: vi.fn()}));

import {addChatMembers, GroupFullError, leaveChat} from './chat';

beforeEach(() => {
  docs.clear();
  writes.length = 0;
  docs.set('chats/g1', {participants: ['alice', 'bob']});
});

describe('addChatMembers', () => {
  // arrayUnion, not a rewritten array: two people adding someone at the same
  // moment must not clobber each other, since a dropped member would never be
  // sealed to and could not read anything.
  it('adds via arrayUnion rather than rewriting the member list', async () => {
    await addChatMembers('g1', ['carol']);
    expect(writes).toHaveLength(1);
    expect(writes[0].data.participants).toEqual({__op: 'union', ids: ['carol']});
  });

  it('de-duplicates the ids it is handed', async () => {
    await addChatMembers('g1', ['carol', 'carol', '']);
    expect(writes[0].data.participants).toEqual({__op: 'union', ids: ['carol']});
  });

  it('writes nothing when there is nobody to add', async () => {
    await addChatMembers('g1', []);
    expect(writes).toHaveLength(0);
  });

  it('refuses to exceed the cap, and writes nothing when it refuses', async () => {
    docs.set('chats/g1', {
      participants: Array.from({length: MAX_GROUP_MEMBERS}, (_, i) => `u${i}`),
    });
    await expect(addChatMembers('g1', ['one-too-many'])).rejects.toThrow(GroupFullError);
    expect(writes).toHaveLength(0);
  });

  // Re-adding an existing member keeps the group the same size, so it must not
  // trip the cap check.
  it('allows a re-add that does not actually grow the group', async () => {
    docs.set('chats/g1', {
      participants: Array.from({length: MAX_GROUP_MEMBERS}, (_, i) => `u${i}`),
    });
    await expect(addChatMembers('g1', ['u0'])).resolves.toBeUndefined();
  });
});

describe('leaveChat', () => {
  it('removes only the leaving user', async () => {
    await leaveChat('g1', 'bob');
    expect(writes[0].data.participants).toEqual({__op: 'remove', ids: ['bob']});
  });
});
