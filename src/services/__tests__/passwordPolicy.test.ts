import {checkPasswordStrength, MIN_PASSWORD_LENGTH} from '../passwordPolicy';

describe('checkPasswordStrength', () => {
  it('rejects anything shorter than the minimum length', () => {
    expect(checkPasswordStrength('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe('too-short');
  });

  it('accepts a length-8 password that is not a known-weak pattern', () => {
    expect(checkPasswordStrength('zebra918')).toBe('ok');
  });

  it('rejects common passwords regardless of case', () => {
    expect(checkPasswordStrength('Password1')).toBe('too-common');
    expect(checkPasswordStrength('PASSWORD123')).toBe('too-common');
  });

  it('rejects a single repeated character even at full length', () => {
    expect(checkPasswordStrength('aaaaaaaaaaaa')).toBe('too-simple');
  });

  it('rejects ascending and descending runs', () => {
    expect(checkPasswordStrength('abcdefghij')).toBe('too-simple');
    expect(checkPasswordStrength('jihgfedcba')).toBe('too-simple');
    expect(checkPasswordStrength('23456789')).toBe('too-simple');
  });

  it('rejects "12345678" too, just via the common-password list rather than the pattern check', () => {
    // Both checks would reject it; the common-password list runs first and
    // gives the more specific (and more accurate) reason.
    expect(checkPasswordStrength('12345678')).toBe('too-common');
  });

  it('accepts a genuinely random-looking password', () => {
    expect(checkPasswordStrength('xK9$mQ2vLp')).toBe('ok');
  });

  it('accepts a long passphrase', () => {
    expect(checkPasswordStrength('correct horse battery staple')).toBe('ok');
  });
});
