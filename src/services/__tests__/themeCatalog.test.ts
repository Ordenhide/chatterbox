import {
  ACCENT_INK_DARK,
  ACCENT_INK_LIGHT,
  activeThemeId,
  inkOn,
  THEME_CATALOG,
  themeById,
} from '../themeCatalog';

/**
 * A theme is an accent and nothing else. It used to carry a `wallpaper` tint
 * plus `gradientStops`/`particles` for an animated backdrop behind the
 * thread; the chat background is the app's canvas now, moved only by the
 * dark/light theme, so those are gone rather than left as dead fields.
 */
describe('the theme catalog', () => {
  it('carries an accent and no background of any kind', () => {
    for (const theme of THEME_CATALOG) {
      expect(Object.keys(theme).sort()).toEqual(['accent', 'id', 'name']);
    }
  });

  it('gives every theme a distinct id and a distinct accent', () => {
    expect(new Set(THEME_CATALOG.map(t => t.id)).size).toBe(THEME_CATALOG.length);
    expect(new Set(THEME_CATALOG.map(t => t.accent.toLowerCase())).size).toBe(
      THEME_CATALOG.length,
    );
  });

  it('looks a theme up by id', () => {
    expect(themeById('sky')?.accent).toBe('#0EA5E9');
    expect(themeById('no-such-theme')).toBeUndefined();
  });

  describe('activeThemeId', () => {
    it('names the catalog entry a stored accent came from', () => {
      expect(activeThemeId('#0EA5E9')).toBe('sky');
    });

    it('matches case-insensitively — stored values are free-form strings', () => {
      expect(activeThemeId('#0ea5e9')).toBe('sky');
    });

    it('is undefined for an accent that is not in the catalog, and for none', () => {
      expect(activeThemeId('#123456')).toBeUndefined();
      expect(activeThemeId(undefined)).toBeUndefined();
      expect(activeThemeId('')).toBeUndefined();
    });
  });
});

/**
 * Ink over a theme accent.
 *
 * The palette's `textOnPrimary` inverts with the dark/light mode, because the
 * two themes' own primaries do. A store accent is the same hex in both modes,
 * so taking its ink from the mode is unrelated to what the text sits on — and
 * it failed: white on Arctic (#22D3EE) is 1.81:1, and 11 of the 12 accents
 * the catalog carried at the time were unreadable that way in light mode.
 * Arctic has since been dropped from the catalog, but it stays here as a
 * regression input — the per-chat picker writes free-form hexes, so `inkOn`
 * still has to be right for accents no catalog ever listed.
 */
describe('inkOn', () => {
  const luminance = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const channel = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255)
    );
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it.each(THEME_CATALOG.map(t => [t.id, t.accent] as const))(
    'picks an AA-passing ink for %s (%s)',
    (_id, accent) => {
      expect(contrast(accent, inkOn(accent))).toBeGreaterThanOrEqual(4.5);
    },
  );

  // The reason this measures rather than thresholds brightness. Classic reads
  // as "dark" by BT.601 and so took white ink at 4.47:1, a fail, when black on
  // the same fill is 4.70:1.
  it('takes the better of the two inks even when the call is close', () => {
    expect(inkOn('#6366F1')).toBe(ACCENT_INK_DARK);
    expect(contrast('#6366F1', ACCENT_INK_DARK)).toBeGreaterThan(
      contrast('#6366F1', ACCENT_INK_LIGHT),
    );
  });

  it('picks light ink where that is genuinely the better one', () => {
    // Slate is the one catalog accent black ink fails on (4.41:1).
    expect(inkOn('#64748B')).toBe(ACCENT_INK_LIGHT);
  });

  it('is decided by the fill, not the mode — the same accent gets the same ink in both', () => {
    // Nothing here reads a colour scheme. Stated as a test because the bug
    // was precisely that the ink came from somewhere the fill had no say in.
    expect(inkOn('#22D3EE')).toBe(ACCENT_INK_DARK);
    expect(inkOn('#6366F1')).toBe(ACCENT_INK_DARK);
  });

  it('falls back to dark ink for anything that is not a hex colour', () => {
    expect(inkOn(null)).toBe(ACCENT_INK_DARK);
    expect(inkOn(undefined)).toBe(ACCENT_INK_DARK);
    expect(inkOn('')).toBe(ACCENT_INK_DARK);
    expect(inkOn('rebeccapurple')).toBe(ACCENT_INK_DARK);
  });

  it('accepts the 3-digit shorthand', () => {
    expect(inkOn('#000')).toBe(ACCENT_INK_LIGHT);
    expect(inkOn('#fff')).toBe(ACCENT_INK_DARK);
  });
});
