// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockDocs: {
  data: Map<string, Record<string, unknown> | undefined>;
} = {data: new Map()};

const mockResolveMessageMediaUrls = jest.fn();
const mockGetOrCreateDeviceKeypair = jest.fn();
const mockDeleteObject = jest.fn();
const mockTrashMessages = jest.fn();
const mockPurgeExpiredTrash = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn(async () => undefined);

jest.mock('../firebase/firestore', () => ({
  collection: (..._args: unknown[]) => ({}),
  deleteField: () => ({}),
  doc: (_parent: unknown, id: string) => ({path: id}),
  deleteDoc: jest.fn(async () => undefined),
  getDoc: async (ref: {path: string}) => {
    const data = mockDocs.data.get(ref.path);
    return {exists: () => !!data, data: () => data};
  },
  getDocs: jest.fn(async () => ({docs: [], empty: true})),
  getFirestore: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: (ref: unknown, ..._clauses: unknown[]) => ref,
  runTransaction: jest.fn(),
  serverTimestamp: () => ({}),
  setDoc: jest.fn(async () => undefined),
  startAfter: () => ({}),
  where: () => ({}),
  writeBatch: () => ({
    delete: (...args: unknown[]) => mockBatchDelete(...args),
    commit: () => mockBatchCommit(),
  }),
}));

jest.mock('../firebase/storage', () => ({
  getStorage: () => ({}),
  getDownloadURL: jest.fn(),
  putFile: jest.fn(),
  ref: () => ({}),
  refFromURL: (_storage: unknown, url: string) => ({url}),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

jest.mock('../telemetry', () => ({reportError: jest.fn()}));
jest.mock('../privacyGuard', () => ({isStealthMode: jest.fn(() => false)}));
jest.mock('../crypto', () => ({
  decryptWithPassphrase: jest.fn(),
  encryptWithPassphrase: jest.fn(),
}));
jest.mock('../recipient', () => ({assertRecipientReachable: jest.fn(async () => undefined)}));
jest.mock('../messageMedia', () => ({
  resolveMessageMediaUrls: (...args: unknown[]) => mockResolveMessageMediaUrls(...args),
}));
jest.mock('../e2eeKeys', () => ({
  getOrCreateDeviceKeypair: (...args: unknown[]) => mockGetOrCreateDeviceKeypair(...args),
}));

import {deleteMessages} from '../firebaseChat';

const CHAT_ID = 'chat1';
const KEYPAIR = {secretKey: new Uint8Array([1, 2, 3]), publicKey: new Uint8Array([4, 5, 6])};

beforeEach(() => {
  mockDocs.data = new Map();
  mockResolveMessageMediaUrls.mockReset().mockReturnValue([]);
  mockGetOrCreateDeviceKeypair.mockReset().mockResolvedValue(KEYPAIR);
  mockDeleteObject.mockReset().mockResolvedValue(undefined);
  mockBatchDelete.mockReset();
  mockBatchCommit.mockReset().mockResolvedValue(undefined);
});

jest.mock('../messageTrash', () => ({
  trashMessages: (...args: unknown[]) => mockTrashMessages(...args),
  purgeExpiredTrash: (...args: unknown[]) => mockPurgeExpiredTrash(...args),
}));

describe('deleteMessages', () => {
  beforeEach(() => {
    mockTrashMessages.mockReset().mockResolvedValue([]);
    mockPurgeExpiredTrash.mockReset().mockResolvedValue(0);
  });

  it('moves messages to the trash instead of destroying them', async () => {
    await deleteMessages('chat1', ['m1', 'm2'], 'uid1');
    expect(mockTrashMessages).toHaveBeenCalledWith('chat1', ['m1', 'm2'], 'uid1');
  });

  it('coerces numeric message ids to strings, matching the document ids', async () => {
    await deleteMessages('chat1', [42 as unknown as string], 'uid1');
    expect(mockTrashMessages).toHaveBeenCalledWith('chat1', ['42'], 'uid1');
  });

  // The invariant that makes recovery work: if the blob were deleted here,
  // recovering the message would restore a pointer to a 404.
  it('does NOT delete Storage media at delete time — that waits for the purge', async () => {
    await deleteMessages('chat1', ['m1'], 'uid1');
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it('opportunistically sweeps expired trash, since no scheduled job exists', async () => {
    await deleteMessages('chat1', ['m1'], 'uid1');
    expect(mockPurgeExpiredTrash).toHaveBeenCalledWith('chat1', 'uid1');
  });

  it('never lets a purge failure fail the delete the user asked for', async () => {
    mockPurgeExpiredTrash.mockRejectedValue(new Error('offline'));
    await expect(deleteMessages('chat1', ['m1'], 'uid1')).resolves.toBeUndefined();
  });
});
