/**
 * The extraction is what decides whether the "Look up on Wikipedia" action
 * appears at all, so these tests are mostly about coverage: which of the
 * fifteen app languages can produce a candidate.
 *
 * That matters because the first version could not produce one for seven of
 * them. It was `[A-Z][a-z]+`, twice: ASCII-only, so Chinese, Japanese, Korean,
 * Russian, Arabic and Hindi never matched, and every accented Latin language
 * was truncated at its first diacritic — `Le Café de Flore` offered a search
 * for `Le Caf`. Nothing failed; the menu row simply never appeared, which is
 * the kind of bug a test suite has to be asked to look for.
 */
import {extractEntities, wikipediaSearchUrl} from './wikipediaLookup';

describe('scripts without ASCII capitals', () => {
  // Chinese marks a work with 《》, which is a stronger signal than a capital.
  it('finds a Chinese title in book-title brackets', () => {
    expect(extractEntities('我在读《三体》,刘慈欣写的')).toContain('三体');
  });

  it('finds a Latin name embedded in Chinese', () => {
    expect(extractEntities('推荐你看 Oppenheimer')).toContain('Oppenheimer');
    expect(extractEntities('我昨天看了 Star Wars')).toContain('Star Wars');
  });

  it('finds a Japanese title, and a katakana run', () => {
    expect(extractEntities('『こころ』を読んだ')).toContain('こころ');
    expect(extractEntities('スターウォーズを見た')).toContain('スターウォーズ');
  });

  it('finds a Cyrillic name', () => {
    expect(extractEntities('Вчера был Кремль закрыт')).toContain('Кремль');
  });
});

describe('accented Latin', () => {
  // Each of these returned either nothing or a truncated fragment before.
  it.each([
    ['On a mangé au Café de Flore', 'Café de Flore'],
    ['Fui a Ciudad de México', 'Ciudad de México'],
    ['Ich war am Münchner Hauptbahnhof', 'Münchner Hauptbahnhof'],
    ['Moro em São Paulo agora', 'São Paulo'],
    ['Tôi đã đến Hà Nội', 'Hà Nội'],
  ])('keeps the whole name in %s', (text, expected) => {
    expect(extractEntities(text)).toContain(expected);
  });

  // The specific old failure: the match stopped dead at `é`.
  it('never offers a fragment cut at a diacritic', () => {
    expect(extractEntities('On a mangé au Café de Flore')).not.toContain('Le Caf');
  });
});

describe('single capitalised words', () => {
  // The two-word minimum ruled out most of what people actually look up.
  it('offers a lone name in mid-sentence', () => {
    expect(extractEntities('I watched Oppenheimer last night')).toContain('Oppenheimer');
    expect(extractEntities('We use Kubernetes at work')).toContain('Kubernetes');
  });

  // Where the capital is grammar rather than a name. This is the whole reason
  // a lone word is judged on position instead of being taken at face value.
  it('ignores one that only opens a sentence', () => {
    expect(extractEntities('Tomorrow works for me')).toEqual([]);
    expect(extractEntities('Sure. Fine by me')).toEqual([]);
  });

  // A name is missed when it opens the message, and that is the deliberate
  // side of the trade: at the start of a text there is nothing to tell a name
  // apart from an ordinary capitalised first word. Pinned separately because
  // the examples above are stop words and would pass on the word list alone.
  it('misses a name that starts the message, which is the cost of the rule', () => {
    expect(extractEntities('Kubernetes is what we use')).toEqual([]);
    expect(extractEntities('Oppenheimer was good')).toEqual([]);
  });

  it('ignores capitalised calendar words', () => {
    expect(extractEntities('See you Monday Morning')).toEqual([]);
  });
});

describe('word shape', () => {
  it('keeps an internal capital together', () => {
    expect(extractEntities('I ate at McDonald yesterday')).toContain('McDonald');
    expect(extractEntities('We watched YouTube last night')).toContain('YouTube');
  });

  // Shouting is not a proper noun, and a fragment of a word is not a search.
  it('offers nothing for a line of capitals', () => {
    expect(extractEntities('HELLO THERE everyone')).toEqual([]);
  });
});

describe('phrase boundaries', () => {
  it('keeps a name that contains connecting words', () => {
    expect(extractEntities('I watched House of Cards last night')).toContain('House of Cards');
    expect(extractEntities('The Lord of the Rings')).toContain('The Lord of the Rings');
  });

  // `and` used to be a connector, so a list of names became one phrase and the
  // app offered to search Wikipedia for "Tel Aviv and Dana Weiss and House".
  it('does not chain a list of names into one phrase', () => {
    const found = extractEntities('Tel Aviv and Dana Weiss and House of Cards and Star Wars');
    expect(found).toContain('Tel Aviv');
    expect(found).toContain('Dana Weiss');
    expect(found.some(p => p.includes(' and '))).toBe(false);
  });

  it('offers at most four candidates', () => {
    const many = 'Tel Aviv and Dana Weiss and House of Cards and Eiffel Tower and Star Wars';
    expect(extractEntities(many).length).toBeLessThanOrEqual(4);
  });
});

describe('nothing worth offering', () => {
  it('finds nothing in a message with no names', () => {
    expect(extractEntities('see you tonight')).toEqual([]);
  });

  // The stop-word list is a list of *words*; testing only the joined phrase
  // let ordinary sentence-initial capitalisation through.
  it('ignores a run of capitalised stop words', () => {
    expect(extractEntities('Thanks Bye Okay')).toEqual([]);
  });

  it('handles empty and tiny input', () => {
    expect(extractEntities('')).toEqual([]);
    expect(extractEntities('ok')).toEqual([]);
  });
});

/**
 * Pinned so that they are a decision rather than an oversight. Arabic and
 * Hindi have no letter case and no bracketing convention to stand in for it;
 * Korean writes proper nouns in plain Hangul; unmarked Chinese prose gives a
 * regex nothing to hold on to. Recognising a name in any of them needs a
 * dictionary or a model, which this file is not. If that changes, this block
 * is what should fail.
 */
describe('known blind spots', () => {
  it.each([
    ['ar', 'برج إيفل جميل'],
    ['hi', 'ताज महल देखा'],
    ['ko', '서울 타워에 갔어'],
    ['zh, unmarked', '你看过埃菲尔铁塔吗'],
  ])('has no candidate for %s', (_lang, text) => {
    expect(extractEntities(text)).toEqual([]);
  });
});

describe('wikipediaSearchUrl', () => {
  it('searches rather than guessing an article path', () => {
    // A phrase pulled out of a sentence is a guess at a title; search resolves
    // near-misses and disambiguation, a wrong /wiki/ URL 404s.
    expect(wikipediaSearchUrl('Eiffel Tower', 'en')).toBe(
      'https://en.wikipedia.org/w/index.php?search=Eiffel%20Tower',
    );
  });

  it("uses the reader's own Wikipedia", () => {
    expect(wikipediaSearchUrl('Tour Eiffel', 'fr')).toContain('https://fr.wikipedia.org/');
    expect(wikipediaSearchUrl('東京', 'ja')).toContain('https://ja.wikipedia.org/');
  });

  // One zh wiki serves both scripts and converts per reader, so both app
  // languages point at it rather than one of them falling back to English.
  it('sends both Chinese variants to the zh wiki', () => {
    expect(wikipediaSearchUrl('北京', 'zh-Hans')).toContain('https://zh.wikipedia.org/');
    expect(wikipediaSearchUrl('北京', 'zh-Hant')).toContain('https://zh.wikipedia.org/');
  });

  it('falls back to English for a language with no mapping', () => {
    expect(wikipediaSearchUrl('Eiffel Tower', 'xx')).toContain('https://en.wikipedia.org/');
    expect(wikipediaSearchUrl('Eiffel Tower')).toContain('https://en.wikipedia.org/');
  });

  it('escapes a phrase that would otherwise change the query', () => {
    expect(wikipediaSearchUrl('Guns & Roses', 'en')).toContain('search=Guns%20%26%20Roses');
  });
});
