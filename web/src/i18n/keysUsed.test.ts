/**
 * A key the code asks for that no dictionary defines.
 *
 * `t()` returns the key path itself when it finds nothing, so the failure ships
 * as UI: `errors.generic` reached four alerts on mobile as literal body text
 * before anyone noticed. English is the fallback every other language leans
 * on, so a gap here is a gap in every language at once — which makes the `en`
 * dictionary the only one worth checking for this.
 *
 * Twin of src/i18n/__tests__/locales.test.ts on mobile, which has had this
 * check for a while. The web client did not, and the gap was the last of the
 * three mechanical guards mobile had and this client lacked. It finds nothing
 * today; that is the point at which to add it, rather than after a release
 * renders a key path to somebody.
 *
 * i18n.test.ts covers the other direction — a dictionary carrying a key
 * English has dropped — and the completeness ratios. This one is only about
 * keys the code reaches for.
 *
 * Only statically-written keys can be checked. A computed one is invisible
 * here, so this is a floor, not a guarantee; the second suite puts a floor
 * under that floor by resolving the static *prefix* of a computed key.
 */
import {readFileSync, readdirSync, statSync} from 'fs';
import {join, relative} from 'path';
import {describe, expect, it} from 'vitest';
import {_dicts} from './index';

const SRC = join(__dirname, '..');
const en = _dicts.en as Record<string, string>;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    // Test files are excluded: a key written inside a test is not a key the
    // app renders, and a fixture naming a deliberately-missing key would make
    // this fail for the wrong reason.
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles(SRC);

/** key -> first file that asks for it. */
function staticKeys(): Map<string, string> {
  const found = new Map<string, string>();
  // The dictionaries are flat (`'chat.viewOnceExpired'`), so a key is one
  // string literal rather than a path to walk.
  const pattern = /\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g;
  for (const file of FILES) {
    // i18n/index.tsx *defines* the dictionaries; a key there is a definition,
    // not a use.
    if (file === join(SRC, 'i18n', 'index.tsx')) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      if (!found.has(match[1])) found.set(match[1], file);
    }
  }
  return found;
}

/**
 * The static prefix of a computed key: `t(`chat.reportReason.${reason}`)`
 * yields "chat.reportReason".
 *
 * A computed key cannot be resolved here, but its prefix can, and that is
 * enough to catch the failure that actually happened on mobile: a namespace
 * was deleted while a template literal still pointed into it, and every option
 * rendered as its own key path on screen.
 */
function computedPrefixes(): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /\bt\(\s*`([A-Za-z0-9_.]+?)\.?\$\{/g;
  for (const file of FILES) {
    if (file === join(SRC, 'i18n', 'index.tsx')) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      const prefix = match[1].replace(/\.$/, '');
      if (prefix && !found.has(prefix)) found.set(prefix, file);
    }
  }
  return found;
}

describe('translation keys used in code', () => {
  const used = staticKeys();

  it('finds the call sites, so a passing run means something', () => {
    // A regex that matched nothing would make the assertion below vacuous —
    // and an empty set is exactly what a broken parser reports.
    expect(used.size).toBeGreaterThan(200);
    expect([...used.keys()]).toContain('profile.signOut');
    expect(en['profile.signOut']).toBeTypeOf('string');
  });

  it('are all defined in the fallback dictionary', () => {
    const missing = [...used]
      .filter(([key]) => typeof en[key] !== 'string')
      .map(([key, file]) => `${key} (${relative(SRC, file)})`);
    expect(missing).toEqual([]);
  });
});

describe('computed translation keys', () => {
  const prefixes = computedPrefixes();

  it('finds the call sites, so a passing run means something', () => {
    expect(prefixes.size).toBeGreaterThan(0);
  });

  it('point at a namespace that has strings in it', () => {
    const keys = Object.keys(en);
    const broken = [...prefixes]
      .filter(([prefix]) => !keys.some(k => k.startsWith(`${prefix}.`)))
      .map(([prefix, file]) => `${prefix} (${relative(SRC, file)})`);
    expect(broken).toEqual([]);
  });
});
