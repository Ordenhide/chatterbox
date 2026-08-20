import {afterEach, describe, expect, it, vi} from 'vitest';
import {getContextCards} from './contextCards';

/**
 * The entity extraction is the whole feature, and it is shared verbatim with
 * mobile — so these assertions are really about keeping the two clients showing
 * the same cards for the same message.
 *
 * fetch is stubbed rather than hit: the real Wikipedia API would make these
 * network-dependent and flaky, and what is worth testing is which phrases get
 * looked up at all.
 */

function stubWikipedia(byTitle: Record<string, {extract: string; title?: string}>) {
  const fetched: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const entity = decodeURIComponent(url.split('/').pop() || '');
      fetched.push(entity);
      const hit = byTitle[entity];
      if (!hit) return {ok: false, status: 404, json: async () => ({})} as unknown as Response;
      return {
        ok: true,
        status: 200,
        json: async () => ({title: hit.title ?? entity, extract: hit.extract}),
      } as unknown as Response;
    }),
  );
  return fetched;
}

afterEach(() => vi.unstubAllGlobals());

describe('getContextCards', () => {
  it('looks up a capitalised multi-word entity', async () => {
    const fetched = stubWikipedia({
      'Eiffel Tower': {extract: 'A wrought-iron lattice tower on the Champ de Mars in Paris, France.'},
    });
    const cards = await getContextCards('Have you seen the Eiffel Tower at night?');
    expect(fetched).toContain('Eiffel Tower');
    expect(cards.map(c => c.title)).toContain('Eiffel Tower');
  });

  it('returns nothing for short or entity-free text, without calling the network', async () => {
    const fetched = stubWikipedia({});
    expect(await getContextCards('ok')).toEqual([]);
    expect(await getContextCards('see you tonight')).toEqual([]);
    expect(fetched).toEqual([]);
  });

  // Without a stop-word list, ordinary sentence-initial capitalisation would
  // fire a Wikipedia lookup on almost every message.
  it('does not treat common capitalised words as entities', async () => {
    const fetched = stubWikipedia({});
    await getContextCards('Thanks Bye Okay');
    expect(fetched).toEqual([]);
  });

  it('drops results with no usable summary rather than showing an empty card', async () => {
    stubWikipedia({'Some Place': {extract: 'Too short.'}});
    expect(await getContextCards('Lets go to Some Place tomorrow')).toEqual([]);
  });

  it('survives a failed lookup instead of rejecting the whole message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    await expect(getContextCards('Meet me at Times Square')).resolves.toEqual([]);
  });

  // Distinct entity per test on purpose: the module keeps a process-wide
  // lookup cache, so reusing a name another test already resolved (or failed
  // to) would silently assert against that cached result instead of this stub.
  it('truncates a long summary on a word boundary', async () => {
    stubWikipedia({
      'Golden Gate': {extract: 'x'.repeat(150) + ' ' + 'y'.repeat(150)},
    });
    const [card] = await getContextCards('We drove over Golden Gate today');
    expect(card.description.endsWith('...')).toBe(true);
    expect(card.description.length).toBeLessThanOrEqual(204);
  });
});
