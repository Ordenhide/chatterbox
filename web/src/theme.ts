// Security-console theme: cool slate neutrals, a single cyan signal accent, and
// a steel-blue support tone. Colors are exposed as CSS custom properties
// (defined in styles.css for both dark and light schemes) so the whole app —
// which styles via this `colors` object — recolors instantly when the theme
// toggles, with no component changes. Values that must be real colors in JS
// (avatar palette, accent gradient) stay literal.
export const colors = {
  canvas: 'var(--cb-canvas)',
  text: 'var(--cb-text)',
  textSecondary: 'var(--cb-text-secondary)',
  textTertiary: 'var(--cb-text-tertiary)',

  surface: 'var(--cb-surface)',
  surfaceStrong: 'var(--cb-surface-strong)',
  menuSolid: 'var(--cb-menu-solid)', // opaque — for popovers/menus over content
  glassBorder: 'var(--cb-glass-border)',
  hover: 'var(--cb-hover)',
  inputBg: 'var(--cb-input-bg)',
  border: 'var(--cb-border)',
  borderStrong: 'var(--cb-border-strong)',

  primary: 'var(--cb-primary)',
  primaryLight: 'var(--cb-primary-light)',
  secondary: 'var(--cb-secondary)',
  // Theme-dependent: dark ink on the bright cyan (dark mode), white on the
  // deepened cyan (light mode). A fixed #fff fails contrast in dark mode.
  textOnPrimary: 'var(--cb-text-on-primary)',

  success: 'var(--cb-success)',
  danger: 'var(--cb-danger)',
  // The dark theme's red is bright: black on it is 6.42:1, white 3.27:1.
  textOnDanger: 'var(--cb-text-on-danger)',

  shadow: 'var(--cb-shadow)',
  shadowSoft: 'var(--cb-shadow-soft)',
  shadowGlow: 'var(--cb-shadow-glow)',
};

// Signature accent gradient (buttons, outgoing bubbles, logo). Two stops, not
// three: a tight cyan→steel-blue ramp instead of the old violet/magenta sweep.
// Token-valued rather than fixed hex: the two themes deliberately use
// different greens (#00FF41 is 1.37:1 on white), so a literal gradient here
// would be correct in exactly one of them.
export const accentGradient =
  'linear-gradient(135deg, var(--cb-primary) 0%, var(--cb-primary-soft) 130%)';

// Per-user avatar colors. Held to the cyan→blue→slate range (plus restrained
// teal/amber) so identity chips stay legible without reintroducing the
// consumer-social pink/violet the rest of the theme drops.
const AVATAR_COLORS = [
  '#16B5D8',
  '#4C82D8',
  '#2FA98B',
  '#6E8BA8',
  '#3E9AD4',
  '#1FB57E',
  '#C08A3E',
  '#5A7BC4',
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
