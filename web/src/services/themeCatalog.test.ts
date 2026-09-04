import {describe, expect, it} from 'vitest';
import {ACCENT_INK_DARK, ACCENT_INK_LIGHT, activeThemeId, inkOn, THEME_CATALOG, themeById} from './themeCatalog';

describe('THEME_CATALOG', () => {
  it('has unique ids', () => {
    const ids = THEME_CATALOG.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every previously-shipped accent colour in the catalog', () => {
    // These are the colours ChatSettingsModal shipped before the store
    // existed. If one dropped out of the catalog, an existing user would
    // find the theme they were already using no longer offered.
    const previouslyShipped = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#64748B'];
    for (const accent of previouslyShipped) {
      const entry = THEME_CATALOG.find(t => t.accent === accent);
      expect(entry, `${accent} should still be in the catalog`).toBeDefined();
    }
  });

  it('gives every theme a usable accent and a name', () => {
    for (const t of THEME_CATALOG) {
      expect(t.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.name.trim().length).toBeGreaterThan(0);
    }
  });

  // A theme is an accent and nothing else. It used to carry a `wallpaper`
  // tint plus `gradientStops`/`particles` for an animated backdrop behind the
  // thread; the chat background is the app's canvas now, moved only by the
  // dark/light theme.
  it('carries an accent and no background of any kind', () => {
    for (const t of THEME_CATALOG) {
      expect(Object.keys(t).sort()).toEqual(['accent', 'id', 'name']);
    }
  });
});

describe('themeById / activeThemeId', () => {
  it('finds a theme by id', () => {
    expect(themeById('midnight')?.name).toBe('Midnight');
    expect(themeById('nope')).toBeUndefined();
  });

  it('maps a stored accent colour back to its catalog entry', () => {
    expect(activeThemeId('#6366F1')).toBe('classic');
  });

  it('matches case-insensitively, since stored values come from mixed sources', () => {
    expect(activeThemeId('#6366f1')).toBe('classic');
  });

  it('returns undefined for an unset or custom accent rather than guessing', () => {
    expect(activeThemeId(undefined)).toBeUndefined();
    expect(activeThemeId(null)).toBeUndefined();
    expect(activeThemeId('#123456')).toBeUndefined();
  });
});

describe('inkOn', () => {
  // Ink for a theme accent used as a button fill. Measured against the fill,
  // not taken from the dark/light mode, which says nothing about the colour
  // sitting under the text. See the mobile twin for the full reasoning.
  it('picks an AA-passing ink for every catalog accent', () => {
    const luminance = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const ch = (c: number) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
    };
    for (const t of THEME_CATALOG) {
      const [hi, lo] = [luminance(t.accent), luminance(inkOn(t.accent))].sort((a, b) => b - a);
      expect((hi + 0.05) / (lo + 0.05), t.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('takes the better of the two inks even when the call is close', () => {
    expect(inkOn('#6366F1')).toBe(ACCENT_INK_DARK);
    expect(inkOn('#64748B')).toBe(ACCENT_INK_LIGHT);
  });

  it('falls back to dark ink for anything that is not a hex colour', () => {
    expect(inkOn(null)).toBe(ACCENT_INK_DARK);
    expect(inkOn(undefined)).toBe(ACCENT_INK_DARK);
    expect(inkOn('')).toBe(ACCENT_INK_DARK);
  });

  it('accepts the 3-digit shorthand', () => {
    expect(inkOn('#000')).toBe(ACCENT_INK_LIGHT);
    expect(inkOn('#fff')).toBe(ACCENT_INK_DARK);
  });
});
