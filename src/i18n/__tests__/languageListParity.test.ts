/**
 * The same language, spelled three different ways.
 *
 * A language's own name is written out in three places that nothing connects:
 * the mobile picker (src/i18n/languages.ts), the web picker
 * (web/src/i18n/index.tsx), and scripts/site-copy/languages.mjs, which the
 * generators read and whose list the landing page prints as the answer to
 * "which languages?". Each is hand-maintained, and the failure is silent by
 * construction: the picker offers a language the site never mentions, or the
 * site advertises a name the app spells differently, and nobody who can read
 * the script is looking at all three files.
 *
 * Both halves of that already happened while these lists grew to their current
 * length. Burmese was `မြန်မာ` on the phone and `မြန်မာဘာသာ` on the site and in
 * the browser. Uzbek was `Oʻzbekcha` on the phone — which is how Uzbek Latin
 * actually spells it, with U+02BB — against an ASCII apostrophe in the other
 * two, so the public page printed a misspelling of the name of a language to
 * the readers most likely to notice.
 *
 * Neither is catchable by review at this size, and neither breaks anything that
 * a type or a render test would see. So compare the three lists directly, by
 * codepoint.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

import {LANGUAGES} from '../languages';

const ROOT = join(__dirname, '..', '..', '..');

/**
 * Both pickers declare the same literal shape, so one text scan reads either.
 * The web list is parsed rather than imported because it is a separate project
 * with its own toolchain — the same reason the other parity tests read across.
 */
const parsePicker = (file: string): Map<string, string> => {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf('export const LANGUAGES');
  if (start < 0) throw new Error(`${file}: no exported LANGUAGES`);
  const block = src.slice(start, src.indexOf('];', start));
  const row = /\{code: (['"])(.+?)\1, label: (['"])(.+?)\3, nativeLabel: (['"])(.+?)\5\}/g;
  const found = new Map<string, string>();
  for (const m of block.matchAll(row)) {
    // A name containing the quote that delimits it is escaped in source.
    found.set(m[2], m[6].replace(/\\(['"])/g, '$1'));
  }
  if (!found.size) throw new Error(`${file}: LANGUAGES parsed to nothing`);
  return found;
};

const siteLanguages = (): Map<string, string> => {
  const src = readFileSync(join(ROOT, 'scripts/site-copy/languages.mjs'), 'utf8');
  const row = /\{code: (['"])(.+?)\1, lang: .+?, dir: .+?, native: (['"])(.+?)\3\}/g;
  const found = new Map<string, string>();
  for (const m of src.matchAll(row)) found.set(m[2], m[4].replace(/\\(['"])/g, '$1'));
  if (!found.size) throw new Error('site-copy/languages.mjs parsed to nothing');
  return found;
};

const web = parsePicker(join(ROOT, 'web/src/i18n/index.tsx'));
const site = siteLanguages();

describe('the three language lists', () => {
  it('offer the same set of languages', () => {
    const mobile = LANGUAGES.map(l => l.code).sort();
    expect([...web.keys()].sort()).toEqual(mobile);
    expect([...site.keys()].sort()).toEqual(mobile);
  });

  it.each(LANGUAGES.map(l => [l.code, l.nativeLabel] as const))(
    'spell %s the same way in all three',
    (code, nativeLabel) => {
      // Codepoints, not glyphs: the two spellings of Uzbek looked identical.
      expect(web.get(code)).toBe(nativeLabel);
      expect(site.get(code)).toBe(nativeLabel);
    },
  );

  it('parses all three lists, so a green run is not an empty one', () => {
    expect(LANGUAGES.length).toBeGreaterThan(40);
    expect(web.size).toBe(LANGUAGES.length);
    expect(site.size).toBe(LANGUAGES.length);
  });
});
