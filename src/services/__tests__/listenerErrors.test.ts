const mockReportError = jest.fn();
jest.mock('../telemetry', () => ({reportError: (...a: unknown[]) => mockReportError(...a)}));

import {isPermissionDenied, onListenerError} from '../listenerErrors';

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
