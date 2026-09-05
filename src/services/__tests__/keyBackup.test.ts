const mockSetGenericPassword = jest.fn();
const mockGetGenericPassword = jest.fn();
const mockResetGenericPassword = jest.fn();
const mockBlockStore = {
  isCloudBackupSafe: jest.fn(),
  store: jest.fn(),
  retrieve: jest.fn(),
  remove: jest.fn(),
};
let mockPlatformOS = 'ios';
let mockKeychainPresent = true;
let mockBlockStorePresent = true;

jest.mock('react-native', () => ({
  get Platform() {
    return {OS: mockPlatformOS};
  },
  get NativeModules() {
    return mockBlockStorePresent ? {KeyBackup: mockBlockStore} : {};
  },
}));

// The factory runs once and jest caches the result, so "absent" is modelled as
// a module missing its methods rather than a throwing require. keychain()
// treats the two identically and the object form is the more interesting case:
// a linked-but-broken module, which is worse than an absent one because a
// caller would otherwise trust it with the key.
jest.mock(
  'react-native-keychain',
  () => ({
    get setGenericPassword() {
      return mockKeychainPresent ? (...a: unknown[]) => mockSetGenericPassword(...a) : undefined;
    },
    get getGenericPassword() {
      return mockKeychainPresent ? (...a: unknown[]) => mockGetGenericPassword(...a) : undefined;
    },
    get resetGenericPassword() {
      return mockKeychainPresent ? (...a: unknown[]) => mockResetGenericPassword(...a) : undefined;
    },
    ACCESSIBLE: {
      WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
    },
  }),
  {virtual: true},
);

jest.mock('../telemetry', () => ({reportHandled: jest.fn()}));

import {
  _resetKeyBackupModules,
  backupAvailability,
  backupService,
  clearRecoveryPhrase,
  loadRecoveryPhrase,
  saveRecoveryPhrase,
} from '../keyBackup';

const PHRASE = 'abandon '.repeat(23) + 'art';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformOS = 'ios';
  mockKeychainPresent = true;
  mockBlockStorePresent = true;
  mockBlockStore.isCloudBackupSafe.mockResolvedValue(true);
  mockBlockStore.store.mockResolvedValue(true);
  mockBlockStore.retrieve.mockResolvedValue(null);
  mockBlockStore.remove.mockResolvedValue(true);
  mockSetGenericPassword.mockResolvedValue(true);
  mockGetGenericPassword.mockResolvedValue(false);
  mockResetGenericPassword.mockResolvedValue(true);
  _resetKeyBackupModules();
});

describe('backupService', () => {
  it('scopes the entry per account, and apart from the working copy', () => {
    expect(backupService('uid1')).not.toBe(backupService('uid2'));
    // secureKeyStore uses com.chatterbox.e2ee.secretKey.<uid>; this must not
    // collide with it, or the backup would overwrite the device-only entry
    // whose whole point is not to sync.
    expect(backupService('uid1')).not.toContain('secretKey');
  });
});

describe('iOS', () => {
  /**
   * The security-critical property of the whole module.
   *
   * A THIS_DEVICE_ONLY accessibility constant is exactly what excludes an item
   * from iCloud Keychain. Pairing one with `cloudSync: true` produces an entry
   * that looks backed up and is not — the user is told their key will follow
   * them to a new phone, and it silently will not.
   */
  it('asks for a synchronizable entry, never a device-only one', async () => {
    await saveRecoveryPhrase('uid1', PHRASE);
    const options = mockSetGenericPassword.mock.calls[0][2];
    expect(options.cloudSync).toBe(true);
    expect(options.accessible).toBe('AccessibleWhenUnlocked');
    expect(String(options.accessible)).not.toMatch(/ThisDeviceOnly/i);
  });

  it('stores the phrase under the account-scoped service', async () => {
    await saveRecoveryPhrase('uid1', PHRASE);
    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'e2ee-recovery',
      PHRASE,
      expect.objectContaining({service: backupService('uid1')}),
    );
  });

  it('reads back what it stored', async () => {
    mockGetGenericPassword.mockResolvedValue({password: PHRASE});
    expect(await loadRecoveryPhrase('uid1')).toBe(PHRASE);
  });

  it('returns null rather than a falsy password when nothing is stored', async () => {
    mockGetGenericPassword.mockResolvedValue(false);
    expect(await loadRecoveryPhrase('uid1')).toBeNull();
  });

  it('reports cloud backup available when the keychain is linked', async () => {
    expect(await backupAvailability()).toBe('cloud');
  });
});

describe('Android', () => {
  beforeEach(() => {
    mockPlatformOS = 'android';
    _resetKeyBackupModules();
  });

  /**
   * Block Store's cloud copy is end-to-end encrypted only when the device has
   * a screen lock. Without one, Google holds the key — so this must not be
   * reported as 'cloud', or the app would promise a guarantee it does not have.
   */
  it('reports local-only when the device has no screen lock', async () => {
    mockBlockStore.isCloudBackupSafe.mockResolvedValue(false);
    expect(await backupAvailability()).toBe('local-only');
  });

  it('reports cloud when a screen lock makes the backup end-to-end encrypted', async () => {
    mockBlockStore.isCloudBackupSafe.mockResolvedValue(true);
    expect(await backupAvailability()).toBe('cloud');
  });

  it('does not claim cloud backup when the availability check itself fails', async () => {
    mockBlockStore.isCloudBackupSafe.mockRejectedValue(new Error('play services missing'));
    expect(await backupAvailability()).toBe('local-only');
  });

  it('stores and reads back through the native module', async () => {
    expect(await saveRecoveryPhrase('uid1', PHRASE)).toBe(true);
    expect(mockBlockStore.store).toHaveBeenCalledWith(backupService('uid1'), PHRASE);
    mockBlockStore.retrieve.mockResolvedValue(PHRASE);
    expect(await loadRecoveryPhrase('uid1')).toBe(PHRASE);
  });

  it('clears the entry so a signed-out account cannot restore itself', async () => {
    await clearRecoveryPhrase('uid1');
    expect(mockBlockStore.remove).toHaveBeenCalledWith(backupService('uid1'));
  });
});

describe('when the platform store is absent or broken', () => {
  /**
   * Every one of these is a supported state: the phrase prompt still covers
   * the user. What must not happen is a throw, which on the enrolment path
   * would fail the enrolment itself over a convenience.
   */
  it('is unavailable, and saves nothing, when the keychain is linked but broken', async () => {
    mockKeychainPresent = false;
    _resetKeyBackupModules();
    expect(await backupAvailability()).toBe('unavailable');
    expect(await saveRecoveryPhrase('uid1', PHRASE)).toBe(false);
    expect(await loadRecoveryPhrase('uid1')).toBeNull();
  });

  it('is unavailable, and saves nothing, with no native module on Android', async () => {
    mockPlatformOS = 'android';
    mockBlockStorePresent = false;
    _resetKeyBackupModules();
    expect(await backupAvailability()).toBe('unavailable');
    expect(await saveRecoveryPhrase('uid1', PHRASE)).toBe(false);
    expect(await loadRecoveryPhrase('uid1')).toBeNull();
  });

  it('reports failure rather than throwing when the store rejects', async () => {
    mockPlatformOS = 'android';
    _resetKeyBackupModules();
    mockBlockStore.store.mockRejectedValue(new Error('no play services'));
    await expect(saveRecoveryPhrase('uid1', PHRASE)).resolves.toBe(false);
    mockBlockStore.retrieve.mockRejectedValue(new Error('no play services'));
    await expect(loadRecoveryPhrase('uid1')).resolves.toBeNull();
    mockBlockStore.remove.mockRejectedValue(new Error('no play services'));
    await expect(clearRecoveryPhrase('uid1')).resolves.toBeUndefined();
  });

  it('does nothing for a missing user or an empty phrase', async () => {
    expect(await saveRecoveryPhrase('', PHRASE)).toBe(false);
    expect(await saveRecoveryPhrase('uid1', '')).toBe(false);
    expect(await loadRecoveryPhrase('')).toBeNull();
    expect(mockSetGenericPassword).not.toHaveBeenCalled();
  });

  it('is unavailable on a platform with neither store', async () => {
    mockPlatformOS = 'harmony';
    _resetKeyBackupModules();
    expect(await backupAvailability()).toBe('unavailable');
    expect(await saveRecoveryPhrase('uid1', PHRASE)).toBe(false);
  });
});
