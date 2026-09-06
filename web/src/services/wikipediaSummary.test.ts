/**
 * The fetching half of the lookup. Every case here is one the reader sees a
 * different sentence for, so the distinctions are the point: "no such article"
 * is not "Wikipedia is unreachable", and "this word means several things" is
 * not either of them.
 *
 * `fetch` is replaced with a hand-rolled fake rather than the runner's mock, so
 * that this file is identical on both clients — one uses jest and the other
 * vitest, and their mocking APIs are not.
 */
import {fetchWikipediaSummary} from './wikipediaSummary';

type Reply = {status: number; body?: unknown} | 'network-error';

let routes: Array<[RegExp, Reply]> = [];
let requested: string[] = [];
let headers: Array<Record<string, string>> = [];
const realFetch = globalThis.fetch;

function serve(pairs: Array<[RegExp, Reply]>) {
  routes = pairs;
}

beforeEach(() => {
  routes = [];
  requested = [];
  headers = [];
  globalThis.fetch = (async (
    url: string,
    init?: {signal?: AbortSignal; headers?: Record<string, string>},
  ) => {
    requested.push(String(url));
    headers.push(init?.headers ?? {});
    if (init?.signal?.aborted) throw new Error('aborted');
    for (const [pattern, reply] of routes) {
      if (!pattern.test(String(url))) continue;
      if (reply === 'network-error') throw new TypeError('Network request failed');
      return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        json: async () => reply.body,
      };
    }
    return {ok: false, status: 404, json: async () => null};
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const ARTICLE = {
  type: 'standard',
  title: 'Eiffel Tower',
  extract: 'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris.',
  thumbnail: {source: 'https://upload.wikimedia.org/thumb.jpg'},
  content_urls: {
    desktop: {page: 'https://en.wikipedia.org/wiki/Eiffel_Tower'},
    mobile: {page: 'https://en.m.wikipedia.org/wiki/Eiffel_Tower'},
  },
};

describe('a phrase that is already a title', () => {
  it('returns the article without searching', async () => {
    serve([[/rest_v1\/page\/summary/, {status: 200, body: ARTICLE}]]);
    const found = await fetchWikipediaSummary('Eiffel Tower', 'en');

    expect(found?.title).toBe('Eiffel Tower');
    expect(found?.extract).toContain('wrought-iron');
    expect(found?.image).toBe('https://upload.wikimedia.org/thumb.jpg');
    expect(found?.ambiguous).toBe(false);
    // One round trip. The search is what a miss costs, not what every lookup does.
    expect(requested).toHaveLength(1);
  });

  it("asks the reader's own wiki", async () => {
    serve([[/rest_v1/, {status: 200, body: ARTICLE}]]);
    await fetchWikipediaSummary('埃菲尔铁塔', 'zh-Hans');
    expect(requested[0]).toContain('https://zh.wikipedia.org/');
  });

  it('falls back to English for a language with no wiki mapping', async () => {
    serve([[/rest_v1/, {status: 200, body: ARTICLE}]]);
    await fetchWikipediaSummary('Eiffel Tower', 'xx');
    expect(requested[0]).toContain('https://en.wikipedia.org/');
  });
});

/**
 * Wikimedia blocks clients that do not say who they are. React Native's
 * default `okhttp/…` and no User-Agent at all both return 403, which reaches
 * the screen as "couldn't reach Wikipedia" and looks like a network problem
 * rather than a missing header — so this is pinned rather than left to be
 * rediscovered from a bug report.
 */
describe('identifying itself', () => {
  it('sends a User-Agent naming the app and a way to make contact', async () => {
    serve([[/rest_v1/, {status: 200, body: ARTICLE}]]);
    await fetchWikipediaSummary('Eiffel Tower', 'en');

    const ua = headers[0]['User-Agent'];
    expect(ua).toContain('Chatterbox');
    expect(ua).toMatch(/@|https?:/);
  });
});

describe('a phrase that names several things', () => {
  // Reported, not resolved. The reader picked the phrase; picking the sense
  // for them would stack a second guess on the first.
  it('says so instead of choosing one', async () => {
    serve([
      [
        /rest_v1/,
        {
          status: 200,
          body: {
            type: 'disambiguation',
            title: 'Mercury',
            extract: 'Mercury most commonly refers to:',
            content_urls: {desktop: {page: 'https://en.wikipedia.org/wiki/Mercury'}},
          },
        },
      ],
    ]);
    const found = await fetchWikipediaSummary('Mercury', 'en');

    expect(found?.ambiguous).toBe(true);
    expect(found?.title).toBe('Mercury');
    // The extract of a disambiguation page is a list header, not a description.
    expect(found?.extract).toBe('');
  });
});

/**
 * There is no search fallback, and that is a finding rather than an omission.
 * Measured against the live API, Wikipedia's redirects resolve the names people
 * look up in one hop; the fallback fired almost only on the extractor's
 * mistakes, and it answered them confidently — `Meeting Dana Weiss` came back
 * as a card about an American politician. A wrong card looks like an answer.
 */
describe('a phrase with no article', () => {
  it('reports nothing rather than searching for something close', async () => {
    serve([[/rest_v1/, {status: 404}]]);
    expect(await fetchWikipediaSummary('Meeting Dana Weiss', 'en')).toBeNull();
    // The second request is the one that used to invent an answer.
    expect(requested).toHaveLength(1);
  });

  it('never calls the search API', async () => {
    serve([[/rest_v1/, {status: 404}]]);
    await fetchWikipediaSummary('Tomorrow Works', 'en');
    expect(requested.some(u => u.includes('list=search'))).toBe(false);
  });
});

describe('nothing worth showing', () => {
  it('rejects an article with no extract', async () => {
    serve([[/rest_v1/, {status: 200, body: {...ARTICLE, extract: '   '}}]]);
    expect(await fetchWikipediaSummary('Eiffel Tower', 'en')).toBeNull();
  });

  it('rejects an article with no link to open', async () => {
    serve([[/rest_v1/, {status: 200, body: {...ARTICLE, content_urls: {}}}]]);
    expect(await fetchWikipediaSummary('Eiffel Tower', 'en')).toBeNull();
  });

  it('returns null for an empty phrase without asking anyone', async () => {
    expect(await fetchWikipediaSummary('   ', 'en')).toBeNull();
    expect(requested).toHaveLength(0);
  });
});

/**
 * The difference that matters most on screen. Telling someone their word does
 * not exist because their wifi is off is a lie, so an unreachable Wikipedia
 * has to throw rather than come back empty.
 */
describe('unreachable', () => {
  it('throws when the request fails', async () => {
    serve([[/rest_v1/, 'network-error']]);
    await expect(fetchWikipediaSummary('Eiffel Tower', 'en')).rejects.toThrow();
  });

  it.each([[503], [429]])(
    'throws on status %i rather than reporting no article',
    async status => {
      serve([[/rest_v1/, {status}]]);
      await expect(fetchWikipediaSummary('Eiffel Tower', 'en')).rejects.toThrow();
    },
  );

  // A reader who closed the card is not waiting for it. An already-aborted
  // signal never fires its event, so subscribing alone would miss this.
  it('does not run when the caller has already cancelled', async () => {
    serve([[/rest_v1/, {status: 200, body: ARTICLE}]]);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(fetchWikipediaSummary('Eiffel Tower', 'en', ctrl.signal)).rejects.toThrow();
  });
});

// Nothing is kept: what you looked up is not a thing this app should still
// know about after you close the card.
describe('no cache', () => {
  it('asks again the second time', async () => {
    serve([[/rest_v1/, {status: 200, body: ARTICLE}]]);
    await fetchWikipediaSummary('Eiffel Tower', 'en');
    await fetchWikipediaSummary('Eiffel Tower', 'en');
    expect(requested).toHaveLength(2);
  });
});
