import {describe, expect, it} from 'vitest';
import {avatarColor} from './theme';

describe('avatarColor', () => {
  it('is deterministic for a given seed', () => {
    expect(avatarColor('user-123')).toBe(avatarColor('user-123'));
  });

  it('always returns a hex color from the palette', () => {
    for (const seed of ['a', 'bob@example.com', 'Z9', '', 'a-very-long-uid-000']) {
      expect(avatarColor(seed)).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('distributes across more than one color', () => {
    const seeds = Array.from({length: 40}, (_, i) => `seed-${i}`);
    const distinct = new Set(seeds.map(avatarColor));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
