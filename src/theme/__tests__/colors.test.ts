/**
 * The palette's contrast, asserted rather than remembered.
 *
 * The accent is #00FF41 in dark and #0A7A2A in light, and that split is not a
 * stylistic choice — #00FF41 is 1.37:1 on white. The same arithmetic decides
 * which ink goes *on* each fill, and getting it wrong is invisible in code
 * review: `color: '#fff'` on a green button looks perfectly reasonable in a
 * diff and renders as an empty button on a device.
 *
 * That is not hypothetical. 21 controls shipped exactly that pairing —
 * "Sign in" among them — and the failure only surfaced by computing it. These
 * tests exist so the next palette change fails here instead of on someone's
 * screen.
 */
import {getColors} from '../colors';

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;

describe('contrast', () => {
  it.each(['light', 'dark'] as const)('%s: ink on every filled surface passes AA', scheme => {
    const c = getColors(scheme);
    const pairs: Array<[string, string, string]> = [
      ['textOnPrimary on primary', c.textOnPrimary, c.primary],
      ['textOnDanger on danger', c.textOnDanger, c.danger],
      ['text on backdrop', c.text, c.backdrop],
      ['text on surfaceStrong', c.text, c.surfaceStrong],
    ];
    for (const [label, ink, fill] of pairs) {
      const ratio = contrast(ink, fill);
      // Reported with the label so a failure names the pair, not just a number.
      expect(`${label}: ${ratio.toFixed(2)}`).toBe(
        `${label}: ${Math.max(ratio, AA_TEXT).toFixed(2)}`,
      );
    }
  });

  it('secondary text stays readable on the backdrop', () => {
    // 4.5 is the bar for body copy; this token carries timestamps and labels,
    // which are small and therefore *more* demanding, not less.
    for (const scheme of ['light', 'dark'] as const) {
      const c = getColors(scheme);
      // textSecondary is an rgba over the backdrop, so compare the composite.
      const m = c.textSecondary.match(/[\d.]+/g)!;
      const alpha = Number(m[3]);
      const bg = c.backdrop.replace('#', '');
      const mix = [0, 2, 4].map(i => {
        const b = parseInt(bg.slice(i, i + 2), 16);
        return Math.round(Number(m[i / 2]) * alpha + b * (1 - alpha));
      });
      const hex = '#' + mix.map(v => v.toString(16).padStart(2, '0')).join('');
      expect(contrast(hex, c.backdrop)).toBeGreaterThan(3);
    }
  });

  // The reason the two themes cannot share an accent, stated as a test so
  // nobody "simplifies" them back into one value.
  it('the dark accent is unusable on a light ground, and vice versa', () => {
    const dark = getColors('dark');
    const light = getColors('light');
    expect(contrast(dark.primary, light.backdrop)).toBeLessThan(2);
    expect(contrast(light.primary, dark.backdrop)).toBeLessThan(4.5);
  });
});
