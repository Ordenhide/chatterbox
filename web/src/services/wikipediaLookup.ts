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
 * Everything here is pure and offline. The extraction never touched the
 * network and still does not.
 *
 * ## Which languages this actually works in
 *
 * The extraction inherited from the old service was `[A-Z][a-z]+` twice over:
 * ASCII, and a two-word minimum. In a fifteen-language app that meant the
 * action never once appeared for a Chinese, Japanese, Korean, Russian, Arabic
 * or Hindi message — seven of the fifteen, silently — and in the Latin
 * languages it stopped at the first diacritic, so `Le Café de Flore` offered
 * to search for `Le Caf`. It also demanded two capitalised words in a row,
 * which is not how `Oppenheimer` or `Kubernetes` are written.
 *
 * Three signals replace it, in falling order of precision:
 *
 *   1. Bracketed titles — 《…》〈…〉『…』. In Chinese and Japanese these mark a
 *      work by name, which is about as unambiguous as a proper noun gets.
 *   2. Capitalised runs, Unicode-aware: `\p{Lu}` and `\p{Ll}` rather than
 *      A-Z, so Cyrillic, Greek and every accented Latin language work. A
 *      lone capitalised word counts only mid-sentence, where the capital is
 *      a name rather than grammar — which is also what makes a Latin word
 *      embedded in Chinese ("推荐你看 Oppenheimer") register.
 *   3. Katakana runs of four or more. Japanese writes foreign names and
 *      titles in katakana; it also writes コーヒー that way, so this is the
 *      loosest of the three and sits last.
 *
 * Arabic and Hindi still get nothing: neither script has case, and neither
 * has a bracketing convention to stand in for it. Recognising a name in them
 * needs a dictionary or a model, and this file is neither.
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
  // Calendar words are capitalised mid-sentence in English and are never what
  // anyone wanted an encyclopaedia article about: "see you Monday Morning"
  // used to offer a lookup.
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
]);

/**
 * A run of capitalised words, in any script that has capitals.
 *
 * `\p{Lu}`/`\p{Ll}` rather than `A-Z`/`a-z`: that one change is what makes
 * München, São Paulo, Hà Nội, İstanbul, México and Кремль visible at all.
 * `\p{M}` is in the word body for the scripts that write a diacritic as a
 * separate combining mark rather than a precomposed character — without it a
 * Vietnamese name is cut at its first tone mark.
 *
 * The lookarounds mean a match cannot start or end inside a word, so the
 * capital in `McDonald` yields nothing rather than the fragment `Mc`.
 *
 * An internal capital is allowed only when lowercase follows it, so McDonald
 * and YouTube are one word each while a line of SHOUTED CAPITALS is not a
 * name.
 *
 * `and`, `in`, `at` and `for` are deliberately not connectors. They were,
 * and because the pattern repeats they chained list items into one phrase:
 * a message naming five films offered to search for `Tel Aviv and Dana
 * Weiss and House`. `of` and the romance particles stay, since `House of
 * Cards` and `Café de Flore` are single names.
 *
 * The `{0,4}` tail makes the second word optional: a single capitalised word
 * is a candidate here and is filtered on position below, rather than being
 * unrepresentable as it was before.
 */
const CAPPED_RUN =
  /(?<![\p{L}\p{M}])\p{Lu}[\p{Ll}\p{M}'’]+(?:\p{Lu}[\p{Ll}\p{M}]+)*(?:(?:\s+(?:of|the|de|del|la|le|les|el|di|da|do|von|van|der|du|des)){0,2}\s+\p{Lu}[\p{Ll}\p{M}'’]+(?:\p{Lu}[\p{Ll}\p{M}]+)*){0,4}(?![\p{L}\p{M}])/gu;

/** 《…》〈…〉『…』 — a work named as a work. */
const BRACKETED_TITLE = /[《〈『]([^》〉』\n]{1,30})[》〉』]/gu;

/** Katakana, where Japanese puts foreign names and titles. */
const KATAKANA_RUN = /[ァ-ヿ]{4,}/gu;

/**
 * Whether the capital at `index` is the start of a sentence, where a capital
 * is grammar rather than a name.
 *
 * This is what separates "I watched Oppenheimer last night" from "Tomorrow
 * works for me". It is also, usefully, why a Latin word sitting in Chinese
 * text registers: the character before it is 看, not a full stop.
 */
function isSentenceInitial(text: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (i < 0) return true;
  return /[.!?;:…\n]/.test(text[i]);
}

/** Neither every word a stop word, nor long enough to be worth a menu row. */
function isWorthOffering(phrase: string): boolean {
  if (phrase.length < 4) return false;
  const words = phrase.toLowerCase().split(/\s+/);
  return !words.every(w => STOP_WORDS.has(w));
}

/**
 * Names in a message that are worth offering a Wikipedia search for.
 *
 * Ordered by how much the signal can be trusted rather than by position, so
 * that when the sheet shows four the likeliest is first.
 */
export function extractEntities(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];

  for (const m of text.matchAll(BRACKETED_TITLE)) {
    const inner = m[1].trim();
    if (inner) found.push(inner);
  }

  for (const m of text.matchAll(CAPPED_RUN)) {
    const phrase = m[0].trim();
    if (!isWorthOffering(phrase)) continue;
    // A single capital opening a sentence is grammar. Two in a row is not, so
    // the position test applies only to the one-word case.
    const oneWord = !/\s/.test(phrase);
    if (oneWord && isSentenceInitial(text, m.index ?? 0)) continue;
    found.push(phrase);
  }

  for (const m of text.matchAll(KATAKANA_RUN)) found.push(m[0]);

  // Four rather than two: nothing is fetched now, so a longer list costs an
  // extra row in a sheet the user is already reading, not four more requests.
  return [...new Set(found)].slice(0, 4);
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
  fa: 'fa',
  he: 'he',
  ur: 'ur',
  pl: 'pl',
  uk: 'uk',
  id: 'id',
  bn: 'bn',
  th: 'th',
  fil: 'tl', // Filipino Wikipedia is hosted as the Tagalog wiki.
  ms: 'ms',
  my: 'my',
  km: 'km',
  lo: 'lo',
  ta: 'ta',
  te: 'te',
  mr: 'mr',
  pa: 'pa',
  ne: 'ne',
  si: 'si',
  sw: 'sw',
  ha: 'ha',
  am: 'am',
  nl: 'nl',
  el: 'el',
  sv: 'sv',
  da: 'da',
  no: 'no',
  cs: 'cs',
  ro: 'ro',
  hu: 'hu',
  kk: 'kk',
  uz: 'uz',
  ka: 'ka',
  hy: 'hy',
  bo: 'bo',
  be: 'be',
  ti: 'ti',
  mn: 'mn',
};

/**
 * The wiki this reader's language belongs to. Exported so that the summary
 * fetcher cannot drift from the search link: both have to name the same wiki
 * or the card and the "open on Wikipedia" button below it disagree.
 */
export function wikipediaSubdomain(appLanguage?: string): string {
  return WIKI_SUBDOMAIN[appLanguage ?? ''] ?? 'en';
}

/**
 * The search URL for a phrase.
 *
 * A search rather than a direct article link: a phrase pulled out of a
 * sentence is a guess at a title, and Wikipedia's search resolves near-misses
 * and disambiguation the way a wrong /wiki/ URL does not.
 */
export function wikipediaSearchUrl(phrase: string, appLanguage?: string): string {
  const sub = wikipediaSubdomain(appLanguage);
  return `https://${sub}.wikipedia.org/w/index.php?search=${encodeURIComponent(phrase)}`;
}
