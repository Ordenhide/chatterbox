import {describe, expect, it} from 'vitest';
import {activeThemeId, THEME_CATALOG, themeById} from './themeCatalog';

describe('THEME_CATALOG', () => {
  it('has unique ids', () => {
    const ids = THEME_CATALOG.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers free themes so the store is usable without paying', () => {
    expect(THEME_CATALOG.some(t => !t.pro)).toBe(true);
    expect(THEME_CATALOG.some(t => t.pro)).toBe(true);
  });

  it('keeps every previously-shipped accent colour available on the free tier', () => {
    // These are the colours ChatSettingsModal shipped before the store
    // existed. If one became Pro, an existing user would find the theme they
    // were already using suddenly locked behind a paywall.
    const previouslyShipped = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#64748B'];
    for (const accent of previouslyShipped) {
      const entry = THEME_CATALOG.find(t => t.accent === accent);
      expect(entry, `${accent} should still be in the catalog`).toBeDefined();
      expect(entry!.pro, `${accent} must stay free`).toBe(false);
    }
  });

  it('gives every theme a usable accent and a name', () => {
    for (const t of THEME_CATALOG) {
      expect(t.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.name.trim().length).toBeGreaterThan(0);
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
