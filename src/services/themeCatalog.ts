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
 * `pro` is a presentation flag. Unlike the AI features — which cost real
 * money per call and are therefore gated server-side — a bypassed theme lock
 * costs nothing and grants nothing but a colour, so it is deliberately not
 * defended beyond the UI.
 */
export interface StoreTheme {
  id: string;
  name: string;
  /** Accent colour — stored in chat.themeBy[uid]. */
  accent: string;
  /** Wallpaper — hex tint, or null for none. Stored in chat.wallpaperBy[uid]. */
  wallpaper: string | null;
  pro: boolean;
}

/**
 * Every entry pairs its accent with a wallpaper, free ones included.
 *
 * The free themes originally carried `wallpaper: null` — they were just the
 * accent colours this app already shipped. That made applying one a no-op on
 * screen: the accent reaches only a couple of controls, so with no wallpaper
 * change a themed chat was pixel-identical to an unthemed one. A store item
 * that visibly does nothing when you buy into it is indistinguishable from a
 * broken button, so each free theme now gets a light tint drawn from its own
 * accent, and the Pro ones keep their deeper backgrounds.
 */
export const THEME_CATALOG: StoreTheme[] = [
  {id: 'classic', name: 'Classic', accent: '#6366F1', wallpaper: '#EEF0FF', pro: false},
  {id: 'sky', name: 'Sky', accent: '#0EA5E9', wallpaper: '#E8F4FE', pro: false},
  {id: 'forest', name: 'Forest', accent: '#10B981', wallpaper: '#E8F8F1', pro: false},
  {id: 'amber', name: 'Amber', accent: '#F59E0B', wallpaper: '#FDF3E3', pro: false},
  {id: 'rose', name: 'Rose', accent: '#EC4899', wallpaper: '#FDECF4', pro: false},
  {id: 'slate', name: 'Slate', accent: '#64748B', wallpaper: '#EEF1F5', pro: false},

  // Pro: curated accent + wallpaper pairings.
  {id: 'midnight', name: 'Midnight', accent: '#818CF8', wallpaper: '#0F172A', pro: true},
  {id: 'sunset', name: 'Sunset', accent: '#FB7185', wallpaper: '#4C1D24', pro: true},
  {id: 'matcha', name: 'Matcha', accent: '#84CC16', wallpaper: '#1A2E05', pro: true},
  {id: 'lavender', name: 'Lavender', accent: '#A78BFA', wallpaper: '#2E1065', pro: true},
  {id: 'ember', name: 'Ember', accent: '#F97316', wallpaper: '#2B1503', pro: true},
  {id: 'arctic', name: 'Arctic', accent: '#22D3EE', wallpaper: '#0C2A33', pro: true},
];

/**
 * Whether a wallpaper needs light text on top of it.
 *
 * Chat text is a fixed dark colour, which disappears against a dark
 * background. That was already reachable before the store existed — chat
 * settings has always offered the `dusk` and `ink` tints — but every Pro
 * theme is dark, so it went from an edge case to the common one.
 *
 * Custom wallpapers are Storage URLs rather than colours; their brightness is
 * unknowable without decoding the image, so they're treated as light (the
 * long-standing behaviour) instead of guessing.
 */
export function isDarkWallpaper(wallpaper: string | null | undefined): boolean {
  if (!wallpaper || !wallpaper.startsWith('#')) return false;
  const hex = wallpaper.slice(1);
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map(c => c + c)
          .join('')
      : hex;
  if (full.length !== 6) return false;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Perceived brightness (ITU-R BT.601). Below the midpoint reads as dark.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

export function themeById(id: string): StoreTheme | undefined {
  return THEME_CATALOG.find(t => t.id === id);
}

/** The catalog entry matching a chat's currently-stored accent, if any. */
export function activeThemeId(accent: string | undefined | null): string | undefined {
  if (!accent) return undefined;
  return THEME_CATALOG.find(t => t.accent.toLowerCase() === accent.toLowerCase())?.id;
}
