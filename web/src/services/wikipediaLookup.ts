/**
 * Looking a name up on Wikipedia, without the app ever talking to Wikipedia.
 *
 * ## What this replaced
 *
 * Context cards used to scan the last fifteen messages of every thread you
 * opened, lift capitalised phrases out of their decrypted text, and query
 * en.wikipedia.org for each one — up to thirty requests per open, carrying
 * proper nouns out of private conversations, with the device's IP attached.
 * Making it opt-in fixed who decided, but not the shape of the thing being
 * decided: one tap on a switch bought a standing background channel, while
 * the value on offer was occasional curiosity about a single word.
 *
 * So the lookup is now an action on one message, and the app does not perform
 * it. `wikipediaSearchUrl` builds a URL and the caller hands it to the
 * browser. Wikipedia sees a visit from a browser the person opened
 * themselves, which is a thing they can already do and already understand —
 * and there is nothing left for this app to disclose, consent to, or cache.
 *
 * Everything here is pure and offline. The entity extraction is kept from the
 * old service (it is what makes the action worth offering rather than a
 * full-text search of a whole sentence) and never touched the network.
 *
 * A verbatim mirror of src/services/wikipediaLookup.ts on mobile. The web
 * client never had context cards, so it has nothing to remove — this is the
 * feature arriving, not a replacement.
 */

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'shall', 'can', 'need', 'must', 'and', 'but', 'or', 'not', 'no', 'yes', 'so',
  'if', 'then', 'than', 'that', 'this', 'what', 'when', 'where', 'who', 'how', 'why',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'only', 'own', 'same', 'too', 'very', 'just', 'about', 'above', 'after', 'again',
  'also', 'any', 'back', 'because', 'before', 'between', 'come', 'day', 'even',
  'find', 'first', 'for', 'from', 'get', 'give', 'go', 'going', 'good', 'got',
  'great', 'here', 'him', 'his', 'her', 'hers', 'into', 'its', 'know', 'last',
  'let', 'like', 'long', 'look', 'make', 'man', 'many', 'much', 'new', 'now',
  'of', 'on', 'one', 'out', 'over', 'part', 'people', 'say', 'see', 'take',
  'tell', 'there', 'these', 'thing', 'think', 'time', 'to', 'two', 'up', 'use',
  'want', 'way', 'well', 'with', 'work', 'year', 'ok', 'okay', 'yeah', 'yep',
  'nah', 'nope', 'lol', 'haha', 'hehe', 'omg', 'wow', 'hey', 'hi', 'hello',
  'bye', 'thanks', 'thank', 'please', 'sorry', 'sure', 'right', 'left', 'still',
  'really', 'already', 'always', 'never', 'maybe', 'probably', 'gonna', 'wanna',
  'gotta', 'don\'t', 'doesn\'t', 'didn\'t', 'won\'t', 'can\'t', 'couldn\'t',
  'shouldn\'t', 'wouldn\'t', 'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t', 'haven\'t',
  'hasn\'t', 'hadn\'t', 'tonight', 'today', 'tomorrow', 'yesterday', 'morning',
  'evening', 'night', 'soon', 'later', 'at', 'in', 'by', 'down',
]);

/**
 * Extract capitalized multi-word phrases that may be named entities.
 * Returns phrases with 2-4 capitalized words (e.g. "Eiffel Tower", "Star Wars").
 */
export function extractEntities(text: string): string[] {
  if (!text || text.length < 5) return [];

  // Capitalized phrase pattern: 2-5 consecutive capitalized words
  // The `\s+` sits *outside* the optional connector group. It used to be inside
  // it, which meant a plain two-word name had no space to match on: "House of
  // Cards" worked (connector present) but "Eiffel Tower" and "Star Wars" — the
  // examples in this function's own doc comment — never matched at all.
  const phraseRegex = /\b([A-Z][a-z]+(?:\s+(?:of|the|and|in|at|de|la|le|el|di|von|van|for))?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
  const phrases: string[] = [];
  let match;
  while ((match = phraseRegex.exec(text)) !== null) {
    const phrase = match[1].trim();
    // Reject when *every* word is a stop word ("Thanks Bye Okay"), not just when
    // the joined phrase happens to be one. The list is a list of words, so
    // testing only the concatenation let ordinary sentence-initial
    // capitalisation through and sent it to Wikipedia.
    const words = phrase.toLowerCase().split(/\s+/);
    const allStopWords = words.every(w => STOP_WORDS.has(w));
    if (phrase.length >= 4 && !allStopWords && !STOP_WORDS.has(phrase.toLowerCase())) {
      phrases.push(phrase);
    }
  }

  // Four rather than two: nothing is fetched now, so a longer list costs an
  // extra row in a sheet the user is already reading, not four more requests.
  return [...new Set(phrases)].slice(0, 4);
}

/**
 * Wikipedia's subdomain for the app's current language.
 *
 * Both Chinese variants map to `zh`: Wikipedia serves one `zh` wiki and
 * converts script per reader.
 */
const WIKI_SUBDOMAIN: Record<string, string> = {
  en: 'en',
  zh: 'zh',
  // The map is kept wider than this client's two languages so that adding a
  // language here is a dictionary change and not also a bug report about
  // everyone getting the English article.
  'zh-Hans': 'zh',
  'zh-Hant': 'zh',
  es: 'es',
  fr: 'fr',
  de: 'de',
  ja: 'ja',
  ko: 'ko',
  pt: 'pt',
  ru: 'ru',
  ar: 'ar',
  hi: 'hi',
  it: 'it',
  tr: 'tr',
  vi: 'vi',
};

/**
 * The search URL for a phrase.
 *
 * A search rather than a direct article link: a phrase pulled out of a
 * sentence is a guess at a title, and Wikipedia's search resolves near-misses
 * and disambiguation the way a wrong /wiki/ URL does not.
 */
export function wikipediaSearchUrl(phrase: string, appLanguage?: string): string {
  const sub = WIKI_SUBDOMAIN[appLanguage ?? ''] ?? 'en';
  return `https://${sub}.wikipedia.org/w/index.php?search=${encodeURIComponent(phrase)}`;
}
