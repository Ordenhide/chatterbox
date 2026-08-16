import {getContextCards} from '../contextCards';

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

describe('getContextCards entity extraction', () => {
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
