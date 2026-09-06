import {ContextCard} from '../types';
import {hasContextCardConsent} from './contextCardConsent';

const WIKI_API = 'https://en.wikipedia.org/api/rest_v1';
const CACHE_MAX = 100;
const cache = new Map<string, ContextCard | null>();

function cacheSet(key: string, val: ContextCard | null) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, val);
}

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
function extractEntities(text: string): string[] {
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

  return [...new Set(phrases)].slice(0, 2);
}

function classifyEntity(summary: string): ContextCard['type'] {
  const lower = summary.toLowerCase();
  if (/\b(city|town|village|country|region|state|province|island|mountain|river|lake|ocean|continent|neighborhood|district|located|geography)\b/.test(lower)) return 'place';
  if (/\b(film|movie|television|tv series|directed|starring|released|box office|season|episode|animated|drama|comedy|thriller)\b/.test(lower)) return 'film';
  if (/\b(born|politician|actor|actress|singer|musician|author|writer|scientist|athlete|president|minister|player|coach|ceo|founder)\b/.test(lower)) return 'person';
  return 'topic';
}

async function fetchWikipedia(entity: string): Promise<ContextCard | null> {
  const cacheKey = entity.toLowerCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey) || null;

  try {
    const searchUrl = `${WIKI_API}/page/summary/${encodeURIComponent(entity)}`;
    const resp = await fetch(searchUrl, {
      headers: {Accept: 'application/json', 'User-Agent': 'Chatterbox/1.0'},
    });

    if (resp.status === 404) {
      const searchResp = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(entity)}&limit=1&format=json`,
      );
      const searchData = await searchResp.json();
      const topResult = searchData?.[1]?.[0];
      if (!topResult) {
        cacheSet(cacheKey, null);
        return null;
      }
      const retryResp = await fetch(`${WIKI_API}/page/summary/${encodeURIComponent(topResult)}`);
      if (!retryResp.ok) {
        cacheSet(cacheKey, null);
        return null;
      }
      const data = await retryResp.json();
      return buildCard(entity, data, cacheKey);
    }

    if (!resp.ok) {
      cacheSet(cacheKey, null);
      return null;
    }

    const data = await resp.json();
    return buildCard(entity, data, cacheKey);
  } catch {
    cacheSet(cacheKey, null);
    return null;
  }
}

function buildCard(entity: string, data: any, cacheKey: string): ContextCard | null {
  if (data.type === 'disambiguation' || data.type === 'no-extract') {
    cacheSet(cacheKey, null);
    return null;
  }

  const description = data.extract || '';
  if (description.length < 20) {
    cacheSet(cacheKey, null);
    return null;
  }

  const card: ContextCard = {
    id: `ctx_${cacheKey.replace(/\s+/g, '_')}`,
    entity,
    type: classifyEntity(description),
    title: data.title || entity,
    description: description.length > 200 ? description.slice(0, 200).replace(/\s\S*$/, '') + '...' : description,
    image: data.thumbnail?.source || data.originalimage?.source,
    url: data.content_urls?.mobile?.page || data.content_urls?.desktop?.page,
  };

  cacheSet(cacheKey, card);
  return card;
}

/**
 * Analyze a message text and return context cards for any recognized entities.
 * Only processes messages longer than 10 chars with capitalized words.
 *
 * The consent check is the first thing that happens, before the text is even
 * scanned for names. It lives here rather than at the call site because the
 * call site is a `useEffect` that fires on every thread it renders: whoever
 * adds the second one will not remember to ask, and the cost of forgetting is
 * a private conversation's proper nouns arriving at a third party.
 *
 * Returns an empty list rather than throwing. There is no user action to
 * attach a prompt to — the trigger is "a thread is open" — so the disclosure
 * belongs beside the switch in Profile, and this path simply does nothing
 * until that switch is on.
 */
export async function getContextCards(text: string): Promise<ContextCard[]> {
  if (!(await hasContextCardConsent())) return [];
  if (!text || text.length < 5) return [];

  const entities = extractEntities(text);
  if (entities.length === 0) return [];

  const results = await Promise.all(entities.map(fetchWikipedia));
  return results.filter((c): c is ContextCard => c !== null);
}
