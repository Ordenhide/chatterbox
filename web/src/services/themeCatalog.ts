/**
 * The theme store catalog.
 *
 * A theme is an **accent colour and nothing else**. It is stored in the one
 * per-chat field that already existed for it (`chat.themeBy[uid]`), so every
 * accent ever stored stays valid and no migration is needed.
 *
 * It used to carry a background too — a `wallpaper` tint plus `gradientStops`
 * and `particles` for an animated backdrop behind the thread. That is gone by
 * design: the chat background is the app's own canvas, and the only thing
 * that changes it is the dark/light theme. A conversation should look like
 * the app it is in, and a per-chat background meant the two disagreed and
 * that every colour composed over it had to be re-checked against a surface
 * the design system did not control. An accent is a small, safe thing to let
 * a theme change; the ground everything is read against is not.
 *
 * Kept deliberately parallel to src/services/themeCatalog.ts — same names,
 * same values — matching this repo's parallel-not-shared convention.
 */
export interface StoreTheme {
  id: string;
  name: string;
  /** Accent colour — stored in chat.themeBy[uid]. */
  accent: string;
}

/**
 * Twelve hand-curated accents. The six/six split of light and dark values is
 * preserved from when each was paired with a matching wallpaper; without the
 * backgrounds it is simply variety.
 */
export const THEME_CATALOG: StoreTheme[] = [
  {id: 'classic', name: 'Classic', accent: '#6366F1'},
  {id: 'sky', name: 'Sky', accent: '#0EA5E9'},
  {id: 'forest', name: 'Forest', accent: '#10B981'},
  {id: 'amber', name: 'Amber', accent: '#F59E0B'},
  {id: 'rose', name: 'Rose', accent: '#EC4899'},
  {id: 'slate', name: 'Slate', accent: '#64748B'},
  {id: 'midnight', name: 'Midnight', accent: '#818CF8'},
  {id: 'sunset', name: 'Sunset', accent: '#FB7185'},
  {id: 'matcha', name: 'Matcha', accent: '#84CC16'},
  {id: 'lavender', name: 'Lavender', accent: '#A78BFA'},
  {id: 'ember', name: 'Ember', accent: '#F97316'},
  {id: 'arctic', name: 'Arctic', accent: '#22D3EE'},
];

export function themeById(id: string): StoreTheme | undefined {
  return THEME_CATALOG.find(t => t.id === id);
}

/** The catalog entry matching a chat's currently-stored accent, if any. */
export function activeThemeId(accent: string | undefined | null): string | undefined {
  if (!accent) return undefined;
  return THEME_CATALOG.find(t => t.accent.toLowerCase() === accent.toLowerCase())?.id;
}

/**
 * The two inks an accent fill can carry.
 *
 * Absolute, not palette tokens: they are chosen against the *fill*, which is
 * a colour the design system did not pick and which is the same hex in dark
 * and light mode.
 */
export const ACCENT_INK_LIGHT = '#FFFFFF';
// True black, not a softened near-black. The web client used #0B1220 here,
// which is prettier and costs about half a point of contrast — Classic
// (#6366F1) scores 4.19:1 against it and 4.70:1 against black, so the
// affectation was the difference between failing AA and passing it. On an
// arbitrary accent there is no contrast to spare.
export const ACCENT_INK_DARK = '#000000';

/**
 * The readable ink for text on `fill` — whichever of the two scores higher
 * WCAG contrast against it.
 *
 * Deliberately not a brightness threshold. The obvious version ("is this
 * colour dark? then white text") is a different question from the one that
 * matters, and it gets close calls wrong: Classic (#6366F1) reads as dark by
 * BT.601, so it took white ink at 4.47:1 — a fail — when black on the same
 * fill is 4.70:1 and passes. Comparing the two candidates directly cannot
 * make that mistake, because it is measuring the thing being asserted.
 *
 * The palette's own `textOnPrimary` still handles `colors.primary`, which
 * inverts with the mode because the two themes' primaries do. This is for
 * accents, which don't.
 */
export function inkOn(fill: string | null | undefined): string {
  const rgb = fill ? hexToRgb(fill) : null;
  if (!rgb) return ACCENT_INK_DARK;
  const l = relativeLuminance(rgb);
  const against = (ink: string) => {
    const inkL = relativeLuminance(hexToRgb(ink)!);
    const [hi, lo] = l > inkL ? [l, inkL] : [inkL, l];
    return (hi + 0.05) / (lo + 0.05);
  };
  return against(ACCENT_INK_LIGHT) > against(ACCENT_INK_DARK)
    ? ACCENT_INK_LIGHT
    : ACCENT_INK_DARK;
}

/** WCAG 2.x relative luminance. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function hexToRgb(hex: string): [number, number, number] | null {
  if (!hex.startsWith('#')) return null;
  const raw = hex.slice(1);
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  if (full.length !== 6) return null;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
