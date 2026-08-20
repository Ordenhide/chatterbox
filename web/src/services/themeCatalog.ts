/**
 * The theme store catalog.
 *
 * A "theme" pairs an accent colour with a wallpaper, because both already
 * exist per-chat as free-form strings (`chat.themeBy[uid]`,
 * `chat.wallpaperBy[uid]`) — applying one just writes those two existing
 * fields via setChatTheme/setChatWallpaper. That keeps the store fully
 * backward compatible: every accent colour already stored stays valid, and
 * no schema migration is needed.
 *
 * Every theme in this catalog is free. `gradientStops`/`particles` drive the
 * animated `.cb-aurora`/`.cb-particles` backdrop (see ChatPane.tsx) that
 * replaces the old flat wallpaper tint; `wallpaper` itself stays as the
 * static reduced-motion fallback rather than becoming a dead field.
 *
 * Kept deliberately parallel to src/services/themeCatalog.ts (mobile) — same
 * names, same semantics, matching this repo's parallel-not-shared convention.
 */
export type ParticleStyle = 'dot' | 'spark' | 'confetti';

export interface ThemeParticles {
  /** Particle count. Capped low — this is ambient texture, not a light show. */
  density: number;
  style: ParticleStyle;
}

export interface StoreTheme {
  id: string;
  name: string;
  /** Accent colour — stored in chat.themeBy[uid]. */
  accent: string;
  /** Wallpaper — hex tint, or null for none. Stored in chat.wallpaperBy[uid]. */
  wallpaper: string | null;
  /**
   * Animated gradient stops, brightest-first. The last stop is always the
   * same value as `wallpaper` deliberately: when motion is reduced, the
   * backdrop collapses to that flat tint, and matching the gradient's last
   * stop to it makes that collapse read as settling rather than a cut.
   */
  gradientStops: [string, string] | [string, string, string];
  particles: ThemeParticles;
}

/**
 * Twelve hand-curated looks, six historically light and six historically
 * dark — that split is preserved from before this was a paid/free split, it
 * was never about pricing, it's genuine visual variety.
 */
export const THEME_CATALOG: StoreTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    accent: '#6366F1',
    wallpaper: '#EEF0FF',
    gradientStops: ['#818CF8', '#C7D2FE', '#EEF0FF'],
    particles: {density: 9, style: 'dot'},
  },
  {
    id: 'sky',
    name: 'Sky',
    accent: '#0EA5E9',
    wallpaper: '#E8F4FE',
    gradientStops: ['#38BDF8', '#BAE6FD', '#E8F4FE'],
    particles: {density: 9, style: 'dot'},
  },
  {
    id: 'forest',
    name: 'Forest',
    accent: '#10B981',
    wallpaper: '#E8F8F1',
    gradientStops: ['#34D399', '#A7F3D0', '#E8F8F1'],
    particles: {density: 9, style: 'dot'},
  },
  {
    id: 'amber',
    name: 'Amber',
    accent: '#F59E0B',
    wallpaper: '#FDF3E3',
    gradientStops: ['#FBBF24', '#FDE68A', '#FDF3E3'],
    particles: {density: 11, style: 'spark'},
  },
  {
    id: 'rose',
    name: 'Rose',
    accent: '#EC4899',
    wallpaper: '#FDECF4',
    gradientStops: ['#F472B6', '#FBCFE8', '#FDECF4'],
    particles: {density: 12, style: 'confetti'},
  },
  {
    id: 'slate',
    name: 'Slate',
    accent: '#64748B',
    wallpaper: '#EEF1F5',
    gradientStops: ['#94A3B8', '#CBD5E1', '#EEF1F5'],
    particles: {density: 8, style: 'dot'},
  },

  {
    id: 'midnight',
    name: 'Midnight',
    accent: '#818CF8',
    wallpaper: '#0F172A',
    gradientStops: ['#A5B4FC', '#4338CA', '#0F172A'],
    particles: {density: 13, style: 'spark'},
  },
  {
    id: 'sunset',
    name: 'Sunset',
    accent: '#FB7185',
    wallpaper: '#4C1D24',
    gradientStops: ['#FDA4AF', '#E11D48', '#4C1D24'],
    particles: {density: 12, style: 'spark'},
  },
  {
    id: 'matcha',
    name: 'Matcha',
    accent: '#84CC16',
    wallpaper: '#1A2E05',
    gradientStops: ['#BEF264', '#4D7C0F', '#1A2E05'],
    particles: {density: 9, style: 'dot'},
  },
  {
    id: 'lavender',
    name: 'Lavender',
    accent: '#A78BFA',
    wallpaper: '#2E1065',
    gradientStops: ['#DDD6FE', '#7C3AED', '#2E1065'],
    particles: {density: 12, style: 'confetti'},
  },
  {
    id: 'ember',
    name: 'Ember',
    accent: '#F97316',
    wallpaper: '#2B1503',
    gradientStops: ['#FDBA74', '#C2410C', '#2B1503'],
    particles: {density: 12, style: 'spark'},
  },
  {
    id: 'arctic',
    name: 'Arctic',
    accent: '#22D3EE',
    wallpaper: '#0C2A33',
    gradientStops: ['#A5F3FC', '#0891B2', '#0C2A33'],
    particles: {density: 11, style: 'confetti'},
  },
];

/**
 * Whether a wallpaper needs light text on top of it.
 *
 * Chat text is a fixed dark colour, which disappears against a dark
 * background. That was already reachable before the store existed — chat
 * settings has always offered the `dusk` and `ink` tints — but half the
 * catalog is dark, so it went from an edge case to a common one.
 *
 * Custom wallpapers are Storage URLs rather than colours; their brightness is
 * unknowable without decoding the image, so they're treated as light (the
 * long-standing behaviour) instead of guessing.
 */
export function isDarkWallpaper(wallpaper: string | null | undefined): boolean {
  return isDarkColor(wallpaper);
}

/**
 * Whether a hex colour is dark enough to need light ink on top.
 *
 * Same BT.601 test `isDarkWallpaper` has always used, exposed separately
 * because accents need it too: a theme's accent becomes a button fill
 * app-wide, and bright accents (amber, matcha) need dark ink while deep ones
 * (lavender, rose) need white.
 */
export function isDarkColor(color: string | null | undefined): boolean {
  const brightness = perceivedBrightness(color);
  return brightness !== null && brightness < 0.5;
}

/**
 * Perceived brightness 0-1 (ITU-R BT.601), or null for anything that isn't a
 * hex colour — a photo URL, or a malformed value.
 */
function perceivedBrightness(color: string | null | undefined): number | null {
  if (!color) return null;
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function themeById(id: string): StoreTheme | undefined {
  return THEME_CATALOG.find(t => t.id === id);
}

/** The catalog entry matching a chat's currently-stored accent, if any. */
export function activeThemeId(accent: string | undefined | null): string | undefined {
  if (!accent) return undefined;
  return THEME_CATALOG.find(t => t.accent.toLowerCase() === accent.toLowerCase())?.id;
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

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Blends a colour toward white by `amount` (0-1) — a cheap, dependency-free tint. */
function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Blends a colour toward black by `amount` (0-1). */
function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/**
 * Gradient + particle config for any accent, catalog or not.
 *
 * Falls back to a generic tint/shade derivation for accents that aren't one
 * of the 12 curated themes above (a legacy value from before this catalog
 * existed, or a future marketplace pack that hasn't supplied its own effect
 * config) — so the backdrop renderer never has nothing to draw.
 */
export function effectForAccent(accent: string): Pick<StoreTheme, 'gradientStops' | 'particles'> {
  const catalogMatch = THEME_CATALOG.find(t => t.accent.toLowerCase() === accent.toLowerCase());
  if (catalogMatch) {
    return {gradientStops: catalogMatch.gradientStops, particles: catalogMatch.particles};
  }
  // Judge the accent's own brightness. The previous form also tested
  // `darken(accent, 0.5)`, which is true for anything but near-white —
  // halving every channel halves perceived brightness — so every accent took
  // the dark branch and light accents rendered with an inverted gradient.
  const brightness = perceivedBrightness(accent);
  const dark = brightness !== null && brightness < 0.5;
  const gradientStops: [string, string, string] = dark
    ? [lighten(accent, 0.25), accent, darken(accent, 0.6)]
    : [accent, lighten(accent, 0.45), lighten(accent, 0.75)];
  return {gradientStops, particles: {density: 8, style: 'dot'}};
}
