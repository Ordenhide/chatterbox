import {beforeEach, describe, expect, it, vi} from 'vitest';

const store = vi.hoisted(() => ({
  messages: new Map<string, Record<string, unknown>>(),
  trash: new Map<string, Record<string, unknown>>(),
  setDocCalls: [] as {path: string; data: Record<string, unknown>}[],
  deleted: [] as string[],
  batchDeleted: [] as string[],
}));

const refPath = (segments: string[]) => segments.join('/');

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({path: refPath(segments)}),
  doc: (parent: unknown, ...segments: string[]) => {
    const base = (parent as {path?: string})?.path;
    return {path: base ? `${base}/${segments.join('/')}` : refPath(segments)};
  },
  deleteDoc: vi.fn(async (ref: {path: string}) => {
    store.deleted.push(ref.path);
    store.trash.delete(ref.path);
  }),
  getDoc: async (ref: {path: string}) => {
    const data = ref.path.includes('/trash/')
      ? store.trash.get(ref.path)
      : store.messages.get(ref.path);
    return {exists: () => !!data, data: () => data, ref};
  },
  getDocs: vi.fn(async () => ({
    docs: [...store.trash.entries()].map(([path, data]) => ({
      id: path.split('/').pop(),
      data: () => data,
      ref: {path},
    })),
  })),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: (ref: unknown) => ref,
  setDoc: vi.fn(async (ref: {path: string}, data: Record<string, unknown>) => {
    store.setDocCalls.push({path: ref.path, data});
    if (ref.path.includes('/trash/')) store.trash.set(ref.path, data);
    else store.messages.set(ref.path, data);
  }),
  where: () => ({}),
  writeBatch: () => ({
    delete: (ref: {path: string}) => {
      store.batchDeleted.push(ref.path);
      store.messages.delete(ref.path);
    },
    commit: async () => undefined,
  }),
}));
vi.mock('../firebase', () => ({db: {}}));
vi.mock('./messageMedia', () => ({resolveMessageMediaUrls: vi.fn(() => [])}));
vi.mock('./storage', () => ({deleteStorageObjectByUrl: vi.fn(async () => true)}));
vi.mock('./e2eeKeys', () => ({getOrCreateDeviceKeypair: vi.fn()}));

import {
  formatRemaining,
  isTrashExpired,
  msRemaining,
  purgeExpiredTrash,
  recoverMessage,
  TRASH_RETENTION_MS,
  trashMessages,
} from './messageTrash';
import {resolveMessageMediaUrls} from './messageMedia';
import {deleteStorageObjectByUrl} from './storage';
import {getOrCreateDeviceKeypair} from './e2eeKeys';

const CHAT = 'c1';
const KEYPAIR = {secretKey: new Uint8Array([1, 2, 3]), publicKey: new Uint8Array([4, 5, 6])};
const msgPath = (id: string) => `chats/${CHAT}/messages/${id}`;
const trashPath = (id: string) => `chats/${CHAT}/trash/${id}`;

beforeEach(() => {
  store.messages = new Map();
  store.trash = new Map();
  store.setDocCalls = [];
  store.deleted = [];
  store.batchDeleted = [];
  vi.mocked(resolveMessageMediaUrls).mockReset().mockReturnValue([]);
  vi.mocked(deleteStorageObjectByUrl).mockReset().mockResolvedValue(true);
  vi.mocked(getOrCreateDeviceKeypair).mockReset().mockResolvedValue(KEYPAIR);
});

describe('retention window', () => {
  const now = 1_000_000_000_000;

  it('is not expired inside the window', () => {
    expect(isTrashExpired(now - TRASH_RETENTION_MS + 60_000, now)).toBe(false);
  });

  it('is expired exactly at the boundary', () => {
    expect(isTrashExpired(now - TRASH_RETENTION_MS, now)).toBe(true);
  });

  it('treats an unreadable timestamp as expired rather than recoverable forever', () => {
    expect(isTrashExpired(NaN, now)).toBe(true);
    expect(isTrashExpired(undefined as unknown as number, now)).toBe(true);
  });

  it('reports time remaining, floored at zero', () => {
    expect(msRemaining(now, now)).toBe(TRASH_RETENTION_MS);
    expect(msRemaining(now - TRASH_RETENTION_MS * 2, now)).toBe(0);
  });

  it('formats a coarse countdown', () => {
    expect(formatRemaining(now, now)).toBe('24h');
    expect(formatRemaining(now - (TRASH_RETENTION_MS - 30 * 60_000), now)).toBe('30m');
    expect(formatRemaining(now - (TRASH_RETENTION_MS - 5_000), now)).toBe('5s');
    expect(formatRemaining(now - TRASH_RETENTION_MS, now)).toBe('0m');
  });
});

describe('trashMessages', () => {
  it('copies the message into the trash before removing it from the thread', async () => {
    store.messages.set(msgPath('m1'), {text: 'hi'});
    const moved = await trashMessages(CHAT, ['m1'], 'alice');

    expect(moved).toEqual(['m1']);
    // Copy first: a failed copy must leave the message in the thread rather
    // than losing it outright.
    expect(store.setDocCalls[0].path).toBe(trashPath('m1'));
    expect(store.batchDeleted).toEqual([msgPath('m1')]);
  });

  it('stores the payload verbatim plus who deleted it and when', async () => {
    store.messages.set(msgPath('m1'), {text: 'hi', image: 'https://x/a.jpg'});
    await trashMessages(CHAT, ['m1'], 'alice');

    const entry = store.trash.get(trashPath('m1')) as {
      payload: Record<string, unknown>;
      deletedBy: string;
      deletedAt: number;
    };
    expect(entry.payload).toEqual({text: 'hi', image: 'https://x/a.jpg'});
    expect(entry.deletedBy).toBe('alice');
    expect(typeof entry.deletedAt).toBe('number');
  });

  it('skips a message that is already gone instead of failing the whole delete', async () => {
    store.messages.set(msgPath('m2'), {text: 'still here'});
    const moved = await trashMessages(CHAT, ['missing', 'm2'], 'alice');
    expect(moved).toEqual(['m2']);
  });

  it('never touches Storage — media must survive for recovery', async () => {
    store.messages.set(msgPath('m1'), {text: 'hi', image: 'https://x/a.jpg'});
    vi.mocked(resolveMessageMediaUrls).mockReturnValue(['https://x/a.jpg']);
    await trashMessages(CHAT, ['m1'], 'alice');
    expect(deleteStorageObjectByUrl).not.toHaveBeenCalled();
  });

  it('de-duplicates ids', async () => {
    store.messages.set(msgPath('m1'), {text: 'hi'});
    const moved = await trashMessages(CHAT, ['m1', 'm1'], 'alice');
    expect(moved).toEqual(['m1']);
  });
});

describe('recoverMessage', () => {
  it('restores the original payload and clears the trash entry', async () => {
    store.trash.set(trashPath('m1'), {payload: {text: 'hi'}, deletedBy: 'alice', deletedAt: Date.now()});
    const ok = await recoverMessage(CHAT, 'm1');

    expect(ok).toBe(true);
    expect(store.messages.get(msgPath('m1'))).toEqual({text: 'hi'});
    expect(store.deleted).toContain(trashPath('m1'));
  });

  it('restores before clearing, so a failure leaves it recoverable', async () => {
    store.trash.set(trashPath('m1'), {payload: {text: 'hi'}, deletedBy: 'alice', deletedAt: Date.now()});
    await recoverMessage(CHAT, 'm1');
    // The message write lands before the trash entry is removed.
    expect(store.setDocCalls.map(c => c.path)).toContain(msgPath('m1'));
  });

  it('refuses once the window has closed', async () => {
    store.trash.set(trashPath('m1'), {
      payload: {text: 'hi'},
      deletedBy: 'alice',
      deletedAt: Date.now() - TRASH_RETENTION_MS - 1,
    });
    expect(await recoverMessage(CHAT, 'm1')).toBe(false);
    expect(store.messages.has(msgPath('m1'))).toBe(false);
  });

  it('returns false for a message that was never trashed', async () => {
    expect(await recoverMessage(CHAT, 'nope')).toBe(false);
  });
});

describe('purgeExpiredTrash', () => {
  it('removes only entries past the window', async () => {
    store.trash.set(trashPath('old'), {payload: {}, deletedBy: 'alice', deletedAt: Date.now() - TRASH_RETENTION_MS - 1});
    store.trash.set(trashPath('new'), {payload: {}, deletedBy: 'alice', deletedAt: Date.now()});

    expect(await purgeExpiredTrash(CHAT, 'alice')).toBe(1);
    expect(store.deleted).toEqual([trashPath('old')]);
  });

  it('deletes Storage media before the document, so no blob is orphaned', async () => {
    store.trash.set(trashPath('old'), {
      payload: {image: 'https://x/a.jpg'},
      deletedBy: 'alice',
      deletedAt: Date.now() - TRASH_RETENTION_MS - 1,
    });
    vi.mocked(resolveMessageMediaUrls).mockReturnValue(['https://x/a.jpg']);

    const order: string[] = [];
    vi.mocked(deleteStorageObjectByUrl).mockImplementation(async () => {
      order.push('storage');
      return true;
    });
    await purgeExpiredTrash(CHAT, 'alice');
    order.push('doc');

    expect(order).toEqual(['storage', 'doc']);
    expect(deleteStorageObjectByUrl).toHaveBeenCalledWith('https://x/a.jpg');
  });

  it('still purges when the device key is unavailable, just without decrypting media', async () => {
    vi.mocked(getOrCreateDeviceKeypair).mockRejectedValue(new Error('no key'));
    store.trash.set(trashPath('old'), {payload: {text: 'x'}, deletedBy: 'alice', deletedAt: 0});

    expect(await purgeExpiredTrash(CHAT, 'alice')).toBe(1);
    expect(resolveMessageMediaUrls).toHaveBeenCalledWith({text: 'x'}, null, CHAT);
  });

  it('never lets a Storage failure propagate', async () => {
    store.trash.set(trashPath('old'), {payload: {image: 'https://x/a.jpg'}, deletedBy: 'alice', deletedAt: 0});
    vi.mocked(resolveMessageMediaUrls).mockReturnValue(['https://x/a.jpg']);
    vi.mocked(deleteStorageObjectByUrl).mockRejectedValue(new Error('storage down'));

    await expect(purgeExpiredTrash(CHAT, 'alice')).resolves.toBe(1);
  });
});
