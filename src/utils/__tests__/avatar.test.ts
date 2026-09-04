import {avatarNeutral, getInitials} from '../avatar';

describe('getInitials', () => {
  it('takes one letter from a single name and two from a full one', () => {
    expect(getInitials('Xiaohan')).toBe('X');
    expect(getInitials('Xiaohan Liu')).toBe('XL');
  });

  it('stops at two even when there are more names', () => {
    expect(getInitials('Ada Byron Lovelace')).toBe('AB');
  });

  it('collapses runs of whitespace rather than reading them as a name', () => {
    expect(getInitials('  Xiaohan   Liu  ')).toBe('XL');
  });

  it('falls back to ? for nothing to take initials from', () => {
    expect(getInitials(undefined)).toBe('?');
    expect(getInitials(null)).toBe('?');
    expect(getInitials('')).toBe('?');
    // Whitespace-only used to produce an empty string, which renders as a
    // blank square rather than the placeholder the empty cases get.
    expect(getInitials('   ')).toBe('?');
  });

  it('uppercases, since a display name is whatever the user typed', () => {
    expect(getInitials('ada lovelace')).toBe('AL');
  });
});

describe('avatarNeutral', () => {
  it('is stable for a seed, so a list does not reshuffle between renders', () => {
    expect(avatarNeutral('uid-1', true)).toBe(avatarNeutral('uid-1', true));
    expect(avatarNeutral('uid-1', false)).toBe(avatarNeutral('uid-1', false));
  });

  it('answers from the mode it was asked about', () => {
    expect(avatarNeutral('uid-1', true)).not.toBe(avatarNeutral('uid-1', false));
  });

  /**
   * The whole point of the helper. An earlier palette hashed the name into six
   * saturated hues, which read as meaning something on a design built around a
   * single signal colour. Every value it can return is a step of one neutral —
   * greys in dark mode, and the ink colour at four opacities in light.
   */
  it('never returns a saturated colour, in either mode', () => {
    const seeds = ['a', 'uid-1', 'Xiaohan Liu', 'zzzz', '9', 'x'.repeat(40)];
    for (const seed of seeds) {
      expect(avatarNeutral(seed, true)).toMatch(/^#([0-9A-Fa-f]{2})\1\1$/);
      expect(avatarNeutral(seed, false)).toMatch(/^rgba\(10,15,10,0\.\d+\)$/);
    }
  });

  it('always lands inside the palette, never undefined', () => {
    for (const seed of ['', 'a', 'ab', 'abc', 'abcd', 'abcde']) {
      expect(avatarNeutral(seed, true)).toBeTruthy();
      expect(avatarNeutral(seed, false)).toBeTruthy();
    }
  });
});
