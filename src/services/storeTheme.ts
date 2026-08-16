/**
 * Account-wide store themes.
 *
 * The store is a single global place to browse and apply a look, unlike the
 * per-chat picker it replaced. Applying a theme deliberately **overwrites
 * every chat** the user is in, so the whole app lands on one consistent
 * appearance rather than leaving old conversations on whatever they were set
 * to individually.
 *
 * It still writes the *existing* per-chat fields (`themeBy[uid]`,
 * `wallpaperBy[uid]`) rather than introducing a parallel rendering path, so
 * every chat keeps rendering exactly the way it always has and no migration
 * is required. The only new field is `users/{uid}.storeThemeId`, which
 * records the choice so chats created *later* (by either participant, on
 * either platform) can fall back to it without a write.
 *
 * Kept deliberately parallel to web/src/services/storeTheme.ts — same names,
 * same semantics — matching this repo's parallel-not-shared convention.
 */
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from './firebase/firestore';
import {themeById, type StoreTheme} from './themeCatalog';
import {guardDocSnapshot} from './snapshotGuard';

const db = getFirestore();
const chatsRef = () => collection(db, 'chats');
const usersRef = () => collection(db, 'users');

/**
 * Firestore hard-caps a batch at 500 writes. Staying under it leaves room for
 * the commit itself and keeps a very heavy account from failing outright.
 */
export const MAX_WRITES_PER_BATCH = 400;

export function chunk<T>(items: T[], size: number = MAX_WRITES_PER_BATCH): T[][] {
  if (size < 1) return items.length ? [items] : [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * The accent a chat should render with, in priority order: the chat's own
 * stored value, then the account-wide store theme, then the app default.
 *
 * The account fallback is what makes a chat created *after* the theme was
 * applied still look right — the batch overwrite can only reach chats that
 * existed at the time.
 */
export function resolveAccent(
  chatAccent: string | undefined | null,
  accountAccent: string | undefined | null,
  fallback: string,
): string {
  return chatAccent || accountAccent || fallback;
}

/**
 * Same idea for the wallpaper, but `null` is a real user choice ("none") and
 * must not be treated as "unset" — only `undefined` falls through to the
 * account default.
 */
export function resolveWallpaper(
  chatWallpaper: string | null | undefined,
  accountWallpaper: string | null | undefined,
): string | null {
  if (chatWallpaper !== undefined) return chatWallpaper;
  return accountWallpaper ?? null;
}

/** Reads the catalog entry a stored `storeThemeId` refers to. */
export function storeThemeFromProfile(storeThemeId: unknown): StoreTheme | undefined {
  return typeof storeThemeId === 'string' ? themeById(storeThemeId) : undefined;
}

/**
 * Applies a theme account-wide. Returns how many chats were updated.
 *
 * The user-doc write happens first: if the batched chat writes fail partway
 * (offline, permissions), the account default is still recorded, so new chats
 * and the store's own "applied" state stay correct and the user can retry.
 */
export async function applyStoreTheme(uid: string, theme: StoreTheme): Promise<number> {
  await setDoc(doc(usersRef(), uid), {storeThemeId: theme.id}, {merge: true});

  const snapshot = await getDocs(query(chatsRef(), where('participants', 'array-contains', uid)));
  const ids = snapshot.docs.map(d => d.id);

  for (const group of chunk(ids)) {
    const batch = writeBatch(db);
    for (const id of group) {
      batch.set(
        doc(chatsRef(), id),
        {themeBy: {[uid]: theme.accent}, wallpaperBy: {[uid]: theme.wallpaper}},
        {merge: true},
      );
    }
    await batch.commit();
  }
  return ids.length;
}

/** Live account-wide theme, for rendering fallbacks and the store's selected state. */
export function listenStoreTheme(uid: string, cb: (theme: StoreTheme | undefined) => void) {
  return onSnapshot(
    doc(usersRef(), uid),
    guardDocSnapshot('listen_store_theme', snap =>
      cb(storeThemeFromProfile(snap.data()?.storeThemeId)),
    ),
    () => cb(undefined),
  );
}
