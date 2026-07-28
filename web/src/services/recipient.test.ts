import {beforeEach, describe, expect, it, vi} from 'vitest';

/**
 * The two Firestore reads are mocked separately because they mean different
 * things: `getDoc` is the cache-servable read on the send path, and
 * `getDocFromServer` is the deliberately-uncached profile check.
 */
const getDoc = vi.fn();
const getDocFromServer = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({path: path.join('/')}),
  getDoc: (...args: unknown[]) => getDoc(...args),
  getDocFromServer: (...args: unknown[]) => getDocFromServer(...args),
}));
vi.mock('../firebase', () => ({db: {}}));

import {
  RecipientUnreachableError,
  assertRecipientReachable,
  checkRecipient,
  hasLostPeer,
  isProfileDeleted,
  isRecipientUnreachable,
  peerUidOf,
} from './recipient';

const ME = 'me-uid';
const PEER = 'peer-uid';

/** A Firestore DocumentSnapshot stand-in — `exists` is a method on web. */
const snapshot = (data: Record<string, unknown> | null) => ({
  exists: () => data !== null,
  data: () => data,
});

beforeEach(() => {
  getDoc.mockReset();
  getDocFromServer.mockReset();
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
    getDocFromServer.mockResolvedValue(snapshot(null));
    expect(await isProfileDeleted(PEER)).toBe(true);
  });

  it('is false when the profile is there', async () => {
    getDocFromServer.mockResolvedValue(snapshot({displayName: 'Peer'}));
    expect(await isProfileDeleted(PEER)).toBe(false);
  });

  it('is false when the read itself fails', async () => {
    getDocFromServer.mockRejectedValue(new Error('offline'));
    expect(await isProfileDeleted(PEER)).toBe(false);
  });

  // Reading from cache would report a peer as present using a copy fetched
  // before they deleted their account — the exact case this check is for.
  it('bypasses the local cache', async () => {
    getDocFromServer.mockResolvedValue(snapshot(null));
    await isProfileDeleted(PEER);
    expect(getDocFromServer).toHaveBeenCalledTimes(1);
    expect(getDoc).not.toHaveBeenCalled();
  });
});

describe('checkRecipient', () => {
  it('reports deleted from participants alone, without a profile read', async () => {
    expect(await checkRecipient([ME], ME)).toBe('deleted');
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  it('reports deleted when only the profile is gone', async () => {
    getDocFromServer.mockResolvedValue(snapshot(null));
    expect(await checkRecipient([ME, PEER], ME)).toBe('deleted');
  });

  it('reports ok when the peer is listed and their profile exists', async () => {
    getDocFromServer.mockResolvedValue(snapshot({displayName: 'Peer'}));
    expect(await checkRecipient([ME, PEER], ME)).toBe('ok');
  });

  it('reports unknown, not deleted, for an unloaded chat', async () => {
    expect(await checkRecipient(undefined, ME)).toBe('unknown');
  });
});

describe('assertRecipientReachable', () => {
  it('throws once the peer has left the participants list', async () => {
    getDoc.mockResolvedValue(snapshot({participants: [ME]}));
    await expect(assertRecipientReachable('chat1', ME)).rejects.toBeInstanceOf(
      RecipientUnreachableError,
    );
  });

  it('resolves while the peer is still a participant', async () => {
    getDoc.mockResolvedValue(snapshot({participants: [ME, PEER]}));
    await expect(assertRecipientReachable('chat1', ME)).resolves.toBeUndefined();
  });

  // Everything below is the same rule: only positive evidence blocks a send.
  it('resolves when the chat document does not exist', async () => {
    getDoc.mockResolvedValue(snapshot(null));
    await expect(assertRecipientReachable('chat1', ME)).resolves.toBeUndefined();
  });

  it('resolves when the read fails, rather than blocking the message', async () => {
    getDoc.mockRejectedValue(new Error('offline'));
    await expect(assertRecipientReachable('chat1', ME)).resolves.toBeUndefined();
  });

  it('resolves when the chat has no participants field', async () => {
    getDoc.mockResolvedValue(snapshot({}));
    await expect(assertRecipientReachable('chat1', ME)).resolves.toBeUndefined();
  });

  // The send path must stay cheap: an open chat already holds a live listener
  // on this document, so the cached read costs nothing.
  it('never pays for a server read', async () => {
    getDoc.mockResolvedValue(snapshot({participants: [ME, PEER]}));
    await assertRecipientReachable('chat1', ME);
    expect(getDocFromServer).not.toHaveBeenCalled();
  });
});

describe('isRecipientUnreachable', () => {
  it('recognises the error across a rethrow', () => {
    expect(isRecipientUnreachable(new RecipientUnreachableError())).toBe(true);
  });

  it('does not claim unrelated failures', () => {
    expect(isRecipientUnreachable(new Error('network'))).toBe(false);
    expect(isRecipientUnreachable({code: 'permission-denied'})).toBe(false);
    expect(isRecipientUnreachable(null)).toBe(false);
    expect(isRecipientUnreachable(undefined)).toBe(false);
  });
});
