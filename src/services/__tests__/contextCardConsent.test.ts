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
  __resetContextCardConsentCache,
  grantContextCardConsent,
  hasContextCardConsent,
  revokeContextCardConsent,
} from '../contextCardConsent';

beforeEach(() => {
  mockStore.clear();
  mockShouldThrow = false;
  __resetContextCardConsentCache();
});

describe('consent state', () => {
  it('starts off — nothing is looked up until explicitly allowed', async () => {
    expect(await hasContextCardConsent()).toBe(false);
  });

  it('remembers a grant', async () => {
    await grantContextCardConsent();
    __resetContextCardConsentCache();
    expect(await hasContextCardConsent()).toBe(true);
  });

  it('forgets it again when revoked', async () => {
    await grantContextCardConsent();
    await revokeContextCardConsent();
    __resetContextCardConsentCache();
    expect(await hasContextCardConsent()).toBe(false);
  });

  it('does not accept a value that is not the grant token', async () => {
    mockStore.set('cb.contextCards.consent.v1', 'true');
    expect(await hasContextCardConsent()).toBe(false);
  });
});

/**
 * The half a passing test suite is most likely to skip. Storage that throws is
 * a real state — a private-mode profile, a keystore that is not ready yet —
 * and the tempting reading of "I could not find out" is "carry on". Here that
 * would put proper nouns from decrypted messages on the wire on the strength
 * of a failed disk read.
 */
describe('when storage is unavailable', () => {
  it('reads as off rather than on', async () => {
    mockShouldThrow = true;
    expect(await hasContextCardConsent()).toBe(false);
  });

  it('stays off even after a grant that could not be persisted', async () => {
    mockShouldThrow = true;
    await grantContextCardConsent();
    // The in-memory flag still holds for this session — the user did say yes.
    expect(await hasContextCardConsent()).toBe(true);
    // But nothing was written, so the next launch starts from off again.
    __resetContextCardConsentCache();
    expect(await hasContextCardConsent()).toBe(false);
  });

  it('revokes for the session even when the delete fails', async () => {
    await grantContextCardConsent();
    mockShouldThrow = true;
    await revokeContextCardConsent();
    expect(await hasContextCardConsent()).toBe(false);
  });
});
