const mockAllowRTL = jest.fn();
const mockForceRTL = jest.fn();
let mockIsRTL = false;

jest.mock('react-native', () => ({
  I18nManager: {
    allowRTL: (...a: unknown[]) => mockAllowRTL(...a),
    forceRTL: (...a: unknown[]) => mockForceRTL(...a),
    get isRTL() {
      return mockIsRTL;
    },
  },
}));

import {applyLayoutDirection, isRTLLanguage, RTL_LANGUAGES} from '../rtl';

beforeEach(() => {
  mockAllowRTL.mockReset();
  mockForceRTL.mockReset();
  mockIsRTL = false;
});

describe('isRTLLanguage', () => {
  it('knows the language that actually ships', () => {
    expect(isRTLLanguage('ar')).toBe(true);
  });

  it('sees through region and script subtags', () => {
    expect(isRTLLanguage('ar-EG')).toBe(true);
    expect(isRTLLanguage('ar_SA')).toBe(true);
    expect(isRTLLanguage('AR')).toBe(true);
  });

  it('is false for every left-to-right language in the picker', () => {
    for (const code of ['en', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'hi', 'it', 'tr', 'vi']) {
      expect(isRTLLanguage(code)).toBe(false);
    }
  });

  it('is false rather than throwing for nothing', () => {
    expect(isRTLLanguage(undefined)).toBe(false);
    expect(isRTLLanguage(null)).toBe(false);
    expect(isRTLLanguage('')).toBe(false);
  });

  // 'ar' is not a prefix of 'arabic-sounding' language tags, but a naive
  // startsWith would also match e.g. 'arn' (Mapudungun).
  it('matches the whole subtag, not a prefix of one', () => {
    expect(isRTLLanguage('arn')).toBe(false);
    expect(isRTLLanguage('urdu-ish')).toBe(false);
  });
});

describe('applyLayoutDirection', () => {
  it('allows RTL before forcing it — forceRTL is ignored without it', () => {
    applyLayoutDirection('ar');
    expect(mockAllowRTL).toHaveBeenCalledWith(true);
    expect(mockForceRTL).toHaveBeenCalledWith(true);
  });

  it('forces LTR back for a left-to-right language', () => {
    mockIsRTL = true;
    const result = applyLayoutDirection('en');
    expect(mockForceRTL).toHaveBeenCalledWith(false);
    expect(result.rtl).toBe(false);
  });

  /**
   * The property the caller actually needs. React Native fixes layout
   * direction at startup, so forceRTL describes the next launch — a caller
   * that assumes the running app reflowed will leave the user looking at a
   * half-applied screen.
   */
  it('says a restart is needed when the direction flips', () => {
    mockIsRTL = false;
    expect(applyLayoutDirection('ar').needsRestart).toBe(true);
    mockIsRTL = true;
    expect(applyLayoutDirection('en').needsRestart).toBe(true);
  });

  it('says no restart is needed when the direction already matches', () => {
    mockIsRTL = false;
    expect(applyLayoutDirection('en').needsRestart).toBe(false);
    mockIsRTL = true;
    expect(applyLayoutDirection('ar').needsRestart).toBe(false);
  });

  it('lists ar, the language the picker offers', () => {
    expect(RTL_LANGUAGES).toContain('ar');
  });
});
