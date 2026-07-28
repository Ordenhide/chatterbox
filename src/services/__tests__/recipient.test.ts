// Mirrors web/src/services/recipient.test.ts. The two Firestore reads are
// stubbed separately because they mean different things: getDoc is the
// cache-servable read on the send path, getDocFromServer is the deliberately
// uncached profile check.
//
// Jest hoists jest.mock() factories above imports and only lets them close over
// variables prefixed with `mock` (case-insensitive).
const mockGetDoc = jest.fn();
const mockGetDocFromServer = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocFromServer: (...args: unknown[]) => mockGetDocFromServer(...args),
}));

import {
  RecipientUnreachableError,
  assertRecipientReachable,
  checkRecipient,
  hasLostPeer,
  isProfileDeleted,
  isRecipientUnreachable,
  peerUidOf,
} from '../recipient';

const ME = 'me-uid';
const PEER = 'peer-uid';

/**
 * A DocumentSnapshot stand-in. Note `exists` is a plain boolean property here,
 * not a method — React Native Firebase differs from the web SDK on this, and
 * getting it wrong makes every document look like it exists.
 */
const snapshot = (data: Record<string, unknown> | null) => ({
  exists: data !== null,
  data: () => data,
});

beforeEach(() => {
  mockGetDoc.mockReset();
  mockGetDocFromServer.mockReset();
});

describe('peerUidOf', () => {
  it('finds the other participant', () => {
    expect(peerUidOf([ME, PEER], ME)).toBe(PEER);
    expect(peerUidOf([PEER, ME], ME)).toBe(PEER);
  });

  it('returns null when only I am left', () => {
    expect(peerUidOf([ME], ME)).toBeNull();
  });

  it('tolerates junk instead of an array', () => {
    expect(peerUidOf(undefined, ME)).toBeNull();
    expect(peerUidOf(null, ME)).toBeNull();
    expect(peerUidOf('not-an-array', ME)).toBeNull();
    expect(peerUidOf([null, '', ME], ME)).toBeNull();
  });
});

describe('hasLostPeer', () => {
  it('is true for a chat down to just me', () => {
    expect(hasLostPeer([ME], ME)).toBe(true);
  });

  it('is false while the peer is still a participant', () => {
    expect(hasLostPeer([ME, PEER], ME)).toBe(false);
  });

  // The distinction this file exists to protect: "I could not tell" must never
  // be reported as "they are gone", or a loading chat blocks its own composer.
  it('is false for an unloaded or empty participants list', () => {
    expect(hasLostPeer(undefined, ME)).toBe(false);
    expect(hasLostPeer(null, ME)).toBe(false);
    expect(hasLostPeer([], ME)).toBe(false);
  });
});

describe('isProfileDeleted', () => {
  it('is true when the profile document is missing', async () => {
    mockGetDocFromServer.mockResolvedValue(snapshot(null));
    expect(await isProfileDeleted(PEER)).toBe(true);
  });

  it('is false when the profile is there', async () => {
    mockGetDocFromServer.mockResolvedValue(snapshot({displayName: 'Peer'}));
    expect(await isProfileDeleted(PEER)).toBe(false);
  });

  it('is false when the read itself fails', async () => {
    mockGetDocFromServer.mockRejectedValue(new Error('offline'));
    expect(await isProfileDeleted(PEER)).toBe(false);
  });

  // firebaseChat's getUserById memoises profiles for the life of the process,
  // so going through it would report a peer fetched before their deletion as
  // still present — the exact case this check exists for.
  it('bypasses the cache with a server read', async () => {
    mockGetDocFromServer.mockResolvedValue(snapshot(null));
    await isProfileDeleted(PEER);
    expect(mockGetDocFromServer).toHaveBeenCalledTimes(1);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});

describe('checkRecipient', () => {
  it('reports deleted from participants alone, without a profile read', async () => {
    expect(await checkRecipient([ME], ME)).toBe('deleted');
    expect(mockGetDocFromServer).not.toHaveBeenCalled();
  });

  it('reports deleted when only the profile is gone', async () => {
    mockGetDocFromServer.mockResolvedValue(snapshot(null));
    expect(await checkRecipient([ME, PEER], ME)).toBe('deleted');
  });

  it('reports ok when the peer is listed and their profile exists', async () => {
    mockGetDocFromServer.mockResolvedValue(snapshot({displayName: 'Peer'}));
    expect(await checkRecipient([ME, PEER], ME)).toBe('ok');
  });

  it('reports unknown, not deleted, for an unloaded chat', async () => {
    expect(await checkRecipient(undefined, ME)).toBe('unknown');
  });
});

describe('assertRecipientReachable', () => {
  it('throws once the peer has left the participants list', async () => {
    mockGetDoc.mockResolvedValue(snapshot({participants: [ME]}));
    await expect(assertRecipientReachable('chat1', ME)).rejects.toBeInstanceOf(
      RecipientUnreachableError,
    );
  });

  it('resolves while the peer is still a participant', async () => {
    mockGetDoc.mockResolvedValue(snapshot({participants: [ME, PEER]}));
    await expect(assertRecipientReachable('chat1', ME)).resolves.toBeUndefined();
  });

  // Everything below is the same rule: only positive evidence blocks a send.
  it('resolves when the chat document does not exist', async () => {
    mockGetDoc.mockResolvedValue(snapshot(null));
    await expect(assertRecipientReachable('chat1', ME)).resolves.toBeUndefined();
  });

  it('resolves when the read fails, rather than blocking the message', async () => {
    mockGetDoc.mockRejectedValue(new Error('offline'));
    await expect(assertRecipientReachable('chat1', ME)).resolves.toBeUndefined();
  });

  it('resolves when the chat has no participants field', async () => {
    mockGetDoc.mockResolvedValue(snapshot({}));
    await expect(assertRecipientReachable('chat1', ME)).resolves.toBeUndefined();
  });

  // The send path must stay cheap: an open chat already holds a live listener
  // on this document, so the cached read costs nothing.
  it('never pays for a server read', async () => {
    mockGetDoc.mockResolvedValue(snapshot({participants: [ME, PEER]}));
    await assertRecipientReachable('chat1', ME);
    expect(mockGetDocFromServer).not.toHaveBeenCalled();
  });
});

describe('isRecipientUnreachable', () => {
  // ChatScreen's outbox uses this to tell a permanent failure from a transient
  // one; misclassifying either way is what the two tests below pin down.
  it('recognises the error across a rethrow', () => {
    expect(isRecipientUnreachable(new RecipientUnreachableError())).toBe(true);
  });

  it('does not claim unrelated failures', () => {
    expect(isRecipientUnreachable(new Error('network'))).toBe(false);
    expect(isRecipientUnreachable({code: 'firestore/unavailable'})).toBe(false);
    expect(isRecipientUnreachable(null)).toBe(false);
    expect(isRecipientUnreachable(undefined)).toBe(false);
  });
});
