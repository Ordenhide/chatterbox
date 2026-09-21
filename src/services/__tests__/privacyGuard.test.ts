/**
 * applyScreenshotProtection is what backs a *claim* the UI makes to the user —
 * ChatScreen's "Screenshot protection active" banner. So the property under
 * test is not "it calls the native module", it is "it never reports protection
 * it did not apply".
 */
const mockSetSecureFlag = jest.fn();
const mockIsLocked = jest.fn();
const mockReportHandled = jest.fn();
let mockPlatformOS = 'android';
let mockNativeModules: Record<string, unknown> = {
  ScreenshotGuard: {setSecureFlag: mockSetSecureFlag},
  ScreenLock: {isLocked: mockIsLocked},
};

jest.mock('react-native', () => ({
  get Platform() {
    return {OS: mockPlatformOS};
  },
  get NativeModules() {
    return mockNativeModules;
  },
}));
jest.mock('../storageMMKV', () => ({
  mmkvStorage: {getBoolean: () => undefined, setBoolean: jest.fn(), getNumber: () => undefined, setNumber: jest.fn()},
}));
jest.mock('../firebase/firestore', () => ({
  doc: jest.fn(), getDoc: jest.fn(), getFirestore: jest.fn(), setDoc: jest.fn(),
}));
jest.mock('../errorLog', () => ({reportHandled: (...a: unknown[]) => mockReportHandled(...a)}));

import {applyScreenshotProtection, isScreenLocked} from '../privacyGuard';

beforeEach(() => {
  mockSetSecureFlag.mockReset();
  mockIsLocked.mockReset().mockResolvedValue(false);
  mockReportHandled.mockReset();
  mockPlatformOS = 'android';
  mockNativeModules = {
    ScreenshotGuard: {setSecureFlag: mockSetSecureFlag},
    ScreenLock: {isLocked: mockIsLocked},
  };
});

describe('applyScreenshotProtection', () => {
  it('sets the flag and says protection is on', () => {
    expect(applyScreenshotProtection(true)).toBe(true);
    expect(mockSetSecureFlag).toHaveBeenCalledWith(true);
  });

  it('clears the flag and says protection is off', () => {
    expect(applyScreenshotProtection(false)).toBe(false);
    expect(mockSetSecureFlag).toHaveBeenCalledWith(false);
  });

  /**
   * The shape the old code could not distinguish. It called
   * `NativeModules.ScreenshotGuard?.mockSetSecureFlag?.(enabled)`, so a build
   * without the native module returned exactly what a successful call did.
   */
  it('reports no protection when the native module is missing', () => {
    mockNativeModules = {};
    expect(applyScreenshotProtection(true)).toBe(false);
    expect(mockReportHandled).toHaveBeenCalled();
  });

  it('reports no protection when the module is there but the method is not', () => {
    mockNativeModules = {ScreenshotGuard: {}};
    expect(applyScreenshotProtection(true)).toBe(false);
    expect(mockReportHandled).toHaveBeenCalled();
  });

  it('reports no protection when the call throws, instead of swallowing it', () => {
    mockSetSecureFlag.mockImplementation(() => {
      throw new Error('activity is null');
    });
    expect(applyScreenshotProtection(true)).toBe(false);
    expect(mockReportHandled).toHaveBeenCalled();
  });

  it('claims nothing on iOS, which has no equivalent window flag', () => {
    mockPlatformOS = 'ios';
    expect(applyScreenshotProtection(true)).toBe(false);
    expect(mockSetSecureFlag).not.toHaveBeenCalled();
  });
});

/**
 * This one decides whether a message's plaintext goes on the lock screen, so
 * the property under test is the direction it fails in. Unlike the screenshot
 * flag above — where the safe answer is "I did not protect anything" — an
 * unanswerable question here has to come back as *locked*, because the other
 * answer is the one that displays the message.
 */
describe('isScreenLocked', () => {
  it('reports the keyguard state the native module gives', async () => {
    mockIsLocked.mockResolvedValue(true);
    expect(await isScreenLocked()).toBe(true);
    mockIsLocked.mockResolvedValue(false);
    expect(await isScreenLocked()).toBe(false);
  });

  it('answers locked when the native module is missing', async () => {
    mockNativeModules = {};
    expect(await isScreenLocked()).toBe(true);
    expect(mockReportHandled).toHaveBeenCalled();
  });

  it('answers locked when the module is there but the method is not', async () => {
    mockNativeModules = {ScreenLock: {}};
    expect(await isScreenLocked()).toBe(true);
    expect(mockReportHandled).toHaveBeenCalled();
  });

  it('answers locked when the call rejects', async () => {
    mockIsLocked.mockRejectedValue(new Error('no keyguard service'));
    expect(await isScreenLocked()).toBe(true);
    expect(mockReportHandled).toHaveBeenCalled();
  });

  // iOS implements reveal-on-unlock itself, from the user's own Show Previews
  // setting. Answering "locked" there would override that with a permanent
  // redaction the user never asked for.
  it('defers to the OS on iOS', async () => {
    mockPlatformOS = 'ios';
    expect(await isScreenLocked()).toBe(false);
    expect(mockIsLocked).not.toHaveBeenCalled();
  });
});
