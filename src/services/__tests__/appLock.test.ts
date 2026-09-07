// Jest hoists jest.mock() factories above imports and only allows them to
// close over variables prefixed with `mock` (case-insensitive).
const mockMmkvStore = new Map<string, string>();

jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async (key: string) => mockMmkvStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockMmkvStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockMmkvStore.delete(key);
    },
    getBoolean: (key: string) => (mockMmkvStore.get(key) === 'true' ? true : undefined),
    setBoolean: (key: string, value: boolean) => {
      mockMmkvStore.set(key, String(value));
    },
  },
}));

// Native module; irrelevant to the hashing this file exercises.
jest.mock('../biometrics', () => ({
  simplePrompt: async () => false,
  isSensorAvailable: async () => false,
}));

import {
  setAppLockPIN,
  verifyPIN,
} from '../appLock';

const PIN = '4821';
const WRONG = '1234';

/**
 * Reproduction of the v2 (FNV-1a) record format this replaced, so the
 * migration path can be tested against a record that a real device would
 * actually be carrying. Copied deliberately rather than exported from the
 * source: if someone changes the legacy verifier, these tests must fail.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function legacyV2Record(salt: string, pin: string): string {
  let state = salt + pin;
  let h1 = fnv1a(state);
  let h2 = fnv1a(pin + salt);
  for (let i = 0; i < 10_000; i++) {
    h1 = fnv1a(h1.toString(36) + state + i.toString());
    h2 = fnv1a(h2.toString(36) + state.split('').reverse().join('') + i.toString());
  }
  return `v2:${salt}:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

beforeEach(() => {
  mockMmkvStore.clear();
});

describe('PIN records', () => {
  it('accepts the PIN it was set with and rejects any other', async () => {
    await setAppLockPIN(PIN);
    expect(await verifyPIN(PIN)).toBe(true);
    expect(await verifyPIN(WRONG)).toBe(false);
    expect(await verifyPIN('')).toBe(false);
  });

  it('rejects everything when no PIN has been set', async () => {
    expect(await verifyPIN(PIN)).toBe(false);
  });

  it('stores a v3 scrypt record that does not contain the PIN', async () => {
    await setAppLockPIN(PIN);
    const stored = mockMmkvStore.get('app_lock_pin')!;
    const [version, salt, hash] = stored.split(':');
    expect(version).toBe('v3');
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    // scrypt dkLen is 32 bytes -> 64 hex chars. The old FNV record was 16.
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain(PIN);
  });

  it('salts each record separately, so the same PIN never stores the same hash', async () => {
    await setAppLockPIN(PIN);
    const first = mockMmkvStore.get('app_lock_pin')!;
    await setAppLockPIN(PIN);
    const second = mockMmkvStore.get('app_lock_pin')!;
    expect(first).not.toBe(second);
    // ...and both still verify.
    expect(await verifyPIN(PIN)).toBe(true);
  });
});

describe('migration from the v2 (FNV-1a) records already on devices', () => {
  it('still accepts a correct PIN stored in the old format', async () => {
    // The property that matters most: users must not be locked out of their
    // own app by the upgrade. There is no PIN reset flow to fall back on.
    mockMmkvStore.set('app_lock_pin', legacyV2Record('a'.repeat(32), PIN));
    expect(await verifyPIN(PIN)).toBe(true);
  });

  it('rewrites the old record at v3 once the correct PIN proves it', async () => {
    const legacy = legacyV2Record('b'.repeat(32), PIN);
    mockMmkvStore.set('app_lock_pin', legacy);

    expect(await verifyPIN(PIN)).toBe(true);

    const upgraded = mockMmkvStore.get('app_lock_pin')!;
    expect(upgraded).not.toBe(legacy);
    expect(upgraded.startsWith('v3:')).toBe(true);
    // The upgraded record must accept the same PIN, or the rewrite has just
    // locked the user out on their next attempt.
    expect(await verifyPIN(PIN)).toBe(true);
    expect(await verifyPIN(WRONG)).toBe(false);
  });

  it('does not rewrite the record when the PIN is wrong', async () => {
    // Otherwise a wrong guess would overwrite the real record.
    const legacy = legacyV2Record('c'.repeat(32), PIN);
    mockMmkvStore.set('app_lock_pin', legacy);

    expect(await verifyPIN(WRONG)).toBe(false);
    expect(mockMmkvStore.get('app_lock_pin')).toBe(legacy);
  });

  it('rejects a pre-v2 unsalted record instead of trusting it', async () => {
    mockMmkvStore.set('app_lock_pin', '5f4dcc3b5aa765d61d8327deb882cf99');
    expect(await verifyPIN(PIN)).toBe(false);
    expect(await verifyPIN('password')).toBe(false);
  });
});
