// Jest hoists jest.mock() factories above imports and only lets them close over
// variables prefixed with `mock` (case-insensitive).
type MockSnapshotHandler = (
  snapshot: {docs: Array<{id: string; data: () => Record<string, unknown>}>} | null,
  error?: unknown,
) => void;
const mockOnSnapshotHandlers: MockSnapshotHandler[] = [];
const mockReportError = jest.fn();
/** Documents that reached setDoc, i.e. that real Firestore would have accepted. */
const mockWritten: Record<string, unknown>[] = [];

/**
 * Real Firestore rejects an `undefined` field value rather than treating the
 * key as absent. The previous mock accepted anything, which is why a scheduled
 * send that always carried `mediaKeys: undefined` passed every test here and
 * failed on the first real device — silently, because nothing caught the throw.
 */
function mockRejectUndefined(value: unknown, path = ''): void {
  if (value === undefined) {
    throw new Error(`Unsupported field value: undefined (found in field ${path})`);
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => mockRejectUndefined(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object' && (value as object).constructor === Object) {
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) =>
      mockRejectUndefined(v, path ? `${path}.${k}` : k),
    );
  }
}

jest.mock('../errorLog', () => ({reportError: (...a: unknown[]) => mockReportError(...a)}));

jest.mock('../firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (parent: unknown, name: string) => ({parent, name}),
  doc: (parent: unknown, id?: string) => ({parent, id}),
  query: (ref: unknown) => ref,
  where: (field: string, op: string, value: unknown) => ({field, op, value}),
  orderBy: (field: string, dir: string) => ({field, dir}),
  setDoc: jest.fn(async (_ref: unknown, data: Record<string, unknown>) => {
    mockRejectUndefined(data);
    mockWritten.push(data);
  }),
  deleteDoc: jest.fn(async () => undefined),
  onSnapshot: (_ref: unknown, onNext: MockSnapshotHandler) => {
    mockOnSnapshotHandlers.push(onNext);
    return () => {
      const i = mockOnSnapshotHandlers.indexOf(onNext);
      if (i >= 0) mockOnSnapshotHandlers.splice(i, 1);
    };
  },
}));

import {listenScheduledMessages, ownScheduledMessages, scheduleMessage} from '../scheduledMessages';
import type {Message} from '../../types';

const sched = (id: string, uid?: string) => ({
  id,
  data: () => ({
    text: `msg ${id}`,
    scheduledFor: 1,
    sent: false,
    ...(uid ? {user: {_id: uid}} : {}),
  }),
});

function emit(docs: Array<{id: string; data: () => Record<string, unknown>}>) {
  mockOnSnapshotHandlers.forEach(h => h({docs}));
}

beforeEach(() => {
  mockOnSnapshotHandlers.length = 0;
  mockWritten.length = 0;
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

  // Strict equality already excludes `{_id: 'me'}` and `{}` from an empty
  // viewer uid, so the explicit `!myUid` guard earns its place on exactly one
  // input: a document whose author id is itself blank, which would otherwise
  // match a signed-out viewer and hand them a message that is nobody's.
  it('returns nothing for an empty uid, including a blank-authored message', () => {
    expect(
      ownScheduledMessages([{_id: 'a', user: {_id: 'me'}}, {_id: 'b'}, {_id: 'c', user: {_id: ''}}], ''),
    ).toEqual([]);
  });
});

describe('listenScheduledMessages', () => {
  // The filter existing isn't enough — the listener has to actually apply it.
  // This is the shape of the original bug: the composer's count and cancel list
  // were fed the whole chat's scheduled collection.
  it('delivers only my own scheduled messages to the callback', () => {
    const seen: Array<Array<{_id: string | number}>> = [];
    listenScheduledMessages('c1', 'me', msgs => seen.push(msgs));
    emit([sched('a', 'me'), sched('b', 'them'), sched('c', 'me')]);
    expect(seen).toHaveLength(1);
    expect(seen[0].map(m => m._id)).toEqual(['a', 'c']);
  });

  it('reports an empty list when only other people have anything pending', () => {
    const seen: Array<Array<{_id: string | number}>> = [];
    listenScheduledMessages('c1', 'me', msgs => seen.push(msgs));
    emit([sched('b', 'them'), sched('d', 'someone-else')]);
    expect(seen[0]).toEqual([]);
  });

  it('stops delivering once unsubscribed', () => {
    const seen: Array<unknown> = [];
    const unsub = listenScheduledMessages('c1', 'me', msgs => seen.push(msgs));
    unsub();
    emit([sched('a', 'me')]);
    expect(seen).toEqual([]);
  });

  // guardQuerySnapshot's contract: react-native-firebase calls the *success*
  // callback with (null, error) when a listener loses access.
  it('survives the null snapshot a revoked listener delivers', () => {
    const seen: Array<unknown> = [];
    listenScheduledMessages('c1', 'me', msgs => seen.push(msgs));
    expect(() =>
      mockOnSnapshotHandlers.forEach(h => h(null, {code: 'firestore/permission-denied'})),
    ).not.toThrow();
    expect(seen).toEqual([]);
  });
});

/**
 * The bug this exists for: handleScheduleSend was changed to seal the body
 * through encryptOutgoingMessage, whose output always carries
 * `mediaKeys: undefined` (that is how it clears the field). scheduleMessage
 * wrote straight to Firestore without stripping, so every scheduled send threw
 * — and nothing awaited it into a catch, so the button silently did nothing.
 *
 * sendMessage had always called stripUndefined; scheduling was the write path
 * that never did.
 */
describe('scheduleMessage survives what encryptOutgoingMessage produces', () => {
  const sealed = {
    _id: 'sched_1',
    text: '',
    createdAt: new Date(0),
    user: {_id: 'me', name: 'Me', avatar: undefined},
    mediaKeys: undefined,
    encrypted: {alg: 'chatterbox-e2ee-v1', copies: {them: {n: 'x', c: 'y'}}},
  } as unknown as Message;

  it('writes a sealed message that carries undefined fields', async () => {
    await expect(scheduleMessage('c1', sealed, 123)).resolves.toBeUndefined();
    expect(mockWritten).toHaveLength(1);
  });

  it('drops the undefined keys rather than sending them', async () => {
    await scheduleMessage('c1', sealed, 123);
    const written = mockWritten[0];
    expect('mediaKeys' in written).toBe(false);
    expect('avatar' in (written.user as Record<string, unknown>)).toBe(false);
  });

  it('keeps everything that was actually set', async () => {
    await scheduleMessage('c1', sealed, 123);
    const w = mockWritten[0];
    expect(w.encrypted).toEqual(sealed.encrypted);
    expect(w.text).toBe('');
    expect(w.scheduledFor).toBe(123);
    expect(w.sent).toBe(false);
    expect((w.user as {_id: string})._id).toBe('me');
  });

  // A Date must survive as a Date — stripUndefined walks plain objects only.
  it('leaves non-plain objects like Date intact', async () => {
    await scheduleMessage('c1', sealed, 123);
    expect(mockWritten[0].createdAt).toBeInstanceOf(Date);
  });
});
