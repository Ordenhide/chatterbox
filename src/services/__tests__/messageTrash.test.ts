// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockStore: {
  messages: Map<string, Record<string, unknown>>;
  trash: Map<string, Record<string, unknown>>;
  setDocCalls: {path: string; data: Record<string, unknown>}[];
  deleted: string[];
  batchDeleted: string[];
} = {
  messages: new Map(),
  trash: new Map(),
  setDocCalls: [],
  deleted: [],
  batchDeleted: [],
};
const mockDeleteObject = jest.fn(async (_url: string) => undefined);
const mockResolveMedia = jest.fn(() => [] as string[]);
const mockGetKeypair = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (parent: {path?: string} | undefined, ...segments: string[]) => ({
    path: parent?.path ? `${parent.path}/${segments.join('/')}` : segments.join('/'),
  }),
  doc: (parent: {path?: string} | undefined, ...segments: string[]) => ({
    path: parent?.path ? `${parent.path}/${segments.join('/')}` : segments.join('/'),
  }),
  getDoc: async (ref: {path: string}) => {
    const data = ref.path.includes('/trash/')
      ? mockStore.trash.get(ref.path)
      : mockStore.messages.get(ref.path);
    return {exists: !!data, data: () => data, ref};
  },
  getDocs: jest.fn(async () => ({
    docs: [...mockStore.trash.entries()].map(([path, data]) => ({
      id: path.split('/').pop(),
      data: () => data,
      ref: {path},
    })),
  })),
  onSnapshot: () => () => {},
  query: (ref: unknown) => ref,
  setDoc: jest.fn(async (ref: {path: string}, data: Record<string, unknown>) => {
    mockStore.setDocCalls.push({path: ref.path, data});
    if (ref.path.includes('/trash/')) mockStore.trash.set(ref.path, data);
    else mockStore.messages.set(ref.path, data);
  }),
  deleteDoc: jest.fn(async (ref: {path: string}) => {
    mockStore.deleted.push(ref.path);
    mockStore.trash.delete(ref.path);
  }),
  where: () => ({}),
  writeBatch: () => ({
    delete: (ref: {path: string}) => {
      mockStore.batchDeleted.push(ref.path);
      mockStore.messages.delete(ref.path);
    },
    commit: async () => undefined,
  }),
}));
jest.mock('@react-native-firebase/storage', () => ({
  getStorage: () => ({}),
  refFromURL: (_s: unknown, url: string) => url,
  deleteObject: (url: string) => mockDeleteObject(url),
}));
jest.mock('../messageMedia', () => ({
  resolveMessageMediaUrls: (...args: unknown[]) => mockResolveMedia(...(args as [])),
}));
jest.mock('../e2eeKeys', () => ({getOrCreateDeviceKeypair: () => mockGetKeypair()}));

import {
  formatRemaining,
  isTrashExpired,
  msRemaining,
  purgeExpiredTrash,
  recoverMessage,
  TRASH_RETENTION_MS,
  trashMessages,
} from '../messageTrash';

const CHAT = 'c1';
const KEYPAIR = {secretKey: new Uint8Array([1, 2, 3]), publicKey: new Uint8Array([4, 5, 6])};
const msgPath = (id: string) => `chats/${CHAT}/messages/${id}`;
const trashPath = (id: string) => `chats/${CHAT}/trash/${id}`;

beforeEach(() => {
  mockStore.messages = new Map();
  mockStore.trash = new Map();
  mockStore.setDocCalls = [];
  mockStore.deleted = [];
  mockStore.batchDeleted = [];
  mockDeleteObject.mockReset().mockResolvedValue(undefined);
  mockResolveMedia.mockReset().mockReturnValue([]);
  mockGetKeypair.mockReset().mockResolvedValue(KEYPAIR);
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
  });

  it('reports time remaining, floored at zero', () => {
    expect(msRemaining(now, now)).toBe(TRASH_RETENTION_MS);
    expect(msRemaining(now - TRASH_RETENTION_MS * 2, now)).toBe(0);
  });

  it('formats a coarse countdown', () => {
    expect(formatRemaining(now, now)).toBe('24h');
    expect(formatRemaining(now - (TRASH_RETENTION_MS - 30 * 60_000), now)).toBe('30m');
    expect(formatRemaining(now - TRASH_RETENTION_MS, now)).toBe('0m');
  });

  it('matches the web window exactly, so the two platforms agree', () => {
    expect(TRASH_RETENTION_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('trashMessages', () => {
  it('copies into the trash before removing from the thread', async () => {
    mockStore.messages.set(msgPath('m1'), {text: 'hi'});
    const moved = await trashMessages(CHAT, ['m1'], 'alice');

    expect(moved).toEqual(['m1']);
    expect(mockStore.setDocCalls[0].path).toBe(trashPath('m1'));
    expect(mockStore.batchDeleted).toEqual([msgPath('m1')]);
  });

  it('stores the payload verbatim plus who deleted it', async () => {
    mockStore.messages.set(msgPath('m1'), {text: 'hi', image: 'https://x/a.jpg'});
    await trashMessages(CHAT, ['m1'], 'alice');

    const entry = mockStore.trash.get(trashPath('m1')) as {
      payload: Record<string, unknown>;
      deletedBy: string;
    };
    expect(entry.payload).toEqual({text: 'hi', image: 'https://x/a.jpg'});
    expect(entry.deletedBy).toBe('alice');
  });

  // The invariant that makes recovery work: the blob must outlive the delete.
  it('never touches Storage — media must survive for recovery', async () => {
    mockStore.messages.set(msgPath('m1'), {text: 'hi', image: 'https://x/a.jpg'});
    mockResolveMedia.mockReturnValue(['https://x/a.jpg']);
    await trashMessages(CHAT, ['m1'], 'alice');
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it('skips a message that is already gone', async () => {
    mockStore.messages.set(msgPath('m2'), {text: 'still here'});
    expect(await trashMessages(CHAT, ['missing', 'm2'], 'alice')).toEqual(['m2']);
  });
});

describe('recoverMessage', () => {
  it('restores the original payload and clears the trash entry', async () => {
    mockStore.trash.set(trashPath('m1'), {
      payload: {text: 'hi'},
      deletedBy: 'alice',
      deletedAt: Date.now(),
    });
    expect(await recoverMessage(CHAT, 'm1')).toBe(true);
    expect(mockStore.messages.get(msgPath('m1'))).toEqual({text: 'hi'});
    expect(mockStore.deleted).toContain(trashPath('m1'));
  });

  it('refuses once the window has closed', async () => {
    mockStore.trash.set(trashPath('m1'), {
      payload: {text: 'hi'},
      deletedBy: 'alice',
      deletedAt: Date.now() - TRASH_RETENTION_MS - 1,
    });
    expect(await recoverMessage(CHAT, 'm1')).toBe(false);
    expect(mockStore.messages.has(msgPath('m1'))).toBe(false);
  });

  it('returns false for a message that was never trashed', async () => {
    expect(await recoverMessage(CHAT, 'nope')).toBe(false);
  });
});

describe('purgeExpiredTrash', () => {
  it('removes only entries past the window', async () => {
    mockStore.trash.set(trashPath('old'), {
      payload: {},
      deletedBy: 'alice',
      deletedAt: Date.now() - TRASH_RETENTION_MS - 1,
    });
    mockStore.trash.set(trashPath('new'), {payload: {}, deletedBy: 'alice', deletedAt: Date.now()});

    expect(await purgeExpiredTrash(CHAT, 'alice')).toBe(1);
    expect(mockStore.deleted).toEqual([trashPath('old')]);
  });

  it('deletes Storage media for expired entries', async () => {
    mockStore.trash.set(trashPath('old'), {
      payload: {image: 'https://x/a.jpg'},
      deletedBy: 'alice',
      deletedAt: 0,
    });
    mockResolveMedia.mockReturnValue(['https://x/a.jpg']);
    await purgeExpiredTrash(CHAT, 'alice');
    expect(mockDeleteObject).toHaveBeenCalledWith('https://x/a.jpg');
  });

  it('still purges when the device key is unavailable', async () => {
    mockGetKeypair.mockRejectedValue(new Error('no key'));
    mockStore.trash.set(trashPath('old'), {payload: {text: 'x'}, deletedBy: 'alice', deletedAt: 0});

    expect(await purgeExpiredTrash(CHAT, 'alice')).toBe(1);
    expect(mockResolveMedia).toHaveBeenCalledWith({text: 'x'}, null, CHAT);
  });

  it('never lets a Storage failure propagate', async () => {
    mockStore.trash.set(trashPath('old'), {
      payload: {image: 'https://x/a.jpg'},
      deletedBy: 'alice',
      deletedAt: 0,
    });
    mockResolveMedia.mockReturnValue(['https://x/a.jpg']);
    mockDeleteObject.mockRejectedValue(new Error('storage down'));

    await expect(purgeExpiredTrash(CHAT, 'alice')).resolves.toBe(1);
  });
});
