import {beforeEach, describe, expect, it, vi} from 'vitest';

const mockDocs = vi.hoisted(() => ({data: new Map<string, Record<string, unknown> | undefined>()}));
const mockBatch = vi.hoisted(() => ({
  delete: vi.fn(),
  commit: vi.fn(async () => undefined),
}));

vi.mock('firebase/firestore', () => ({
  arrayRemove: (v: unknown) => v,
  arrayUnion: (v: unknown) => v,
  collection: (..._args: unknown[]) => ({}),
  deleteDoc: vi.fn(async () => undefined),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments[segments.length - 1]}),
  getDoc: async (ref: {path: string}) => {
    const data = mockDocs.data.get(ref.path);
    return {exists: () => !!data, data: () => data};
  },
  getDocs: vi.fn(async () => ({docs: [], empty: true})),
  limit: () => ({}),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: (ref: unknown, ..._clauses: unknown[]) => ref,
  runTransaction: vi.fn(),
  serverTimestamp: () => ({}),
  setDoc: vi.fn(async () => undefined),
  startAfter: () => ({}),
  Timestamp: {now: () => ({})},
  where: () => ({}),
  writeBatch: () => mockBatch,
}));
vi.mock('../firebase', () => ({db: {}}));
vi.mock('./firestoreBatch', () => ({deleteQueryInChunks: vi.fn(async () => 0)}));
vi.mock('./recipient', () => ({assertRecipientReachable: vi.fn(async () => undefined)}));
vi.mock('./messageMedia', () => ({resolveMessageMediaUrls: vi.fn(() => [])}));
vi.mock('./storage', () => ({deleteStorageObjectByUrl: vi.fn(async () => true)}));
vi.mock('./e2eeKeys', () => ({getOrCreateDeviceKeypair: vi.fn()}));
vi.mock('./messageTrash', () => ({
  trashMessages: vi.fn(async () => []),
  purgeExpiredTrash: vi.fn(async () => 0),
}));

import {deleteMessage, deleteMessages} from './chat';
import {deleteStorageObjectByUrl} from './storage';
import {purgeExpiredTrash, trashMessages} from './messageTrash';

const CHAT_ID = 'chat1';

beforeEach(() => {
  mockDocs.data = new Map();
  mockBatch.delete.mockReset();
  mockBatch.commit.mockReset().mockResolvedValue(undefined);
  vi.mocked(deleteStorageObjectByUrl).mockReset().mockResolvedValue(true);
  vi.mocked(trashMessages).mockReset().mockResolvedValue([]);
  vi.mocked(purgeExpiredTrash).mockReset().mockResolvedValue(0);
});

describe('deleteMessages', () => {
  it('moves messages to the trash instead of destroying them', async () => {
    await deleteMessages(CHAT_ID, ['m1', 'm2'], 'uid1');
    expect(trashMessages).toHaveBeenCalledWith(CHAT_ID, ['m1', 'm2'], 'uid1');
  });

  // The invariant that makes recovery work at all: if the blob were deleted
  // here, recovering the message would restore a pointer to a 404.
  it('does NOT delete Storage media at delete time — that waits for the purge', async () => {
    await deleteMessages(CHAT_ID, ['m1'], 'uid1');
    expect(deleteStorageObjectByUrl).not.toHaveBeenCalled();
  });

  it('opportunistically sweeps expired trash, since no scheduled job exists', async () => {
    await deleteMessages(CHAT_ID, ['m1'], 'uid1');
    expect(purgeExpiredTrash).toHaveBeenCalledWith(CHAT_ID, 'uid1');
  });

  it('never lets a purge failure fail the delete the user asked for', async () => {
    vi.mocked(purgeExpiredTrash).mockRejectedValue(new Error('offline'));
    await expect(deleteMessages(CHAT_ID, ['m1'], 'uid1')).resolves.toBeUndefined();
  });

  it('surfaces a failure to move the message, rather than reporting a delete that did not happen', async () => {
    vi.mocked(trashMessages).mockRejectedValue(new Error('permission denied'));
    await expect(deleteMessages(CHAT_ID, ['m1'], 'uid1')).rejects.toThrow('permission denied');
  });
});

describe('deleteMessage', () => {
  it('delegates to deleteMessages with a single-element array', async () => {
    await deleteMessage(CHAT_ID, 'm1', 'uid1');
    expect(trashMessages).toHaveBeenCalledWith(CHAT_ID, ['m1'], 'uid1');
  });
});
