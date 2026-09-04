// snapshotGuard (pulled in by the module under test) reports to telemetry,
// which loads RNFB's native modules — unavailable under Jest. Mocked here the
// same way account/e2eeKeys/firebaseChat tests already do.
jest.mock('../telemetry', () => ({reportError: jest.fn()}));

// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockState: {
  chatIds: string[];
  batches: {sets: {path: string; data: Record<string, unknown>}[]; committed: boolean}[];
  setDocCalls: {path: string; data: Record<string, unknown>}[];
} = {chatIds: [], batches: [], setDocCalls: []};

jest.mock('../firebase/firestore', () => ({
  collection: (..._args: unknown[]) => ({}),
  doc: (_parent: unknown, id: string) => ({path: id}),
  getDocs: jest.fn(async () => ({docs: mockState.chatIds.map(id => ({id}))})),
  getFirestore: () => ({}),
  onSnapshot: (_ref: unknown, next: (s: unknown) => void) => {
    next({data: () => ({storeThemeId: 'midnight'})});
    return () => {};
  },
  query: (ref: unknown, ..._clauses: unknown[]) => ref,
  setDoc: jest.fn(async (ref: {path: string}, data: Record<string, unknown>) => {
    mockState.setDocCalls.push({path: ref.path, data});
  }),
  where: () => ({}),
  writeBatch: () => {
    const entry = {sets: [] as {path: string; data: Record<string, unknown>}[], committed: false};
    mockState.batches.push(entry);
    return {
      set: (ref: {path: string}, data: Record<string, unknown>) => entry.sets.push({path: ref.path, data}),
      commit: async () => {
        entry.committed = true;
      },
    };
  },
}));

import {
  applyStoreTheme,
  chunk,
  listenStoreTheme,
  MAX_WRITES_PER_BATCH,
  resolveAccent,
  storeThemeFromProfile,
} from '../storeTheme';
import {THEME_CATALOG, themeById} from '../themeCatalog';

const MIDNIGHT = themeById('midnight')!;
const CLASSIC = themeById('classic')!;

beforeEach(() => {
  mockState.chatIds = [];
  mockState.batches = [];
  mockState.setDocCalls = [];
});

describe('chunk', () => {
  it('splits into groups no larger than the batch cap', () => {
    const ids = Array.from({length: 950}, (_, i) => `c${i}`);
    const groups = chunk(ids);
    expect(groups).toHaveLength(3);
    expect(groups.every(g => g.length <= MAX_WRITES_PER_BATCH)).toBe(true);
    expect(groups.flat()).toEqual(ids);
  });

  it('returns nothing for an empty list rather than one empty batch', () => {
    expect(chunk([])).toEqual([]);
  });

  it('never loses items to a nonsense size', () => {
    expect(chunk(['a', 'b'], 0).flat()).toEqual(['a', 'b']);
  });
});

describe('resolveAccent', () => {
  it("prefers the chat's own accent", () => {
    expect(resolveAccent('#111111', '#222222', '#333333')).toBe('#111111');
  });

  it('falls back to the account-wide store theme when the chat has none', () => {
    expect(resolveAccent(undefined, '#222222', '#333333')).toBe('#222222');
  });

  it('falls back to the app default when neither is set', () => {
    expect(resolveAccent(undefined, undefined, '#333333')).toBe('#333333');
  });

  it('treats an empty string as unset', () => {
    expect(resolveAccent('', '#222222', '#333333')).toBe('#222222');
  });
});

describe('storeThemeFromProfile', () => {
  it('resolves a stored id to its catalog entry', () => {
    expect(storeThemeFromProfile('midnight')?.name).toBe('Midnight');
  });

  it('ignores ids that are not in the catalog', () => {
    expect(storeThemeFromProfile('deleted-theme')).toBeUndefined();
  });

  it('ignores non-string values without throwing', () => {
    expect(storeThemeFromProfile(undefined)).toBeUndefined();
    expect(storeThemeFromProfile(42)).toBeUndefined();
    expect(storeThemeFromProfile({id: 'midnight'})).toBeUndefined();
  });
});

describe('applyStoreTheme', () => {
  it('records the account default before touching any chat', async () => {
    mockState.chatIds = ['a', 'b'];
    await applyStoreTheme('uid1', MIDNIGHT);
    expect(mockState.setDocCalls).toEqual([{path: 'uid1', data: {storeThemeId: 'midnight'}}]);
  });

  it('overwrites the accent in every chat the user is in', async () => {
    mockState.chatIds = ['a', 'b', 'c'];
    const count = await applyStoreTheme('uid1', MIDNIGHT);

    expect(count).toBe(3);
    const sets = mockState.batches.flatMap(b => b.sets);
    expect(sets.map(s => s.path)).toEqual(['a', 'b', 'c']);
    expect(sets[0].data).toEqual({themeBy: {uid1: MIDNIGHT.accent}});
  });

  it('writes only the acting user key, never another participant', async () => {
    mockState.chatIds = ['a'];
    await applyStoreTheme('uid1', MIDNIGHT);
    const {themeBy} = mockState.batches[0].sets[0].data as {
      themeBy: Record<string, string>;
    };
    expect(Object.keys(themeBy)).toEqual(['uid1']);
  });

  // Applying a theme must never touch the chat's background. It used to
  // write wallpaperBy alongside the accent, which is how a purchased theme
  // could repaint the ground the whole conversation is read against.
  it('writes the accent and nothing else', async () => {
    mockState.chatIds = ['a'];
    await applyStoreTheme('uid1', CLASSIC);
    const data = mockState.batches[0].sets[0].data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(['themeBy']);
    expect(data).toEqual({themeBy: {uid1: CLASSIC.accent}});
  });

  it('commits every batch when the chat count spans several', async () => {
    mockState.chatIds = Array.from({length: 401}, (_, i) => `c${i}`);
    const count = await applyStoreTheme('uid1', MIDNIGHT);
    expect(count).toBe(401);
    expect(mockState.batches).toHaveLength(2);
    expect(mockState.batches.every(b => b.committed)).toBe(true);
  });

  it('still records the default when the user has no chats yet', async () => {
    mockState.chatIds = [];
    const count = await applyStoreTheme('uid1', MIDNIGHT);
    expect(count).toBe(0);
    expect(mockState.batches).toHaveLength(0);
    expect(mockState.setDocCalls).toHaveLength(1);
  });
});

describe('listenStoreTheme', () => {
  it('hands back the catalog entry for the stored id', () => {
    const seen: unknown[] = [];
    listenStoreTheme('uid1', theme => seen.push(theme));
    expect(seen).toEqual([themeById('midnight')]);
  });
});

describe('catalog integrity', () => {
  it('has unique ids', () => {
    const ids = THEME_CATALOG.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique accents, so activeThemeId can never be ambiguous', () => {
    const accents = THEME_CATALOG.map(t => t.accent.toLowerCase());
    expect(new Set(accents).size).toBe(accents.length);
  });

  it('keeps the catalog id list stable and complete', () => {
    expect(THEME_CATALOG.map(t => t.id)).toEqual([
      'classic',
      'sky',
      'forest',
      'amber',
      'rose',
      'slate',
      'midnight',
      'sunset',
      'matcha',
      'lavender',
      'ember',
      'arctic',
    ]);
  });
});
