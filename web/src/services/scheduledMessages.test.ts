import {beforeEach, describe, expect, it, vi} from 'vitest';

// scheduledMessages.ts pulls in firebase/firestore + ../firebase at import time.
// Stub both so these stay hermetic, and capture the onSnapshot handler so the
// listener's own wiring — not just the filter it calls — is exercised.
type SnapshotHandler = (snap: {
  docs: Array<{id: string; data: () => Record<string, unknown>}>;
}) => void;
const handlers: SnapshotHandler[] = [];

vi.mock('../firebase', () => ({db: {}}));
vi.mock('firebase/firestore', () => ({
  collection: (parent: unknown, ...segs: string[]) => ({parent, segs}),
  doc: (parent: unknown, ...segs: string[]) => ({parent, segs}),
  query: (ref: unknown) => ref,
  where: (field: string, op: string, value: unknown) => ({field, op, value}),
  orderBy: (field: string, dir: string) => ({field, dir}),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: () => ({__ts: true}),
  setDoc: vi.fn(),
  onSnapshot: (_ref: unknown, onNext: SnapshotHandler) => {
    handlers.push(onNext);
    return () => {
      const i = handlers.indexOf(onNext);
      if (i >= 0) handlers.splice(i, 1);
    };
  },
}));

import {listenScheduledMessages, ownScheduledMessages} from './scheduledMessages';

const sched = (id: string, uid?: string) => ({
  id,
  data: () => ({text: `msg ${id}`, scheduledFor: 1, sent: false, ...(uid ? {user: {_id: uid}} : {})}),
});

const emit = (docs: Array<{id: string; data: () => Record<string, unknown>}>) =>
  handlers.forEach(h => h({docs}));

beforeEach(() => {
  handlers.length = 0;
});

describe('ownScheduledMessages', () => {
  it('keeps only the messages this user wrote', () => {
    const messages = [
      {_id: 'a', user: {_id: 'me'}},
      {_id: 'b', user: {_id: 'them'}},
      {_id: 'c', user: {_id: 'me'}},
    ];
    expect(ownScheduledMessages(messages, 'me').map(m => m._id)).toEqual(['a', 'c']);
    expect(ownScheduledMessages(messages, 'them').map(m => m._id)).toEqual(['b']);
  });

  // A pending message whose author can't be established is nobody's outbox: it
  // must not land in a viewer's list, where its cancel button would be denied.
  it('drops a message with no author rather than showing it to everyone', () => {
    expect(ownScheduledMessages([{_id: 'a'}, {_id: 'b', user: {}}], 'me')).toEqual([]);
  });

  // Strict equality already excludes `{_id: 'me'}` and `{}` from an empty viewer
  // uid, so the explicit `!myUid` guard earns its place on exactly one input: a
  // document whose author id is itself blank, which would otherwise match a
  // signed-out viewer and hand them a message that is nobody's.
  it('returns nothing for an empty uid, including a blank-authored message', () => {
    expect(
      ownScheduledMessages([{_id: 'a', user: {_id: 'me'}}, {_id: 'b'}, {_id: 'c', user: {_id: ''}}], ''),
    ).toEqual([]);
  });
});

describe('listenScheduledMessages', () => {
  // The filter existing isn't enough — the listener has to apply it. This is the
  // shape of the original bug: the composer's scheduled list and its cancel
  // buttons were fed the whole chat's collection, so every row belonging to
  // another participant had a button that the author-only delete rule denies.
  it('delivers only my own scheduled messages to the callback', () => {
    const seen: Array<Array<{_id: string}>> = [];
    listenScheduledMessages('c1', 'me', msgs => seen.push(msgs));
    emit([sched('a', 'me'), sched('b', 'them'), sched('c', 'me')]);
    expect(seen).toHaveLength(1);
    expect(seen[0].map(m => m._id)).toEqual(['a', 'c']);
  });

  it('reports an empty list when only other people have anything pending', () => {
    const seen: Array<Array<{_id: string}>> = [];
    listenScheduledMessages('c1', 'me', msgs => seen.push(msgs));
    emit([sched('b', 'them'), sched('d', 'someone-else')]);
    expect(seen[0]).toEqual([]);
  });

  it('stops delivering once unsubscribed', () => {
    const seen: unknown[] = [];
    const unsub = listenScheduledMessages('c1', 'me', msgs => seen.push(msgs));
    unsub();
    emit([sched('a', 'me')]);
    expect(seen).toEqual([]);
  });
});
