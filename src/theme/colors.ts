import {ColorSchemeName, Platform} from 'react-native';

/**
 * Terminal palette.
 *
 * A black ground, one signal green, and hairline rules — the look of a
 * security console rather than a chat app. The previous slate/cyan palette was
 * already heading here ("security-console" in its own comment); this takes it
 * the rest of the way.
 *
 * Contrast is computed, not eyeballed, and the numbers are recorded because
 * the accent makes one of them a trap. #00ff41 is 15.38:1 on black and
 * **1.37:1 on white** — the single brightest thing in the dark theme is
 * invisible in a light one. So the two themes do not share an accent: light
 * uses #0A7A2A (4.99:1 on its ground), which is the same hue reading as the
 * same signal, and is the reason a light theme could be kept at all.
 *
 * The glass tokens are retuned rather than removed. GlassScreen/GlassView are
 * used across ~30 screens, and deleting the layer would mean touching all of
 * them; near-zero tints plus a visible hairline border make the same
 * components render as flat panels with ruled edges, which is what the design
 * asks for.
 */

const light = {
  // Faintly green-biased neutrals: a pure grey next to this accent reads as
  // unconsidered, a hint of the accent's hue reads as chosen.
  backdrop: '#E9EDE9',
  background: 'rgba(242,245,242,0.92)',
  surface: 'rgba(255,255,255,0.86)',
  surfaceStrong: '#FFFFFF',
  text: '#0A0F0A',
  textSecondary: 'rgba(10,15,10,0.56)',
  border: 'rgba(10,15,10,0.14)',
  // Not #00ff41: that is 1.37:1 here. 4.99:1 on the ground above.
  primary: '#0A7A2A',
  // White on the deep green: 5.48:1.
  textOnPrimary: '#FFFFFF',
  primaryLight: 'rgba(10,122,42,0.12)',
  secondary: '#1F5C3A',
  success: '#0A7A2A',
  danger: '#B3261E',
  // White on the light theme's deeper red: 6.54:1.
  textOnDanger: '#FFFFFF',
  // Terminal amber, darkened to carry on a light ground: 5.40:1.
  warning: '#8A5A00',
  // White, because the light theme's amber is dark. #111 here is 3.19:1.
  textOnWarning: '#FFFFFF',
  glassTint1: 'rgba(10,122,42,0.07)',
  glassTint2: 'rgba(31,92,58,0.05)',
  glassTint3: 'rgba(10,122,42,0.03)',
  glassBorder: 'rgba(10,15,10,0.16)',
  glassHighlight: 'rgba(255,255,255,0.55)',
  shadow: 'rgba(10,15,10,0.10)',
  inputBackground: 'rgba(10,15,10,0.05)',
  separator: 'rgba(10,15,10,0.12)',
  mediaOverlayBg: '#000',
  mediaOverlayText: '#fff',
  mediaOverlayBadge: 'rgba(0,0,0,0.5)',
  mediaOverlayBackdrop: 'rgba(0,0,0,0.9)',
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: {width: 0, height: 1},
    elevation: 1,
  },
};

const dark = {
  // Pure black, not a near-black. The design depends on the ground being the
  // absence of light so the green is the only thing emitting any.
  backdrop: '#000000',
  background: 'rgba(0,0,0,0.94)',
  surface: 'rgba(10,10,10,0.86)',
  surfaceStrong: '#0A0A0A',
  text: '#FFFFFF',
  // The mockup carries most of its text at 20–60% white. Anything below ~45%
  // stops being readable as body copy, so this is the floor for real text;
  // the fainter values live in component styles as decoration only.
  textSecondary: 'rgba(255,255,255,0.48)',
  border: '#222222',
  // 15.38:1 on black.
  primary: '#00FF41',
  // Black on the green: 15.38:1. White here would be 1.37:1 — the inversion
  // is not a preference, it is the only legible direction.
  textOnPrimary: '#000000',
  primaryLight: 'rgba(0,255,65,0.14)',
  secondary: '#7CFFA8',
  success: '#00FF41',
  danger: '#FF4D4D',
  // Black, for the same reason textOnPrimary is: the dark theme's red is
  // bright. Black is 6.42:1 on it, white is 3.27:1 and fails AA. The old
  // palette's #E5484D failed too, at 3.91:1 — this token is fixing a
  // pre-existing bug, not one the retheme introduced.
  textOnDanger: '#000000',
  warning: '#FFB000',
  // Black on the bright amber: 11.46:1.
  textOnWarning: '#000000',
  glassTint1: 'rgba(0,255,65,0.05)',
  glassTint2: 'rgba(124,255,168,0.03)',
  glassTint3: 'rgba(0,255,65,0.02)',
  glassBorder: '#222222',
  glassHighlight: 'rgba(0,255,65,0.06)',
  shadow: 'rgba(0,0,0,0.8)',
  inputBackground: 'rgba(255,255,255,0.04)',
  separator: 'rgba(255,255,255,0.08)',
  mediaOverlayBg: '#000',
  mediaOverlayText: '#fff',
  mediaOverlayBadge: 'rgba(0,0,0,0.6)',
  mediaOverlayBackdrop: 'rgba(0,0,0,0.95)',
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 0,
    shadowOffset: {width: 0, height: 0},
    elevation: 0,
  },
};

export function getColors(scheme: ColorSchemeName) {
  return scheme === 'dark' ? dark : light;
}

// Monospace face for technical metadata (timestamps, ids, counts, status).
// Mirrors --cb-mono in the web client. RN needs a concrete family name per
// platform rather than a CSS-style fallback stack.
export const monoFont = Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'});

// Tightened corner radii. The previous values (18–28px) read soft/consumer;
// precise geometry is a large part of what makes tooling feel technical.
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
};

