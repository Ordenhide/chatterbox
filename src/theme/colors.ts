import {ColorSchemeName, Platform} from 'react-native';

// Security-console palette, shared in spirit with the web client
// (web/src/styles.css) and the marketing site: cool slate neutrals, a single
// cyan signal accent, and a steel-blue support tone. The glass tints stay —
// the structure is unchanged — but they're re-tinted off the accent range
// instead of the previous blue/pink/mint mix, which read consumer-social.
const light = {
  backdrop: '#EEF2F7',
  background: 'rgba(244,247,251,0.85)',
  surface: 'rgba(255,255,255,0.75)',
  surfaceStrong: 'rgba(255,255,255,0.93)',
  text: '#0B1220',
  textSecondary: 'rgba(11,18,32,0.58)',
  border: 'rgba(15,33,60,0.08)',
  // Darkened accents: the dark-mode cyan fails contrast on a light canvas.
  primary: '#0B7F9E',
  // White on the deepened cyan: 4.62:1.
  textOnPrimary: '#fff',
  primaryLight: 'rgba(11,127,158,0.12)',
  secondary: '#2F62B5',
  success: '#0F8F63',
  danger: '#C8353A',
  warning: '#B8791F',
  glassTint1: 'rgba(11,127,158,0.20)',
  glassTint2: 'rgba(47,98,181,0.14)',
  glassTint3: 'rgba(15,143,99,0.10)',
  glassBorder: 'rgba(255,255,255,0.40)',
  glassHighlight: 'rgba(255,255,255,0.50)',
  shadow: 'rgba(15,33,60,0.10)',
  inputBackground: 'rgba(15,33,60,0.05)',
  separator: 'rgba(15,33,60,0.08)',
  mediaOverlayBg: '#000',
  mediaOverlayText: '#fff',
  mediaOverlayBadge: 'rgba(0,0,0,0.5)',
  mediaOverlayBackdrop: 'rgba(0,0,0,0.9)',
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
};

const dark = {
  backdrop: '#070B12',
  background: 'rgba(10,15,23,0.90)',
  surface: 'rgba(18,27,40,0.68)',
  surfaceStrong: 'rgba(18,27,40,0.94)',
  text: '#E3ECF7',
  textSecondary: 'rgba(227,236,247,0.58)',
  border: 'rgba(130,173,219,0.10)',
  primary: '#16B5D8',
  // Dark ink on the bright cyan: 8.10:1. White here would be 2.43:1 — a WCAG
  // failure — so dark mode deliberately inverts the on-primary text.
  textOnPrimary: '#070B12',
  primaryLight: 'rgba(22,181,216,0.15)',
  secondary: '#4C82D8',
  success: '#1FB57E',
  danger: '#E5484D',
  warning: '#E8A33D',
  glassTint1: 'rgba(22,181,216,0.22)',
  glassTint2: 'rgba(76,130,216,0.16)',
  glassTint3: 'rgba(31,181,126,0.10)',
  glassBorder: 'rgba(130,173,219,0.12)',
  glassHighlight: 'rgba(190,220,255,0.07)',
  shadow: 'rgba(0,0,0,0.36)',
  inputBackground: 'rgba(130,173,219,0.09)',
  separator: 'rgba(130,173,219,0.07)',
  mediaOverlayBg: '#000',
  mediaOverlayText: '#fff',
  mediaOverlayBadge: 'rgba(0,0,0,0.5)',
  mediaOverlayBackdrop: 'rgba(0,0,0,0.9)',
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
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

