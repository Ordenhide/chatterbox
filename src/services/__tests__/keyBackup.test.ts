const mockResetGenericPassword = jest.fn();
const mockBlockStore = {remove: jest.fn()};
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

jest.mock(
  'react-native-keychain',
  () => ({
    get resetGenericPassword() {
      return mockKeychainPresent ? (...a: unknown[]) => mockResetGenericPassword(...a) : undefined;
    },
  }),
  {virtual: true},
);

jest.mock('../errorLog', () => ({reportHandled: jest.fn()}));

import {_resetKeyBackupModules, backupService, clearRecoveryPhrase} from '../keyBackup';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformOS = 'ios';
  mockKeychainPresent = true;
  mockBlockStorePresent = true;
  mockBlockStore.remove.mockResolvedValue(true);
  mockResetGenericPassword.mockResolvedValue(true);
  _resetKeyBackupModules();
});

describe('backupService', () => {
  it('is the namespace versions up to 1.2.0 wrote under, per account', () => {
    expect(backupService('uid1')).toBe('com.chatterbox.e2ee.recovery.uid1');
    expect(backupService('uid1')).not.toBe(backupService('uid2'));
  });
});

describe('clearRecoveryPhrase', () => {
  it('removes the Block Store entry on Android', async () => {
    mockPlatformOS = 'android';
    await clearRecoveryPhrase('uid1');
    expect(mockBlockStore.remove).toHaveBeenCalledWith(backupService('uid1'));
  });

  it('removes the synchronizable keychain entry on iOS', async () => {
    await clearRecoveryPhrase('uid1');
    expect(mockResetGenericPassword).toHaveBeenCalledWith({
      service: backupService('uid1'),
      cloudSync: true,
    });
  });

  it('does nothing without a user', async () => {
    mockPlatformOS = 'android';
    await clearRecoveryPhrase('');
    expect(mockBlockStore.remove).not.toHaveBeenCalled();
  });

  it('does not throw when the native side is absent or rejects', async () => {
    mockPlatformOS = 'android';
    mockBlockStorePresent = false;
    _resetKeyBackupModules();
    await expect(clearRecoveryPhrase('uid1')).resolves.toBeUndefined();

    mockBlockStorePresent = true;
    _resetKeyBackupModules();
    mockBlockStore.remove.mockRejectedValue(new Error('no play services'));
    await expect(clearRecoveryPhrase('uid1')).resolves.toBeUndefined();

    mockPlatformOS = 'ios';
    mockKeychainPresent = false;
    _resetKeyBackupModules();
    await expect(clearRecoveryPhrase('uid1')).resolves.toBeUndefined();
  });
});
