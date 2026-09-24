/**
 * One Wikipedia summary, fetched because the reader asked for it.
 *
 * ## Why this is allowed to exist
 *
 * The context cards this descends from fetched on their own initiative: every
 * thread you opened sent up to thirty requests to en.wikipedia.org carrying
 * proper nouns lifted out of decrypted messages, and — because the card
 * rendering sat behind a parity flag that has never been `true` — displayed
 * nothing in return. All of the disclosure, none of the feature.
 *
 * This runs from one tap on one name in one message. That is the whole
 * difference, and it is the reason a card can exist at all: the cost is a
 * request the reader asked for and can see the result of, rather than a
 * standing background channel they agreed to once and then forgot.
 *
 * What Wikipedia learns is the phrase and the device's IP, at the moment of
 * the tap. Nothing is cached, so closing the card leaves nothing behind, and
 * nothing is written to the message — the transcript is unchanged by looking
 * something up.
 */
import {APP_VERSION_NAME} from '../config/appVersion';
import {wikipediaSubdomain} from './wikipediaLookup';

export type WikipediaSummary = {
  /** The article's own title, which is often not the phrase that was asked for. */
  title: string;
  /** Empty when `ambiguous` — a disambiguation page's extract is a list header. */
  extract: string;
  /** The phrase names several things and this code did not pick one. */
  ambiguous: boolean;
  /** Thumbnail, if the article has one. Still passed through a URL guard by the caller. */
  image?: string;
  /** Desktop and mobile article URLs; each client opens the one that suits it. */
  url: string;
  mobileUrl?: string;
};

/**
 * Long enough for a slow network, short enough that a spinner is not the last
 * thing the reader sees. A lookup nobody is waiting on any more is a request
 * that should stop.
 */
const TIMEOUT_MS = 8000;

/**
 * Wikimedia blocks anonymous clients. React Native's default `okhttp/x.y.z`
 * and an absent User-Agent both come back 403; a descriptive one comes back
 * 200 — measured, not assumed, because the failure is a status code and not a
 * message about headers. Their User-Agent policy asks for the application, a
 * version, and a way to reach someone.
 *
 * Browsers refuse to let a page set this header and send their own instead,
 * which Wikimedia accepts, so one line serves both clients rather than being
 * wrong on one of them. The contact address is the one in the privacy policy.
 *
 * Exported because the thumbnail needs it too: upload URLs are served by the
 * same infrastructure and refuse the same clients, and React Native's <Image>
 * has its own HTTP stack that would otherwise send okhttp's default and draw
 * an empty box where the picture should be.
 */
export const WIKIPEDIA_USER_AGENT =
  `Chatterbox/${APP_VERSION_NAME} (https://chatterbox.fans; privacy@chatterbox.fans)`;

type Json = {status: number; data: any};

/**
 * Fetches JSON, or throws.
 *
 * The distinction the caller needs is "Wikipedia says no such article"
 * (a status, handled) versus "we could not reach Wikipedia" (thrown), because
 * those are different sentences on screen: one is about the word, the other is
 * about the network, and telling someone their word does not exist when the
 * wifi is off is a lie.
 */
async function getJson(url: string, signal?: AbortSignal): Promise<Json> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const relay = () => ctrl.abort();
  // A signal that is *already* aborted never fires the event, so subscribing
  // to it would silently let a cancelled lookup run to completion.
  if (signal?.aborted) ctrl.abort();
  else signal?.addEventListener('abort', relay);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: {Accept: 'application/json', 'User-Agent': WIKIPEDIA_USER_AGENT},
    });
    // A 404 has a body, but it is an error document rather than a summary.
    const data = resp.ok ? await resp.json().catch(() => null) : null;
    return {status: resp.status, data};
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', relay);
  }
}

/** Shapes a REST summary document into a card, or rejects it. */
function toSummary(data: any): WikipediaSummary | null {
  if (!data || typeof data !== 'object') return null;
  const urls = data.content_urls || {};
  const url = urls.desktop?.page || urls.mobile?.page;
  if (!data.title || !url) return null;

  // Wikipedia's own word for "this name means several things". Reported rather
  // than resolved: the reader already chose which phrase to look up, and
  // guessing a sense on top of that compounds one guess with another. Mercury
  // is a planet, a metal and a singer, and the honest card says so.
  if (data.type === 'disambiguation') {
    return {title: data.title, extract: '', ambiguous: true, url, mobileUrl: urls.mobile?.page};
  }

  const extract = typeof data.extract === 'string' ? data.extract.trim() : '';
  if (!extract) return null;
  return {
    title: data.title,
    extract,
    ambiguous: false,
    image: data.thumbnail?.source,
    url,
    mobileUrl: urls.mobile?.page,
  };
}

/**
 * The summary for a phrase, on the reader's own Wikipedia.
 *
 * Returns `null` when there is genuinely nothing to show. Throws when
 * Wikipedia could not be reached, including on timeout, rate limiting and
 * cancellation.
 *
 * Exactly one request, and deliberately no search fallback. Measured against
 * the live API, Wikipedia's own redirects already resolve the names people
 * actually look up — Oppenheimer to J. Robert Oppenheimer, 埃菲尔铁塔 to
 * 艾菲爾鐵塔, スターウォーズ to スター・ウォーズシリーズ, each in one hop;
 * thirteen of fifteen test names answered directly.
 *
 * What a search fallback caught instead was the extractor's own mistakes, and
 * it answered them confidently: `Meeting Dana Weiss` — a sentence-initial word
 * glued to a name — came back as a card about an American politician. A wrong
 * card is worse than no card, because it looks like an answer. With no article
 * the caller offers Wikipedia's search page instead, where the reader sees the
 * ranked results and picks, rather than having this code pick blind.
 */
export async function fetchWikipediaSummary(
  phrase: string,
  appLanguage?: string,
  signal?: AbortSignal,
): Promise<WikipediaSummary | null> {
  const trimmed = phrase.trim();
  if (!trimmed) return null;
  const host = `https://${wikipediaSubdomain(appLanguage)}.wikipedia.org`;

  const direct = await getJson(
    `${host}/api/rest_v1/page/summary/${encodeURIComponent(trimmed)}`,
    signal,
  );
  if (direct.status === 200) return toSummary(direct.data);
  // A 404 is the only status that means "no such article". Everything else —
  // a 5xx, or a 429 from too many lookups in a row — is this app's problem to
  // report as one, not grounds for telling someone their word does not exist.
  if (direct.status !== 404) throw new Error(`wikipedia summary failed: ${direct.status}`);
  return null;
}
