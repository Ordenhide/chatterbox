/**
 * The Simplified Chinese strings, checked for the things review misses.
 *
 * Two problems that had accumulated, neither of which any existing test could
 * see — every other i18n test asks whether a key *exists*, not what is in it:
 *
 * 1. **Mixed punctuation.** Twenty-five strings used half-width `,` `:` `?`
 *    between Chinese characters while thirty-two used the full-width forms the
 *    language actually takes. To a Chinese reader that is the visual signature
 *    of machine translation, on an app whose entire pitch is that someone was
 *    careful.
 * 2. **Dashes.** Half the strings wrote ` —— ` with spaces, carried over from
 *    the English em dash; Chinese typography sets 破折号 tight.
 *
 * Both were fixed mechanically, and both would come back the moment someone
 * adds a string by hand — which is why this exists rather than a note in a
 * style guide.
 */
import zh from '../locales/zh-Hans.json';

const CJK = '一-鿿';

function flatten(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, path ? `${path}.${k}` : k),
  );
}

const strings = flatten(zh);

describe('Simplified Chinese typography', () => {
  it('found the strings, so a passing run means something', () => {
    expect(strings.length).toBeGreaterThan(400);
  });

  it('uses full-width punctuation between Chinese characters', () => {
    // Half-width beside Latin text is correct and left alone — only the
    // characters wedged between two Chinese ones are wrong.
    const offenders = strings
      .filter(([, v]) => new RegExp(`[${CJK}][,;!?]|[,;!?][${CJK}]`).test(v))
      .map(([k, v]) => `${k}: ${v.slice(0, 40)}`);
    expect(offenders).toEqual([]);
  });

  it('uses a full-width colon after Chinese, except in URLs', () => {
    const offenders = strings
      .filter(([, v]) => new RegExp(`[${CJK}]:(?!//)`).test(v))
      .map(([k, v]) => `${k}: ${v.slice(0, 40)}`);
    expect(offenders).toEqual([]);
  });

  it('sets the dash tight, as Chinese typography does', () => {
    const offenders = strings
      .filter(([, v]) => / —— | — /.test(v))
      .map(([k, v]) => `${k}: ${v.slice(0, 40)}`);
    expect(offenders).toEqual([]);
  });

  it('leaves no space inside full-width brackets', () => {
    const offenders = strings
      .filter(([, v]) => /（ | ）| （|） /.test(v))
      .map(([k, v]) => `${k}: ${v.slice(0, 40)}`);
    expect(offenders).toEqual([]);
  });
});

/**
 * Features are removed from the code long before every string that mentions
 * them is found. Moments took three separate passes: the mobile locales, then
 * the tutorial and the account-deletion copy, then the web dictionary — which
 * still had a tour step pointing at `nav-moments`, an element that no longer
 * exists.
 */
describe('strings do not describe features that were removed', () => {
  const gone = ['moments', '朋友圈', '动态'];

  it.each(gone)('no string mentions %s', word => {
    const offenders = strings
      .filter(([, v]) => v.toLowerCase().includes(word.toLowerCase()))
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it('the English locale is clean too', () => {
    // The Chinese was fixed first once, and the English kept the word for
    // another day.
    const en = flatten(require('../locales/en.json'));
    const offenders = en
      .filter(([, v]) => /\bmoments\b/i.test(v))
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });
});
