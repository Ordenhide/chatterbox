// "Aurora Glass" theme. Colors are exposed as CSS custom properties (defined in
// styles.css for both dark and light schemes) so the whole app — which styles
// via this `colors` object — recolors instantly when the theme toggles, with no
// component changes. Values that must be real colors in JS (avatar palette,
// accent gradient) stay literal.
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
  textOnPrimary: '#ffffff',

  success: 'var(--cb-success)',
  danger: 'var(--cb-danger)',

  shadow: 'var(--cb-shadow)',
  shadowSoft: 'var(--cb-shadow-soft)',
  shadowGlow: 'var(--cb-shadow-glow)',
};

// Signature accent gradient (buttons, outgoing bubbles, logo).
export const accentGradient = 'linear-gradient(135deg, #7C6BFF 0%, #9B5CFF 55%, #28D6EE 140%)';

// Vivid per-user avatar colors that pop on either canvas.
const AVATAR_COLORS = [
  '#7C6BFF',
  '#28D6EE',
  '#FF6BB3',
  '#FFB454',
  '#5CE1A6',
  '#B98CFF',
  '#4C8DFF',
  '#FF7A6B',
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
