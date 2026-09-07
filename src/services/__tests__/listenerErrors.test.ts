const mockReportError = jest.fn();
jest.mock('../errorLog', () => ({reportError: (...a: unknown[]) => mockReportError(...a)}));

import {isPermissionDenied, isUnsyncedEmpty, onListenerError} from '../listenerErrors';

/**
 * The bug this encodes: every listener answered a *failure* by handing its
 * caller an empty result, which is what "this conversation has no messages"
 * also looks like. A transient error — a token refresh, the network changing
 * under a backgrounded app — therefore blanked the open thread, and nothing
 * re-delivers a snapshot that already failed, so it stayed blank until the
 * screen was left and re-entered and a fresh listener was built.
 */
describe('onListenerError', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    mockReportError.mockReset();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it.each([
    ['firestore/unavailable'],
    ['firestore/deadline-exceeded'],
    ['firestore/internal'],
    ['firestore/unauthenticated'],
    ['firestore/resource-exhausted'],
  ])('leaves what is on screen alone for %s', code => {
    const clear = jest.fn();

    onListenerError({code}, 'listenMessages', clear);

    expect(clear).not.toHaveBeenCalled();
  });

  it('leaves it alone for an error with no code at all', () => {
    const clear = jest.fn();

    onListenerError(new Error('socket closed'), 'listenMessages', clear);

    expect(clear).not.toHaveBeenCalled();
  });

  // The one failure that genuinely means the data is gone: the chat was
  // deleted, or this user was removed from it.
  it.each([['firestore/permission-denied'], ['permission-denied']])(
    'clears on %s, because the read really is revoked',
    code => {
      const clear = jest.fn();

      onListenerError({code}, 'listenMessages', clear);

      expect(clear).toHaveBeenCalledTimes(1);
    },
  );

  it('reports a transient failure rather than swallowing it', () => {
    onListenerError({code: 'firestore/unavailable'}, 'listenMessages', jest.fn());

    expect(mockReportError).toHaveBeenCalledWith(
      expect.anything(),
      'listenMessages',
    );
  });

  // Revoked access is routine — deleting a chat does it every time — so it is
  // logged, not filed as a crash. That guard predates this change; asserting
  // it here keeps the two behaviours from drifting apart.
  it('does not file revoked access as an error', () => {
    onListenerError({code: 'firestore/permission-denied'}, 'listenChat', jest.fn());

    expect(mockReportError).not.toHaveBeenCalled();
  });
});

describe('isPermissionDenied', () => {
  it('accepts both the namespaced and bare codes RNFB emits', () => {
    expect(isPermissionDenied({code: 'firestore/permission-denied'})).toBe(true);
    expect(isPermissionDenied({code: 'permission-denied'})).toBe(true);
  });

  it('is false for other failures, and for nothing at all', () => {
    expect(isPermissionDenied({code: 'firestore/unavailable'})).toBe(false);
    expect(isPermissionDenied(new Error('boom'))).toBe(false);
    expect(isPermissionDenied(null)).toBe(false);
    expect(isPermissionDenied(undefined)).toBe(false);
  });
});

/**
 * The other half of "nothing" vs "not yet".
 *
 * Firestore answers a new subscription from its own local cache first and the
 * server a round trip later. When the cache has nothing for that query, the
 * first snapshot is empty with `fromCache` set — and delivering it replaced
 * whatever was on screen with nothing until the server answered. It also raced
 * ChatScreen's own seeding from local storage, which is what made a blank
 * thread intermittent rather than reliable.
 */
describe('isUnsyncedEmpty', () => {
  it('is true for an empty snapshot Firestore served from its own cache', () => {
    expect(isUnsyncedEmpty({docs: [], metadata: {fromCache: true}})).toBe(true);
  });

  it('is false for an empty snapshot from the server — that chat really is empty', () => {
    expect(isUnsyncedEmpty({docs: [], metadata: {fromCache: false}})).toBe(false);
  });

  it('is false whenever there are documents, cached or not', () => {
    expect(isUnsyncedEmpty({docs: [{}], metadata: {fromCache: true}})).toBe(false);
    expect(isUnsyncedEmpty({docs: [{}], metadata: {fromCache: false}})).toBe(false);
  });

  // Deliver rather than swallow when the shape is unfamiliar: dropping a
  // snapshot is what leaves a screen empty, so it must take a positive signal.
  it('is false when metadata is missing entirely', () => {
    expect(isUnsyncedEmpty({docs: []})).toBe(false);
    expect(isUnsyncedEmpty({docs: [], metadata: {}})).toBe(false);
  });

  it('is false for nothing at all, which the caller handles separately', () => {
    expect(isUnsyncedEmpty(null)).toBe(false);
    expect(isUnsyncedEmpty(undefined)).toBe(false);
  });
});
