/**
 * The mock keychain here models react-native-keychain's *native* iOS
 * behaviour, not its TypeScript types, because the bug these tests exist for
 * lived in the gap between the two.
 *
 * RNKeychainManager.m decides kSecAttrSynchronizable by presence:
 *
 *   if (options && options[@"cloudSync"]) return kCFBooleanTrue;
 *
 * `cloudSync: false` crosses the bridge as @NO — non-nil — so it means "sync".
 * An entry is found only by a query with the same synchronizable value, so an
 * entry written with `cloudSync: false` is invisible to a read that omits the
 * option. That is what kept every secret out of the iOS Keychain until
 * 2026-09-15 (see writeOptions in secureKeyStore.ts).
 */
let mockPlatformOS = 'ios';

jest.mock('react-native', () => ({
  get Platform() {
    return {OS: mockPlatformOS};
  },
}));

/** Keyed by service and the synchronizable flag, as SecItem matches them. */
const mockItems = new Map<string, string>();

function mockSync(options?: Record<string, unknown>): 0 | 1 {
  // undefined is dropped by the bridge (nil); anything else, false included,
  // arrives as an object and counts as true.
  return options && options.cloudSync !== undefined && options.cloudSync !== null ? 1 : 0;
}

function mockKey(options?: Record<string, unknown>): string {
  return `${String(options?.service ?? '')}|sync=${mockSync(options)}`;
}

const mockReset = jest.fn();

jest.mock(
  'react-native-keychain',
  () => ({
    setGenericPassword: async (_user: string, password: string, options?: Record<string, unknown>) => {
      // setGenericPasswordForOptions deletes matching entries, then adds.
      mockItems.set(mockKey(options), password);
      return {service: options?.service, storage: 'keychain'};
    },
    getGenericPassword: async (options?: Record<string, unknown>) => {
      const password = mockItems.get(mockKey(options));
      return password === undefined ? false : {password};
    },
    resetGenericPassword: async (options?: Record<string, unknown>) => {
      mockReset(options);
      mockItems.delete(mockKey(options));
      return true;
    },
    ACCESSIBLE: {WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly'},
  }),
  {virtual: true},
);

jest.mock('../errorLog', () => ({reportError: jest.fn()}));

import {backupService} from '../keyBackup';
import {
  RECOVERY_SERVICE_PREFIX,
  getSecret,
  secretKeyService,
  setSecretVerified,
} from '../secureKeyStore';

const SERVICE = secretKeyService('uid1');

beforeEach(() => {
  mockItems.clear();
  mockReset.mockClear();
  mockPlatformOS = 'ios';
});

describe('setSecretVerified under the native presence semantics', () => {
  it('writes a secret that the next read finds', async () => {
    // Fails if cloudSync — with any value but undefined — is put back into
    // writeOptions: the write lands at sync=1 and getSecret looks at sync=0.
    await expect(setSecretVerified(SERVICE, 'aa11')).resolves.toBe(true);
    await expect(getSecret(SERVICE)).resolves.toBe('aa11');
  });

  it('never leaves the secret in a synchronizable entry', async () => {
    await setSecretVerified(SERVICE, 'aa11');
    expect(mockItems.get(`${SERVICE}|sync=1`)).toBeUndefined();
    expect(mockItems.get(`${SERVICE}|sync=0`)).toBe('aa11');
  });
});

describe('stray synchronizable entries from the old cloudSync:false writes', () => {
  it('are deleted on iOS when the secret is next written', async () => {
    mockItems.set(`${SERVICE}|sync=1`, 'stale');
    await expect(setSecretVerified(SERVICE, 'aa11')).resolves.toBe(true);
    expect(mockItems.has(`${SERVICE}|sync=1`)).toBe(false);
  });

  it('are not cleaned on Android, where the same call would delete the real entry', async () => {
    // The Android module ignores cloudSync, so reset({cloudSync: true}) there
    // is reset({}) — the working copy.
    mockPlatformOS = 'android';
    await setSecretVerified(SERVICE, 'aa11');
    expect(mockReset).not.toHaveBeenCalled();
  });
});

describe('the iCloud recovery backup', () => {
  it('shares its namespace constant with keyBackup', () => {
    expect(backupService('uid1').startsWith(`${RECOVERY_SERVICE_PREFIX}.`)).toBe(true);
    expect(SERVICE.startsWith(RECOVERY_SERVICE_PREFIX)).toBe(false);
  });

  it('is never written or cleaned through this module', async () => {
    const recovery = backupService('uid1');
    mockItems.set(`${recovery}|sync=1`, 'phrase-backup');
    await expect(setSecretVerified(recovery, 'aa11')).resolves.toBe(false);
    expect(mockReset).not.toHaveBeenCalled();
    expect(mockItems.get(`${recovery}|sync=1`)).toBe('phrase-backup');
    expect(mockItems.has(`${recovery}|sync=0`)).toBe(false);
  });

  it('survives the stray cleanup of a neighbouring service', async () => {
    const recovery = backupService('uid1');
    mockItems.set(`${recovery}|sync=1`, 'phrase-backup');
    await setSecretVerified(SERVICE, 'aa11');
    expect(mockItems.get(`${recovery}|sync=1`)).toBe('phrase-backup');
  });
});
