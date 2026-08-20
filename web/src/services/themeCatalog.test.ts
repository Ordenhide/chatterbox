import {describe, expect, it} from 'vitest';
import {activeThemeId, effectForAccent, THEME_CATALOG, themeById} from './themeCatalog';

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

  it("anchors every gradient to end at the theme's own wallpaper", () => {
    // So the reduced-motion collapse to a flat tint reads as settling, not a
    // cut — see the StoreTheme.gradientStops doc comment.
    for (const t of THEME_CATALOG) {
      expect(t.gradientStops[t.gradientStops.length - 1]).toBe(t.wallpaper);
    }
  });

  it('keeps particle density within the ambient-texture cap', () => {
    for (const t of THEME_CATALOG) {
      expect(t.particles.density).toBeGreaterThanOrEqual(8);
      expect(t.particles.density).toBeLessThanOrEqual(14);
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

describe('effectForAccent', () => {
  it('returns the curated stops/particles for a catalog accent', () => {
    const midnight = themeById('midnight')!;
    expect(effectForAccent(midnight.accent)).toEqual({
      gradientStops: midnight.gradientStops,
      particles: midnight.particles,
    });
  });

  it('matches case-insensitively, same as activeThemeId', () => {
    const midnight = themeById('midnight')!;
    expect(effectForAccent(midnight.accent.toLowerCase())).toEqual({
      gradientStops: midnight.gradientStops,
      particles: midnight.particles,
    });
  });

  it('derives a 3-stop gradient for an accent outside the catalog', () => {
    const effect = effectForAccent('#123456');
    expect(effect.gradientStops).toHaveLength(3);
    expect(effect.particles.density).toBe(8);
    expect(effect.particles.style).toBe('dot');
  });

  it('derives distinct fallback stops for a light vs a dark custom accent', () => {
    const light = effectForAccent('#EEEEEE');
    const dark = effectForAccent('#111111');
    expect(light.gradientStops).not.toEqual(dark.gradientStops);
  });

  // The two branches place the accent differently: light ramps up *from* the
  // accent, dark puts it in the middle between a tint and a shade. Asserting
  // that position is what actually pins which branch ran — comparing two
  // different accents' stops passes either way, so it can't catch a
  // dark-check that's stuck true (which it was: the old test's `#EEEEEE`
  // took the dark branch).
  it.each([
    ['#EEEEEE', 'near-white'],
    ['#FFD700', 'bright gold'],
    ['#38BDF8', 'sky blue'],
  ])('treats %s (%s) as light: the accent leads the gradient', accent => {
    expect(effectForAccent(accent).gradientStops[0]).toBe(accent);
  });

  it.each([
    ['#111111', 'near-black'],
    ['#1E1B4B', 'deep indigo'],
  ])('treats %s (%s) as dark: the accent sits mid-gradient', accent => {
    expect(effectForAccent(accent).gradientStops[1]).toBe(accent);
  });
});
