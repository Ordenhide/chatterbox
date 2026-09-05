import fs from 'fs';
import path from 'path';
import {LANGUAGES} from '../languages';

/**
 * Offering a language in the picker is a claim that the app speaks it.
 *
 * i18next falls back to English for a missing key, so an incomplete
 * translation never *breaks* — which is exactly why it can rot unnoticed.
 * Thirteen locales sat at 53.6% for long enough that the gap covered the
 * sign-in screen, most of Profile, and the line telling a user their message
 * is going out unencrypted, and nothing failed.
 *
 * So the bar is enforced here rather than remembered. Finishing a translation
 * lets its language back into LANGUAGES; letting an offered one rot fails.
 */
const OFFERED_MIN_COMPLETENESS = 0.9;

const LOCALES = path.join(__dirname, '..', 'locales');

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const read = (code: string) =>
  flatten(JSON.parse(fs.readFileSync(path.join(LOCALES, `${code}.json`), 'utf8')));

const en = read('en');

describe('offered languages', () => {
  it('all have a locale file', () => {
    for (const {code} of LANGUAGES) {
      expect(fs.existsSync(path.join(LOCALES, `${code}.json`))).toBe(true);
    }
  });

  it.each(LANGUAGES.map(l => [l.code, l.nativeLabel]))(
    '%s (%s) is complete enough to offer',
    code => {
      const keys = read(code);
      const present = Object.keys(en).filter(k => k in keys).length;
      const ratio = present / Object.keys(en).length;
      // Named in the message so a failure says which language and by how much,
      // rather than just that a number was too small.
      expect({
        code,
        completeness: `${(ratio * 100).toFixed(1)}%`,
        missing: Object.keys(en).filter(k => !(k in keys)).length,
      }).toEqual({
        code,
        completeness: expect.stringMatching(/./),
        missing: expect.any(Number),
      });
      expect(ratio).toBeGreaterThanOrEqual(OFFERED_MIN_COMPLETENESS);
    },
  );

  it('offers English, which is the fallback everything else leans on', () => {
    expect(LANGUAGES.map(l => l.code)).toContain('en');
  });

  it('has no duplicate entries', () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('locale files that are shipped but not offered', () => {
  /**
   * They stay loaded: a device already set to one keeps working, and a
   * finished translation only needs a line in LANGUAGES rather than a file
   * restored from history. This pins that they are still parseable, so they
   * do not quietly decay while out of the picker.
   */
  it('are still valid JSON with a non-trivial number of keys', () => {
    const offered = new Set<string>(LANGUAGES.map(l => l.code));
    const files = fs
      .readdirSync(LOCALES)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .filter(code => !offered.has(code));

    expect(files.length).toBeGreaterThan(0);
    for (const code of files) {
      expect(Object.keys(read(code)).length).toBeGreaterThan(100);
    }
  });
});

describe('interpolation placeholders', () => {
  /**
   * A translated string that drops `{{count}}` renders the literal sentence
   * with a hole in it, and i18next says nothing — the key is present, so the
   * completeness check above passes. This is the other half of "the language
   * is finished": every offered translation has to carry the same slots the
   * English does, or a member count, a date or a phone number goes missing in
   * exactly one language.
   */
  const slots = (s: unknown) =>
    typeof s === 'string' ? [...new Set(s.match(/\{\{[^}]+\}\}/g) ?? [])].sort() : [];

  it.each(LANGUAGES.filter(l => l.code !== 'en').map(l => [l.code, l.nativeLabel]))(
    '%s (%s) keeps every slot the English string has',
    code => {
      const keys = read(code);
      const wrong = Object.keys(en)
        .filter(k => k in keys)
        .map(k => ({key: k, en: slots(en[k]), translated: slots(keys[k])}))
        .filter(r => r.en.join() !== r.translated.join());
      expect(wrong).toEqual([]);
    },
  );
});
