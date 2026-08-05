import {beforeEach, describe, expect, it, vi} from 'vitest';

const mockState = vi.hoisted(() => ({
  chatIds: [] as string[],
  batches: [] as {sets: {path: string; data: Record<string, unknown>}[]; committed: boolean}[],
  setDocCalls: [] as {path: string; data: Record<string, unknown>}[],
}));

vi.mock('firebase/firestore', () => ({
  collection: (..._a: unknown[]) => ({}),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDocs: vi.fn(async () => ({docs: mockState.chatIds.map(id => ({id}))})),
  onSnapshot: (_ref: unknown, next: (s: unknown) => void) => {
    next({data: () => ({storeThemeId: 'midnight'})});
    return () => {};
  },
  query: (ref: unknown, ..._c: unknown[]) => ref,
  setDoc: vi.fn(async (ref: {path: string}, data: Record<string, unknown>) => {
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
vi.mock('../firebase', () => ({db: {}}));

import {
  applyStoreTheme,
  chunk,
  listenStoreTheme,
  MAX_WRITES_PER_BATCH,
  resolveAccent,
  resolveWallpaper,
  storeThemeFromProfile,
} from './storeTheme';
import {isDarkWallpaper, THEME_CATALOG, themeById} from './themeCatalog';

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

describe('resolveWallpaper', () => {
  // The distinction that matters: null is a deliberate "no wallpaper", so it
  // must win over the account theme rather than being read as "unset".
  it('keeps an explicit null instead of falling back', () => {
    expect(resolveWallpaper(null, '#0F172A')).toBeNull();
  });

  it('falls back only when the chat value is undefined', () => {
    expect(resolveWallpaper(undefined, '#0F172A')).toBe('#0F172A');
  });

  it("prefers the chat's own wallpaper", () => {
    expect(resolveWallpaper('#ABCDEF', '#0F172A')).toBe('#ABCDEF');
  });

  it('returns null when nothing is set anywhere', () => {
    expect(resolveWallpaper(undefined, undefined)).toBeNull();
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
    expect(mockState.setDocCalls).toEqual([
      {path: 'users/uid1', data: {storeThemeId: 'midnight'}},
    ]);
  });

  it('overwrites every chat the user is in, accent and wallpaper together', async () => {
    mockState.chatIds = ['a', 'b', 'c'];
    const count = await applyStoreTheme('uid1', MIDNIGHT);

    expect(count).toBe(3);
    const sets = mockState.batches.flatMap(b => b.sets);
    expect(sets.map(s => s.path)).toEqual(['chats/a', 'chats/b', 'chats/c']);
    expect(sets[0].data).toEqual({
      themeBy: {uid1: MIDNIGHT.accent},
      wallpaperBy: {uid1: MIDNIGHT.wallpaper},
    });
  });

  it('writes only the acting user key, never another participant', async () => {
    mockState.chatIds = ['a'];
    await applyStoreTheme('uid1', MIDNIGHT);
    const {themeBy, wallpaperBy} = mockState.batches[0].sets[0].data as {
      themeBy: Record<string, string>;
      wallpaperBy: Record<string, string | null>;
    };
    expect(Object.keys(themeBy)).toEqual(['uid1']);
    expect(Object.keys(wallpaperBy)).toEqual(['uid1']);
  });

  it("writes a free theme's own wallpaper, not a null that would erase the look", async () => {
    mockState.chatIds = ['a'];
    await applyStoreTheme('uid1', CLASSIC);
    expect(mockState.batches[0].sets[0].data).toEqual({
      themeBy: {uid1: CLASSIC.accent},
      wallpaperBy: {uid1: CLASSIC.wallpaper},
    });
    expect(CLASSIC.wallpaper).not.toBeNull();
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

describe('isDarkWallpaper', () => {
  it('flags the dark Pro backgrounds', () => {
    expect(isDarkWallpaper('#0F172A')).toBe(true);
    expect(isDarkWallpaper('#2E1065')).toBe(true);
  });

  it('leaves light tints alone', () => {
    expect(isDarkWallpaper('#EEF0FF')).toBe(false);
    expect(isDarkWallpaper('#FFFFFF')).toBe(false);
  });

  it('treats "no wallpaper" as light, matching the default surface', () => {
    expect(isDarkWallpaper(null)).toBe(false);
    expect(isDarkWallpaper(undefined)).toBe(false);
  });

  // A custom wallpaper is a Storage URL; its brightness can't be known without
  // decoding the image, so it keeps the long-standing light-text behaviour
  // rather than guessing and possibly making text worse.
  it('does not guess at uploaded photo wallpapers', () => {
    expect(isDarkWallpaper('https://firebasestorage.googleapis.com/x.jpg')).toBe(false);
  });

  it('handles shorthand hex and rejects malformed values without throwing', () => {
    expect(isDarkWallpaper('#000')).toBe(true);
    expect(isDarkWallpaper('#fff')).toBe(false);
    expect(isDarkWallpaper('#zzzzzz')).toBe(false);
    expect(isDarkWallpaper('#12')).toBe(false);
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
  // The regression this guards: free themes originally shipped with
  // `wallpaper: null`, and the accent reaches so little of the chat that
  // applying one changed nothing on screen — a store item that looks broken.
  it('gives every theme a wallpaper, so applying one is always visible', () => {
    const invisible = THEME_CATALOG.filter(t => !t.wallpaper);
    expect(invisible.map(t => t.id)).toEqual([]);
  });

  it('keeps free themes light and Pro themes dark', () => {
    for (const theme of THEME_CATALOG) {
      expect({id: theme.id, dark: isDarkWallpaper(theme.wallpaper)}).toEqual({
        id: theme.id,
        dark: theme.pro,
      });
    }
  });

  it('has unique ids', () => {
    const ids = THEME_CATALOG.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique accents, so activeThemeId can never be ambiguous', () => {
    const accents = THEME_CATALOG.map(t => t.accent.toLowerCase());
    expect(new Set(accents).size).toBe(accents.length);
  });
});
