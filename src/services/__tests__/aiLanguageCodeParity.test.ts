/**
 * The Speech-to-Text and Cloud Translate language maps, checked against each
 * other and against reality.
 *
 * Four tables carry this mapping: src/services/transcription.ts and
 * src/services/translation.ts on mobile, and their two namesakes inside
 * web/src/services/ai.ts. All four are hand-maintained `Partial<Record>`s
 * keyed by this app's own language codes, and nothing before this file
 * compared them. The last 26 languages were added by copying mobile's values
 * into web's tables so the two could not drift *at the time* — a one-off
 * guarantee, not a standing one. The next edit to either side has nothing
 * stopping it from quietly diverging.
 *
 * They are `Partial`, not `Record`, because Google's coverage is narrower
 * than this app's: Tibetan has neither Speech-to-Text nor Cloud Translate
 * support, and Tigrinya has Translate but not Speech-to-Text (both verified
 * against Google's own supported-languages docs, not assumed). KNOWN_GAPS
 * below is that list, with a source next to each — an entry here is a
 * documented absence, and the coverage test still fails on anything that
 * isn't on it, so a language quietly missing a mapping still gets caught.
 *
 * Three failure modes matter here, and none trips a type error or breaks
 * the build:
 *
 *  - mobile and web disagree on the code for the same language, so the same
 *    person gets a working transcription on their phone and a wrong-language
 *    (or silently English) one in the browser;
 *  - a code is malformed — empty, the wrong case, missing the region Speech
 *    actually requires (Punjabi needs the script subtag; Norwegian's
 *    Bokmål-only STT support means "no" itself is never a valid entry) — and
 *    is never once passed to Google's API in this test suite;
 *  - a language silently loses its mapping (or gains a fabricated one) and
 *    nothing here notices because Partial makes a missing key legal.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

import {LANGUAGES} from '../../i18n/languages';

const ROOT = join(__dirname, '..', '..', '..');

/**
 * These four tables are plain `Partial<Record<Code, string>>` object literals
 * with no nesting, so a line-oriented regex reads all of them the same way —
 * mobile's own source and web's separate reimplementation alike. Parsing as
 * text (rather than importing) avoids pulling web's own tsconfig/module graph
 * into a mobile test, and keeps this test honest about reading the same bytes
 * a person reviewing the file would.
 */
const parseTable = (file: string, exportName: string): Map<string, string> => {
  const src = readFileSync(file, 'utf8');
  const declAt = src.indexOf(`${exportName}: `);
  if (declAt < 0) throw new Error(`${file}: no "${exportName}: " declaration found`);
  const start = src.indexOf('{', declAt);
  if (start < 0) throw new Error(`${file}: no opening brace for ${exportName}`);
  const end = src.indexOf('\n};', start);
  if (end < 0) throw new Error(`${file}: unterminated ${exportName} table`);
  const block = src.slice(start, end);
  const row = /^\s*'?([\w-]+)'?:\s*'([^']*)'/gm;
  const found = new Map<string, string>();
  for (const m of block.matchAll(row)) {
    if (found.has(m[1])) throw new Error(`${file} ${exportName}: duplicate key "${m[1]}"`);
    found.set(m[1], m[2]);
  }
  if (!found.size) throw new Error(`${file} ${exportName}: parsed to nothing`);
  return found;
};

const mobileSpeech = parseTable(join(ROOT, 'src/services/transcription.ts'), 'SPEECH_LANGUAGE_CODES');
const mobileTranslate = parseTable(join(ROOT, 'src/services/translation.ts'), 'TRANSLATE_LANGUAGE_CODES');
const webSpeech = parseTable(join(ROOT, 'web/src/services/ai.ts'), 'SPEECH_LANGUAGE_CODES');
const webTranslate = parseTable(join(ROOT, 'web/src/services/ai.ts'), 'TRANSLATE_LANGUAGE_CODES');

// Mobile's LanguageCode has one entry, 'zh', that the offered picker doesn't
// (it's a bare alias for zh-Hans — see the tables' own comments); every other
// key on either side is exactly the offered languages, minus the gaps below.
const OFFERED: string[] = LANGUAGES.map(l => l.code);

// Every offered language with no mapping in a given table, and why — checked
// 2026-09 against docs.cloud.google.com's own supported-languages pages, not
// assumed from a blog post or a training-data guess. Revalidate the source
// before removing an entry (Google adds languages over time) or adding one
// (an app language this test doesn't yet know about being unsupported).
const KNOWN_GAPS: {code: string; table: 'speech' | 'translate'; because: string}[] = [
  {code: 'bo', table: 'speech', because: 'Tibetan is absent from the Speech-to-Text V2 language table entirely.'},
  {code: 'bo', table: 'translate', because: 'Tibetan is absent from both Cloud Translate model tables entirely.'},
  {code: 'ti', table: 'speech', because: 'Tigrinya is absent from the Speech-to-Text V2 language table entirely.'},
];
const gapsFor = (table: 'speech' | 'translate') =>
  new Set(KNOWN_GAPS.filter(g => g.table === table).map(g => g.code));

describe('the AI language-code tables', () => {
  it('cover every offered language except a documented gap, on both clients', () => {
    const speechGaps = gapsFor('speech');
    const translateGaps = gapsFor('translate');
    for (const code of OFFERED) {
      expect([code, 'mobile speech', mobileSpeech.has(code) || speechGaps.has(code)]).toEqual([
        code,
        'mobile speech',
        true,
      ]);
      expect([code, 'mobile translate', mobileTranslate.has(code) || translateGaps.has(code)]).toEqual([
        code,
        'mobile translate',
        true,
      ]);
      expect([code, 'web speech', webSpeech.has(code) || speechGaps.has(code)]).toEqual([code, 'web speech', true]);
      expect([code, 'web translate', webTranslate.has(code) || translateGaps.has(code)]).toEqual([
        code,
        'web translate',
        true,
      ]);
    }
  });

  it('do not carry an entry for a language KNOWN_GAPS says has none', () => {
    // Catches the opposite mistake: a "helpful" fabricated code for a gap
    // that's supposed to stay a documented, honest absence.
    for (const {code, table} of KNOWN_GAPS) {
      const [mobileTable, webTable] = table === 'speech' ? [mobileSpeech, webSpeech] : [mobileTranslate, webTranslate];
      expect({code, table, mobileHas: mobileTable.has(code)}).toEqual({code, table, mobileHas: false});
      expect({code, table, webHas: webTable.has(code)}).toEqual({code, table, webHas: false});
    }
  });

  it('have no entries beyond the offered languages plus the documented zh alias', () => {
    const allowed = new Set([...OFFERED, 'zh']);
    for (const [name, table] of [
      ['mobile speech', mobileSpeech],
      ['mobile translate', mobileTranslate],
    ] as const) {
      const extra = [...table.keys()].filter(k => !allowed.has(k));
      expect({name, extra}).toEqual({name, extra: []});
    }
    for (const [name, table] of [
      ['web speech', webSpeech],
      ['web translate', webTranslate],
    ] as const) {
      const extra = [...table.keys()].filter(k => !OFFERED.includes(k));
      expect({name, extra}).toEqual({name, extra: []});
    }
  });

  it.each(OFFERED)('mobile and web agree on the Speech-to-Text code for %s', code => {
    expect(webSpeech.get(code)).toBe(mobileSpeech.get(code));
  });

  it.each(OFFERED)('mobile and web agree on the Cloud Translate code for %s', code => {
    expect(webTranslate.get(code)).toBe(mobileTranslate.get(code));
  });

  // BCP-47-ish: a 2-3 letter base, optionally followed by a script and/or a
  // region subtag. Loose on purpose — this exists to catch an empty string,
  // a leftover placeholder, or a bare app language code like "no" or "pa"
  // that Speech-to-Text does not itself accept — not to validate against
  // Google's actual language list, which changes independently of this repo.
  const STT_SHAPE = /^[a-z]{2,3}(-[A-Z][a-z]{3})?-[A-Z]{2}$/;
  it.each([...mobileSpeech, ...webSpeech])('%s -> %s looks like a Speech-to-Text code', (_code, value) => {
    expect(value).toMatch(STT_SHAPE);
  });

  const TRANSLATE_SHAPE = /^[a-z]{2,3}(-[A-Z]{2})?$/;
  it.each([...mobileTranslate, ...webTranslate])('%s -> %s looks like a Cloud Translate code', (_code, value) => {
    expect(value).toMatch(TRANSLATE_SHAPE);
  });

  // A bare app code is never itself correct for Speech: Punjabi needs the
  // script subtag (a plain "pa-IN" is rejected) and Norwegian only exists as
  // Bokmål ("nb-NO") to this API — both learned by hitting the real error.
  it('never passes a bare, unmapped app code through to Speech-to-Text', () => {
    expect(mobileSpeech.get('pa')).toBe('pa-Guru-IN');
    expect(mobileSpeech.get('no')).toBe('nb-NO');
    expect(webSpeech.get('pa')).toBe('pa-Guru-IN');
    expect(webSpeech.get('no')).toBe('nb-NO');
  });

  // Hebrew is the one language where both APIs still want the old ISO code
  // ("iw") instead of the modern "he" this app uses internally — documented
  // in both files' own comments, pinned here so a "helpful" cleanup that
  // renames it to "he" fails instead of shipping silently broken Hebrew.
  it('keeps the legacy Hebrew code for both Google APIs', () => {
    expect(mobileSpeech.get('he')).toBe('iw-IL');
    expect(mobileTranslate.get('he')).toBe('iw');
    expect(webSpeech.get('he')).toBe('iw-IL');
    expect(webTranslate.get('he')).toBe('iw');
  });

  it('gives Simplified and Traditional Chinese their own codes rather than collapsing them', () => {
    for (const table of [mobileSpeech, webSpeech]) {
      expect(table.get('zh-Hans')).not.toBe(table.get('zh-Hant'));
    }
    for (const table of [mobileTranslate, webTranslate]) {
      expect(table.get('zh-Hans')).not.toBe(table.get('zh-Hant'));
    }
  });

  it('parsed all four tables at full size, so a green run above is not a vacuous one', () => {
    expect(OFFERED.length).toBeGreaterThan(40);
    expect(KNOWN_GAPS.length).toBeGreaterThan(0); // else the gap machinery above is untested dead code
    const speechCount = OFFERED.length - gapsFor('speech').size;
    const translateCount = OFFERED.length - gapsFor('translate').size;
    expect(mobileSpeech.size).toBe(speechCount + 1); // + the 'zh' alias
    expect(mobileTranslate.size).toBe(translateCount + 1);
    expect(webSpeech.size).toBe(speechCount);
    expect(webTranslate.size).toBe(translateCount);
  });
});
