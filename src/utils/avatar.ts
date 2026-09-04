/**
 * Initials and their backing colour, for anywhere a person is shown without a
 * photo.
 *
 * Extracted from ChatListScreen, which is where the decision was made and
 * where the reasoning still lives: the avatar colour is **monochrome on
 * purpose**. An earlier palette put six saturated hues (purple, blue, green,
 * yellow, red, blue) behind initials and picked between them by hashing the
 * name — so the hue looked like it meant something, carried nothing, and
 * competed with the one signal colour the whole design is built around.
 *
 * Four steps of a single neutral keep adjacent rows apart without spending any
 * attention. web/src/theme.ts reached the same four-step answer independently;
 * this is the mobile half of it.
 *
 * The chat *thread* was the last place still doing the rejected thing, via
 * react-native-gifted-chat's own GiftedAvatar, which hashes the name into a
 * saturated palette of its own — the magenta circle that turned up beside
 * voice messages was that, not anything this app chose.
 */

const DARK: readonly string[] = ['#2A2A2A', '#333333', '#3C3C3C', '#454545'];
const LIGHT: readonly string[] = [
  'rgba(10,15,10,0.16)',
  'rgba(10,15,10,0.22)',
  'rgba(10,15,10,0.28)',
  'rgba(10,15,10,0.34)',
];

/** Up to two initials, uppercased. '?' when there is no name to take them from. */
export function getInitials(value?: string | null): string {
  if (!value) return '?';
  const parts = value.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const second = parts.length > 1 ? parts[1][0] : '';
  const initials = (first + second).toUpperCase();
  // A name of only whitespace or punctuation leaves nothing to show.
  return initials || '?';
}

/**
 * A stable neutral for `seed`. The same person keeps the same step, so a list
 * does not reshuffle between renders.
 */
export function avatarNeutral(seed: string, isDark: boolean): string {
  const palette = isDark ? DARK : LIGHT;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % palette.length;
  }
  return palette[hash] || palette[0];
}
