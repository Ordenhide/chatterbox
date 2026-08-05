// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockStore = new Map<string, string>();
let mockShouldThrow = false;

jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async (k: string) => {
      if (mockShouldThrow) throw new Error('storage unavailable');
      return mockStore.has(k) ? mockStore.get(k)! : null;
    },
    setItem: async (k: string, v: string) => {
      if (mockShouldThrow) throw new Error('storage unavailable');
      mockStore.set(k, v);
    },
    removeItem: async (k: string) => {
      if (mockShouldThrow) throw new Error('storage unavailable');
      mockStore.delete(k);
    },
  },
}));

import {
  __resetAiConsentCache,
  assertAiConsent,
  grantAiConsent,
  hasAiConsent,
  isAiConsentError,
  revokeAiConsent,
} from '../aiConsent';

beforeEach(() => {
  mockStore.clear();
  mockShouldThrow = false;
  __resetAiConsentCache();
});

describe('consent state', () => {
  it('starts off — nothing is sent until explicitly allowed', async () => {
    expect(await hasAiConsent()).toBe(false);
  });

  it('grants and revokes', async () => {
    await grantAiConsent();
    expect(await hasAiConsent()).toBe(true);
    await revokeAiConsent();
    expect(await hasAiConsent()).toBe(false);
  });

  it('persists the grant under the same key the web client uses', async () => {
    await grantAiConsent();
    expect(mockStore.get('cb.ai.consent.v1')).toBe('granted');
  });

  it('treats an unrelated stored value as not consented', async () => {
    mockStore.set('cb.ai.consent.v1', 'maybe');
    expect(await hasAiConsent()).toBe(false);
  });

  // Failing closed is the only safe default for something that transmits
  // decrypted messages: a storage error must never read as "allowed".
  it('fails closed when storage is unavailable', async () => {
    mockShouldThrow = true;
    expect(await hasAiConsent()).toBe(false);
    await expect(assertAiConsent()).rejects.toThrow();
  });

  it('does not throw out of grant when storage is unavailable', async () => {
    mockShouldThrow = true;
    await expect(grantAiConsent()).resolves.toBeUndefined();
  });

  it('still blocks for this session when a revoke fails to persist', async () => {
    await grantAiConsent();
    mockShouldThrow = true;
    await revokeAiConsent();
    // The in-memory flag must win, or a failed write would keep sending.
    expect(await hasAiConsent()).toBe(false);
  });
});

describe('assertAiConsent', () => {
  it('throws a recognisable error before consent', async () => {
    let caught: unknown;
    try {
      await assertAiConsent();
    } catch (err) {
      caught = err;
    }
    expect(isAiConsentError(caught)).toBe(true);
  });

  it('passes silently once granted', async () => {
    await grantAiConsent();
    await expect(assertAiConsent()).resolves.toBeUndefined();
  });

  it('throws again after revoking — turning it off actually stops sending', async () => {
    await grantAiConsent();
    await revokeAiConsent();
    await expect(assertAiConsent()).rejects.toThrow();
  });
});

describe('isAiConsentError', () => {
  it('does not mistake other failures for a consent problem', () => {
    // Otherwise a network error would pop the disclosure and wrongly imply the
    // user had never allowed it.
    expect(isAiConsentError(new Error('network down'))).toBe(false);
    expect(isAiConsentError({code: 'functions/permission-denied'})).toBe(false);
    expect(isAiConsentError(null)).toBe(false);
    expect(isAiConsentError(undefined)).toBe(false);
  });
});
