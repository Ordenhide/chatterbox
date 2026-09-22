/**
 * Layout styles follow reading order, not the physical left and right.
 *
 * Twin of src/i18n/__tests__/directionAgnosticStyles.test.ts on mobile, which
 * has had this guard for a while. This client did not, and it had drifted:
 * 31 physical-side properties across nine files, including the divider on
 * every sidebar and the rail on the reply quote. `dir="rtl"` is set for ar,
 * fa, he and ur (i18n/index.tsx), so in four shipped languages the flex order
 * flipped and those borders stayed put — a sidebar divider on the window's
 * outer edge, and a quote whose accent rail sat opposite its own tight
 * corners.
 *
 * Nothing catches this by type: `marginLeft` is as valid a CSS property as
 * `marginInlineStart`, and the difference only shows on a build set to
 * Arabic. So the guard is a test.
 *
 * `left`/`right` and `textAlign` are deliberately not checked. Several are
 * correct as they stand — `left: 0, right: 0` pairs stretch to full width in
 * either direction, a coordinate from `getBoundingClientRect` is already
 * absolute, and `textAlign: 'center'` has no direction. A blanket rule would
 * have to be suppressed in all of those places, which teaches people to
 * suppress it. Margins, paddings and borders have no such exceptions here.
 */
import {readFileSync, readdirSync, statSync} from 'fs';
import {join, relative} from 'path';
import {describe, expect, it} from 'vitest';

const SRC = join(__dirname);

/** property -> the logical property to use instead. */
const BANNED: Record<string, string> = {
  marginLeft: 'marginInlineStart',
  marginRight: 'marginInlineEnd',
  paddingLeft: 'paddingInlineStart',
  paddingRight: 'paddingInlineEnd',
  borderLeft: 'borderInlineStart',
  borderRight: 'borderInlineEnd',
  borderLeftWidth: 'borderInlineStartWidth',
  borderRightWidth: 'borderInlineEndWidth',
  borderLeftColor: 'borderInlineStartColor',
  borderRightColor: 'borderInlineEndColor',
  borderLeftStyle: 'borderInlineStartStyle',
  borderRightStyle: 'borderInlineEndStyle',
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles(SRC);

function offenders(): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const prop of Object.keys(BANNED)) {
          // The style-object form only. `\b` on the left keeps
          // `borderLeftWidth` from also matching as `borderLeft`, since each
          // is listed separately with its own replacement.
          if (new RegExp(`\\b${prop}\\s*:`).test(line)) {
            found.push(`${relative(SRC, file)}:${i + 1}  ${prop} → ${BANNED[prop]}`);
          }
        }
      });
  }
  return found;
}

describe('layout styles are direction-agnostic', () => {
  it('reads the files it is checking, so a passing run means something', () => {
    // A walker that found nothing would report a clean tree. Pinned on the
    // count and on a file known to carry a large style object.
    expect(FILES.length).toBeGreaterThan(40);
    expect(FILES.some(f => f.endsWith('components/ChatPane.tsx'))).toBe(true);
    // And the detector itself: the same pattern must fire on the shape it is
    // looking for, or the assertion below passes for the wrong reason.
    expect(/\bmarginLeft\s*:/.test('  menuCheck: {marginLeft: 8},')).toBe(true);
  });

  it('uses the logical property rather than Left/Right', () => {
    expect(offenders()).toEqual([]);
  });

  it('names a replacement for every banned property', () => {
    for (const [prop, replacement] of Object.entries(BANNED)) {
      expect(replacement).not.toBe(prop);
      expect(replacement).toMatch(/Inline(Start|End)/);
    }
  });
});
