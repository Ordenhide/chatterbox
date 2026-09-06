// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockStore = new Map<string, string>();

jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async (k: string) => (mockStore.has(k) ? mockStore.get(k)! : null),
    setItem: async (k: string, v: string) => {
      mockStore.set(k, v);
    },
    removeItem: async (k: string) => {
      mockStore.delete(k);
    },
  },
}));

import {getContextCards} from '../contextCards';
import {
  __resetContextCardConsentCache,
  grantContextCardConsent,
} from '../contextCardConsent';

/**
 * Guards the entity extraction, which is shared verbatim with the web client.
 *
 * The regex previously required a connector word between the two capitalised
 * words ("House of Cards" matched, "Eiffel Tower" did not), because the space
 * separating them sat inside the optional connector group. That silently
 * disabled the feature for ordinary two-word names — the exact examples in the
 * function's own doc comment. These cases exist so it cannot regress on either
 * platform.
 */

function mockWikipedia(byTitle: Record<string, string>) {
  const fetched: string[] = [];
  (global as any).fetch = jest.fn(async (url: string) => {
    const entity = decodeURIComponent(String(url).split('/').pop() || '');
    fetched.push(entity);
    const extract = byTitle[entity];
    if (!extract) return {ok: false, status: 404, json: async () => ({})};
    return {ok: true, status: 200, json: async () => ({title: entity, extract})};
  });
  return fetched;
}

afterEach(() => {
  delete (global as any).fetch;
});

beforeEach(() => {
  mockStore.clear();
  __resetContextCardConsentCache();
});

/**
 * The lookups go to Wikipedia, with the device's IP, carrying proper nouns
 * lifted out of decrypted messages. Nothing about the trigger is deliberate —
 * it fires because a thread is open — so the guard has to hold on a code path
 * nobody is looking at. These two cases are the ones worth breaking the line
 * for: they assert on `fetch` not being called, not on the return value, since
 * an empty list is also what "no names in this text" looks like.
 */
describe('consent gate', () => {
  it('makes no request at all until consent is granted', async () => {
    const fetched = mockWikipedia({
      'Eiffel Tower': 'A wrought-iron lattice tower on the Champ de Mars in Paris, France.',
    });
    expect(await getContextCards('Have you seen the Eiffel Tower at night?')).toEqual([]);
    expect(fetched).toEqual([]);
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('checks consent before the text is even scanned for names', async () => {
    // Nothing is read from the message — not the entities, not the length —
    // before the answer is "no".
    const fetched = mockWikipedia({});
    await getContextCards('Tel Aviv and Dana Weiss and House of Cards');
    expect(fetched).toEqual([]);
  });
});

describe('getContextCards entity extraction', () => {
  beforeEach(async () => {
    await grantContextCardConsent();
  });

  it('detects a plain two-word name', async () => {
    const fetched = mockWikipedia({
      'Eiffel Tower': 'A wrought-iron lattice tower on the Champ de Mars in Paris, France.',
    });
    const cards = await getContextCards('Have you seen the Eiffel Tower at night?');
    expect(fetched).toContain('Eiffel Tower');
    expect(cards.map(c => c.title)).toContain('Eiffel Tower');
  });

  it('still detects a name containing a connector word', async () => {
    const fetched = mockWikipedia({
      'House of Cards': 'An American political drama television series released on Netflix.',
    });
    await getContextCards('I watched House of Cards last night');
    expect(fetched).toContain('House of Cards');
  });

  it('ignores text with no entities, without hitting the network', async () => {
    const fetched = mockWikipedia({});
    expect(await getContextCards('see you tonight')).toEqual([]);
    expect(fetched).toEqual([]);
  });

  // The stop-word list is a list of *words*; testing only the joined phrase let
  // ordinary sentence-initial capitalisation through to Wikipedia.
  it('ignores a run of capitalised stop words', async () => {
    const fetched = mockWikipedia({});
    await getContextCards('Thanks Bye Okay');
    expect(fetched).toEqual([]);
  });
});
