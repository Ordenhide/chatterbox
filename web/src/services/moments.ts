import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {db} from '../firebase';
import {deleteStorageObjectByUrl} from './storage';
import type {Moment, MomentComment, MomentVisibility} from '../types';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function createdMillis(m: Moment): number {
  return m.createdAt?.toMillis?.() ?? m.clientCreatedAt ?? 0;
}

export async function getFriendUids(myUid: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, 'friends'), where('userIds', 'array-contains', myUid)),
  );
  const set = new Set<string>();
  snap.forEach(d => {
    ((d.data().userIds as string[]) || []).forEach(id => {
      if (id !== myUid) set.add(id);
    });
  });
  return Array.from(set);
}

/**
 * Feed = my own moments + friends' public/friends-visibility moments. Mirrors
 * the mobile fetchMomentsForAuthors: reads are scoped to a known author set
 * (self + friends) with explicit visibility filters, so it satisfies the
 * Firestore rules (which gate reads on authorship / friendship / block state).
 */
export async function fetchFeed(myUid: string): Promise<Moment[]> {
  const friendUids = await getFriendUids(myUid);
  const momentsCol = collection(db, 'moments');
  const queries = [getDocs(query(momentsCol, where('authorId', '==', myUid)))];

  for (const c of chunk(friendUids, 10)) {
    queries.push(getDocs(query(momentsCol, where('authorId', 'in', c), where('visibility', '==', 'public'))));
    queries.push(getDocs(query(momentsCol, where('authorId', 'in', c), where('visibility', '==', 'friends'))));
  }

  const snaps = await Promise.all(queries);
  const byId = new Map<string, Moment>();
  snaps.forEach(s =>
    s.forEach(d => byId.set(d.id, {id: d.id, ...(d.data() as Omit<Moment, 'id'>)})),
  );

  // "Burn after time-up": hide expired moments from the feed, and clean up the
  // ones this user authored (rules only allow deleting your own moment).
  const now = Date.now();
  const live: Moment[] = [];
  for (const m of byId.values()) {
    if (m.expiresAt && m.expiresAt <= now) {
      if (m.authorId === myUid) deleteMoment(m.id, m.mediaUrl).catch(() => undefined);
      continue;
    }
    live.push(m);
  }
  return live.sort((a, b) => createdMillis(b) - createdMillis(a));
}

/** Deletes a moment (author only, per rules) and its media file, if any. */
export async function deleteMoment(momentId: string, mediaUrl?: string | null): Promise<void> {
  if (mediaUrl) await deleteStorageObjectByUrl(mediaUrl);
  await deleteDoc(doc(db, 'moments', momentId));
}

/**
 * Reserves a moment id before anything is written.
 *
 * The media path now contains the moment id, because that is what lets the
 * Storage rule find the moment and apply its visibility (see storage.rules).
 * So the id has to exist before the upload, which happens before the document.
 */
export function newMomentId(): string {
  return doc(collection(db, 'moments')).id;
}

export async function createMoment(
  authorId: string,
  params: {
    text?: string;
    visibility?: MomentVisibility;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    expiresAt?: number;
  },
  momentId?: string,
): Promise<string> {
  const ref = momentId ? doc(collection(db, 'moments'), momentId) : doc(collection(db, 'moments'));
  await setDoc(ref, {
    authorId,
    text: params.text || '',
    mediaUrl: params.mediaUrl || null,
    mediaType: params.mediaUrl ? params.mediaType || 'image' : null,
    visibility: params.visibility || 'friends',
    createdAt: serverTimestamp(),
    clientCreatedAt: Date.now(),
    likeCount: 0,
    commentCount: 0,
    expiresAt: params.expiresAt || null,
  });
  return ref.id;
}

export async function getLikedMomentIds(momentIds: string[], myUid: string): Promise<Set<string>> {
  const results = await Promise.all(
    momentIds.map(id =>
      getDoc(doc(db, 'moments', id, 'likes', myUid)).then(s => (s.exists() ? id : null)),
    ),
  );
  return new Set(results.filter((x): x is string => x !== null));
}

/** Toggle like, matching the mobile like/unlike transaction (updates likeCount). */
export async function toggleLike(momentId: string, myUid: string, liked: boolean): Promise<void> {
  const likeRef = doc(db, 'moments', momentId, 'likes', myUid);
  const momentRef = doc(db, 'moments', momentId);
  await runTransaction(db, async tx => {
    const likeSnap = await tx.get(likeRef);
    if (liked) {
      if (likeSnap.exists()) {
        tx.delete(likeRef);
        tx.set(momentRef, {likeCount: increment(-1)}, {merge: true});
      }
    } else if (!likeSnap.exists()) {
      tx.set(likeRef, {createdAt: serverTimestamp()});
      tx.set(momentRef, {likeCount: increment(1)}, {merge: true});
    }
  });
}

// ---- Comments --------------------------------------------------------------

export function listenComments(momentId: string, cb: (c: MomentComment[]) => void) {
  return onSnapshot(
    query(collection(db, 'moments', momentId, 'comments'), orderBy('createdAt', 'asc')),
    s => cb(s.docs.map(d => ({id: d.id, ...(d.data() as Omit<MomentComment, 'id'>)}))),
    e => {
      console.warn('listenComments:', e.message);
      cb([]);
    },
  );
}

export async function addComment(momentId: string, authorId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const commentRef = doc(collection(db, 'moments', momentId, 'comments'));
  await runTransaction(db, async tx => {
    tx.set(commentRef, {authorId, text: trimmed, createdAt: serverTimestamp()});
    tx.set(doc(db, 'moments', momentId), {commentCount: increment(1)}, {merge: true});
  });
}
