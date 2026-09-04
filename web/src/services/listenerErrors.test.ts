import {beforeEach, describe, expect, it, vi} from 'vitest';
import {isPermissionDenied, onListenerError} from './listenerErrors';

describe('onListenerError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it.each([
    ['unavailable'],
    ['deadline-exceeded'],
    ['internal'],
    ['unauthenticated'],
    ['resource-exhausted'],
  ])('leaves what is on screen alone for %s', code => {
    const clear = vi.fn();

    onListenerError({code}, 'listenMessages', clear);

    expect(clear).not.toHaveBeenCalled();
  });

  it('leaves it alone for an error carrying no code', () => {
    const clear = vi.fn();

    onListenerError(new Error('connection closed'), 'listenMessages', clear);

    expect(clear).not.toHaveBeenCalled();
  });

  it.each([['permission-denied'], ['firestore/permission-denied']])(
    'clears on %s, because the read really is revoked',
    code => {
      const clear = vi.fn();

      onListenerError({code}, 'listenMessages', clear);

      expect(clear).toHaveBeenCalledTimes(1);
    },
  );
});

describe('isPermissionDenied', () => {
  it('accepts the JS SDK code and the namespaced RNFB one', () => {
    expect(isPermissionDenied({code: 'permission-denied'})).toBe(true);
    expect(isPermissionDenied({code: 'firestore/permission-denied'})).toBe(true);
  });

  it('is false for other failures, and for nothing at all', () => {
    expect(isPermissionDenied({code: 'unavailable'})).toBe(false);
    expect(isPermissionDenied(new Error('boom'))).toBe(false);
    expect(isPermissionDenied(null)).toBe(false);
    expect(isPermissionDenied(undefined)).toBe(false);
  });
});
