import {beforeEach, describe, expect, it} from 'vitest';
import {
  assertAiConsent,
  grantAiConsent,
  hasAiConsent,
  isAiConsentError,
  revokeAiConsent,
} from './aiConsent';

/**
 * jsdom under Node 26 does not provide localStorage (it warns that
 * --localstorage-file was not given), so the tests install their own. That the
 * module survives its absence is itself covered below.
 */
function installStorage() {
  const map = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    },
  });
}

function breakStorage() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('storage disabled');
    },
  });
}

beforeEach(() => {
  installStorage();
});

describe('consent state', () => {
  it('starts off — nothing is sent until explicitly allowed', () => {
    expect(hasAiConsent()).toBe(false);
  });

  it('grants and revokes', () => {
    grantAiConsent();
    expect(hasAiConsent()).toBe(true);
    revokeAiConsent();
    expect(hasAiConsent()).toBe(false);
  });

  it('treats an unrelated stored value as not consented', () => {
    window.localStorage.setItem('cb.ai.consent.v1', 'maybe');
    expect(hasAiConsent()).toBe(false);
  });

  // Failing closed is the only safe default for something that transmits
  // decrypted messages: a storage error must never read as "allowed".
  it('fails closed when storage is unavailable', () => {
    breakStorage();
    expect(hasAiConsent()).toBe(false);
    expect(() => grantAiConsent()).not.toThrow();
    expect(() => assertAiConsent()).toThrow();
  });
});

describe('assertAiConsent', () => {
  it('throws a recognisable error before consent', () => {
    let caught: unknown;
    try {
      assertAiConsent();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(isAiConsentError(caught)).toBe(true);
  });

  it('passes silently once granted', () => {
    grantAiConsent();
    expect(() => assertAiConsent()).not.toThrow();
  });

  it('throws again after revoking — turning it off actually stops sending', () => {
    grantAiConsent();
    revokeAiConsent();
    expect(() => assertAiConsent()).toThrow();
  });
});

describe('isAiConsentError', () => {
  it('does not mistake other failures for a consent problem', () => {
    // Otherwise a network error would silently pop the disclosure and imply
    // the user had never allowed it.
    expect(isAiConsentError(new Error('network down'))).toBe(false);
    expect(isAiConsentError({code: 'functions/permission-denied'})).toBe(false);
    expect(isAiConsentError(null)).toBe(false);
    expect(isAiConsentError(undefined)).toBe(false);
  });
});
