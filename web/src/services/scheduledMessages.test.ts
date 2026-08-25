import {beforeEach, describe, expect, it, vi} from 'vitest';

// scheduledMessages.ts pulls in firebase/firestore + ../firebase at import time.
// Stub both so these stay hermetic, and capture the onSnapshot handler so the
// listener's own wiring — not just the filter it calls — is exercised.
type SnapshotHandler = (snap: {
  docs: Array<{id: string; data: () => Record<string, unknown>}>;
}) => void;
const handlers: SnapshotHandler[] = [];
/** Every document scheduleMessage wrote, so a test can look for plaintext. */
const written: Record<string, unknown>[] = [];

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
  setDoc: vi.fn(async (_ref: unknown, data: Record<string, unknown>) => {
    written.push(data);
  }),
  onSnapshot: (_ref: unknown, onNext: SnapshotHandler) => {
    handlers.push(onNext);
    return () => {
      const i = handlers.indexOf(onNext);
      if (i >= 0) handlers.splice(i, 1);
    };
  },
}));

import {listenScheduledMessages, ownScheduledMessages, scheduleMessage} from './scheduledMessages';
import {generateKeypair, openSealed, sealForRecipients} from './e2ee';

const sched = (id: string, uid?: string) => ({
  id,
  data: () => ({text: `msg ${id}`, scheduledFor: 1, sent: false, ...(uid ? {user: {_id: uid}} : {})}),
});

const emit = (docs: Array<{id: string; data: () => Record<string, unknown>}>) =>
  handlers.forEach(h => h({docs}));

beforeEach(() => {
  handlers.length = 0;
  written.length = 0;
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

/**
 * The bug this guards: a scheduled message was written to Firestore as plain
 * text and sat there until its delivery time — in a chat where every ordinary
 * message goes out sealed, with nothing in the UI to say this one was
 * different. Delivery copies the document verbatim, so it stayed readable in
 * the thread afterwards too.
 */
describe('scheduleMessage keeps the body sealed', () => {
  const me = {uid: 'me', name: 'Me'};

  it('stores the envelope and no readable text', async () => {
    const author = generateKeypair();
    const peer = generateKeypair();
    const secret = 'meet-me-at-midnight';
    const envelope = sealForRecipients(secret, author.secretKey, [{uid: 'them', publicKey: peer.publicKey}], 'c1');

    await scheduleMessage('c1', {text: '', encrypted: envelope}, Date.now() + 60_000, me);

    expect(written).toHaveLength(1);
    expect(written[0].encrypted).toBe(envelope);
    expect(written[0].text).toBe('');
    expect(JSON.stringify(written[0])).not.toContain(secret);
  });

  // The unsealed path still exists for a peer with no key published — the same
  // all-or-nothing fallback an ordinary send makes — so it has to keep working.
  it('still stores plain text when the caller had nothing to seal with', async () => {
    await scheduleMessage('c1', {text: 'hello'}, Date.now() + 60_000, me);
    expect(written[0].text).toBe('hello');
    expect(written[0].encrypted).toBeUndefined();
  });

  it('hands the envelope to the listener so the composer can open it', () => {
    const seen: ScheduledLike[] = [];
    type ScheduledLike = {_id: string; encrypted?: unknown};
    listenScheduledMessages('c1', 'me', msgs => seen.push(...(msgs as ScheduledLike[])));
    handlers.forEach(h =>
      h({
        docs: [
          {id: 'a', data: () => ({user: {_id: 'me'}, text: '', encrypted: {alg: 'x', copies: {}}, scheduledFor: 1})},
        ],
      }),
    );
    expect(seen[0].encrypted).toEqual({alg: 'x', copies: {}});
  });

  // What the composer's pending list depends on: the author is not one of the
  // recipients, so they have no copy addressed to them. openSealed falls back
  // to any copy, which works because deriving the wrong key fails the AEAD tag.
  it('lets the author reopen their own pending message to display it', () => {
    const author = generateKeypair();
    const peer = generateKeypair();
    const envelope = sealForRecipients('see you at 8', author.secretKey, [{uid: 'them', publicKey: peer.publicKey}], 'c1');
    expect(openSealed(envelope, author.secretKey, 'me', 'c1')).toBe('see you at 8');
    expect(openSealed(envelope, peer.secretKey, 'them', 'c1')).toBe('see you at 8');
  });
});
