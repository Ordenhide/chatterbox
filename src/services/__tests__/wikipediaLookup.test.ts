import {extractEntities, wikipediaSearchUrl} from '../wikipediaLookup';

/**
 * The extraction cases are inherited from the context-card service this
 * replaced: the regex previously required a connector word between the two
 * capitalised words ("House of Cards" matched, "Eiffel Tower" did not),
 * because the space separating them sat inside the optional connector group.
 * That silently disabled the feature for ordinary two-word names.
 *
 * What is new is the absence of a network assertion. There is nothing to
 * assert: this module has no fetch in it, which is the point of the change.
 */
describe('extractEntities', () => {
  it('finds a plain two-word name', () => {
    expect(extractEntities('Have you seen the Eiffel Tower at night?')).toContain('Eiffel Tower');
  });

  it('finds a name containing a connector word', () => {
    expect(extractEntities('I watched House of Cards last night')).toContain('House of Cards');
  });

  it('finds nothing in a message with no names', () => {
    expect(extractEntities('see you tonight')).toEqual([]);
  });

  // The stop-word list is a list of *words*; testing only the joined phrase
  // let ordinary sentence-initial capitalisation through.
  it('ignores a run of capitalised stop words', () => {
    expect(extractEntities('Thanks Bye Okay')).toEqual([]);
  });

  it('offers at most four candidates', () => {
    const many = 'Tel Aviv and Dana Weiss and House of Cards and Eiffel Tower and Star Wars';
    expect(extractEntities(many).length).toBeLessThanOrEqual(4);
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
