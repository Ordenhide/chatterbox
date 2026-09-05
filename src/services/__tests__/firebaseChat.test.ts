// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockDocs: {
  data: Map<string, Record<string, unknown> | undefined>;
  /** Paths the rules refuse — how a profile you may not read behaves. */
  denied: Set<string>;
  /** Every path `getDoc` was asked for, so a reintroduced query is visible. */
  reads: string[];
} = {data: new Map(), denied: new Set(), reads: []};

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
    mockDocs.reads.push(ref.path);
    if (mockDocs.denied.has(ref.path)) {
      throw Object.assign(new Error('Missing or insufficient permissions.'), {
        code: 'firestore/permission-denied',
      });
    }
    const data = mockDocs.data.get(ref.path);
    return {exists: () => !!data, data: () => data, id: ref.path};
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
// Typing indicators default to *off* in the real module. These tests are about
// the write path, so the flag is on here and its own gate is tested below.
jest.mock('../privacyGuard', () => ({
  isStealthMode: jest.fn(() => false),
  isTypingIndicatorEnabled: jest.fn(() => true),
}));
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

import {deleteMessages, getUsersByIds, setTyping} from '../firebaseChat';
import {getDocs, setDoc} from '../firebase/firestore';

const CHAT_ID = 'chat1';
const KEYPAIR = {secretKey: new Uint8Array([1, 2, 3]), publicKey: new Uint8Array([4, 5, 6])};

beforeEach(() => {
  mockDocs.data = new Map();
  mockDocs.denied = new Set();
  mockDocs.reads = [];
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


describe('profiles are read one document at a time', () => {
  const mockedGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;

  beforeEach(() => {
    mockedGetDocs.mockClear();
  });

  /**
   * A profile whose `uid` field disagrees with the document it sits in.
   *
   * The rules reject writing one, but the read should not depend on that: the
   * id is where the document lives and cannot be written, while the field is
   * something a client wrote. Callers act on the uid by starting a chat with
   * it, so it has to come from the half that cannot be wrong.
   */
  it('takes the uid from the document id, keeping the rest of the profile', async () => {
    mockDocs.data.set('mallory', {uid: 'bob', email: 'x@example.com'});
    const found = (await getUsersByIds(['mallory'])).mallory;
    expect(found?.uid).toBe('mallory');
    expect(found?.email).toBe('x@example.com');
  });

  /**
   * The reason this is not a batch. `where('__name__', 'in', ...)` is a *list*
   * to Firestore, and `list` on `users` is denied — allowing it would allow
   * enumerating the directory the invite work removed. A batch reintroduced
   * here would be refused in production and pass in every test that mocks it.
   */
  it('never issues a query, only document reads', async () => {
    await getUsersByIds(['fresh-a', 'fresh-b', 'fresh-c']);
    expect(mockDocs.reads).toEqual(['fresh-a', 'fresh-b', 'fresh-c']);
    expect(mockedGetDocs).not.toHaveBeenCalled();
  });

  it('reports a profile it may not read as absent, like one that is not there', async () => {
    mockDocs.denied.add('secretive');
    expect((await getUsersByIds(['secretive'])).secretive).toBeNull();
  });
});

/**
 * The indicator is opt-in, and the gate has to be on the *write*, not on the
 * render. Suppressing it only in the UI would leave `typingBy` accumulating on
 * the server — a plaintext record of when this person was at their phone —
 * while the app claimed the feature was off.
 */
describe('setTyping respects the opt-in', () => {
  const mockedSetDoc = setDoc as unknown as jest.Mock;
  const {isTypingIndicatorEnabled} = require('../privacyGuard');

  // Reset going *in*, not only coming out: setDoc is shared with every other
  // block in this file, and "was never called" is only meaningful from zero.
  beforeEach(() => {
    mockedSetDoc.mockReset();
    mockedSetDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockedSetDoc.mockReset();
    mockedSetDoc.mockResolvedValue(undefined);
    isTypingIndicatorEnabled.mockReturnValue(true);
  });

  it('writes nothing at all when the indicator is off', async () => {
    isTypingIndicatorEnabled.mockReturnValue(false);
    await setTyping('chat-1', 'me', true);
    await setTyping('chat-1', 'me', false);
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it('writes when it is on', async () => {
    isTypingIndicatorEnabled.mockReturnValue(true);
    await setTyping('chat-1', 'me', true);
    expect(mockedSetDoc).toHaveBeenCalled();
  });
});

describe('setTyping never rejects', () => {
  const mockedSetDoc = setDoc as unknown as jest.Mock;

  afterEach(() => {
    mockedSetDoc.mockReset();
    mockedSetDoc.mockResolvedValue(undefined);
  });

  it('swallows a permission error instead of rejecting', async () => {
    // The real one: writing the indicator updates the chat document, which the
    // rules allow only to a participant, and the focus-effect cleanup fires as
    // the screen unmounts — including the unmount right after leaving a chat.
    // Neither caller awaits this, so a rejection here became an unhandled
    // promise rejection rather than anything anyone could act on.
    mockedSetDoc.mockRejectedValue(
      Object.assign(new Error('permission-denied'), {code: 'firestore/permission-denied'}),
    );
    await expect(setTyping('c1', 'alice', false)).resolves.toBeUndefined();
  });

  it('swallows a failure when starting to type, too', async () => {
    mockedSetDoc.mockRejectedValue(new Error('offline'));
    await expect(setTyping('c1', 'alice', true)).resolves.toBeUndefined();
  });

  it('still writes the indicator on the happy path', async () => {
    mockedSetDoc.mockResolvedValue(undefined);
    await setTyping('c1', 'alice', true);
    expect(mockedSetDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mockedSetDoc.mock.calls[0];
    expect(typeof (payload as any).typingBy.alice).toBe('number');
    expect((payload as any).typingBy.alice).toBeGreaterThan(0);
  });

  it('clears the indicator with a zero rather than deleting the field', async () => {
    mockedSetDoc.mockResolvedValue(undefined);
    await setTyping('c1', 'alice', false);
    const [, payload] = mockedSetDoc.mock.calls[0];
    expect((payload as any).typingBy.alice).toBe(0);
  });
});
