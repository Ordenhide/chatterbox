import {describe, expect, it} from 'vitest';
import {COUNTRY_CODES, flagEmoji, toE164} from './countryCodes';

describe('toE164', () => {
  it('prepends the selected dial code to a plain national number', () => {
    // The ordinary case: Canadian number typed without any prefix.
    expect(toE164('+1', '2368693405')).toBe('+12368693405');
    expect(toE164('+44', '7911123456')).toBe('+447911123456');
  });

  it('ignores spaces, dashes and parentheses people type', () => {
    expect(toE164('+1', '(236) 869-3405')).toBe('+12368693405');
    expect(toE164('+1', '236 869 3405')).toBe('+12368693405');
  });

  it('does not double the country code when the user types it themselves', () => {
    // Naive concatenation would produce "+112368693405", which Firebase
    // rejects as an invalid number.
    expect(toE164('+1', '+1 236 869 3405')).toBe('+12368693405');
    expect(toE164('+1', '1 236 869 3405')).toBe('+12368693405');
  });

  it('respects a full international number over the selector', () => {
    // If someone pastes a number for a different country, the "+" wins —
    // silently re-prefixing it with the selected code would corrupt it.
    expect(toE164('+1', '+447911123456')).toBe('+447911123456');
  });

  it('drops the national trunk zero that E.164 forbids', () => {
    // UK and most of Europe write the national number with a leading 0.
    expect(toE164('+44', '07911 123456')).toBe('+447911123456');
    expect(toE164('+49', '0151 23456789')).toBe('+4915123456789');
  });

  it('keeps a leading 1 that is part of a NANP national number', () => {
    // Only an 11-digit string starting with 1 is the country code; a 10-digit
    // NANP number never starts with 1, so nothing should be stripped here.
    expect(toE164('+1', '1234567890')).toBe('+11234567890');
  });
});

describe('COUNTRY_CODES', () => {
  it('has no duplicate ISO codes', () => {
    const seen = new Set(COUNTRY_CODES.map(c => c.iso2));
    expect(seen.size).toBe(COUNTRY_CODES.length);
  });

  it('gives every entry a "+"-prefixed dial code', () => {
    for (const c of COUNTRY_CODES) {
      expect(c.dialCode).toMatch(/^\+\d+$/);
    }
  });

  it('derives a flag emoji from the ISO code', () => {
    expect(flagEmoji('CA')).toBe('🇨🇦');
    expect(flagEmoji('US')).toBe('🇺🇸');
  });
});
