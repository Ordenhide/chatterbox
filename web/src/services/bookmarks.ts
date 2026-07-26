import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {db} from '../firebase';
import type {Bookmark} from '../types';

export async function addBookmark(
  uid: string,
  bookmark: Omit<Bookmark, 'id' | 'bookmarkedAt'>,
): Promise<void> {
  const ref = doc(collection(db, 'users', uid, 'bookmarks'));
  await setDoc(ref, {...bookmark, bookmarkedAt: serverTimestamp()});
}

export async function removeBookmark(uid: string, bookmarkId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'bookmarks', bookmarkId));
}

export function listenBookmarks(uid: string, cb: (b: Bookmark[]) => void) {
  return onSnapshot(
    query(collection(db, 'users', uid, 'bookmarks'), orderBy('bookmarkedAt', 'desc')),
    s => cb(s.docs.map(d => ({id: d.id, ...(d.data() as Omit<Bookmark, 'id'>)}))),
    e => {
      console.warn('listenBookmarks:', e.message);
      cb([]);
    },
  );
}
