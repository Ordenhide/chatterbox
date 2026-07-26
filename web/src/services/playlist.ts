// Shared playlist — a chat's collaborative song queue with upvotes. Schema
// matches the mobile app (chats/{chatId}/playlist), so tracks added on either
// client appear on both.
import {collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, setDoc} from 'firebase/firestore';
import {db} from '../firebase';
import type {PlaylistItem} from '../types';

const playlistRef = (chatId: string) => collection(db, 'chats', chatId, 'playlist');

export async function addTrack(
  chatId: string,
  track: Omit<PlaylistItem, 'id' | 'addedAt' | 'votes'>,
): Promise<string> {
  const ref = doc(playlistRef(chatId));
  await setDoc(ref, {...track, addedAt: Date.now(), votes: []});
  return ref.id;
}

export async function removeTrack(chatId: string, trackId: string): Promise<void> {
  await deleteDoc(doc(db, 'chats', chatId, 'playlist', trackId));
}

/** Toggle the caller's upvote on a track (transaction-safe against races). */
export async function voteTrack(chatId: string, trackId: string, userId: string): Promise<void> {
  const ref = doc(db, 'chats', chatId, 'playlist', trackId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const votes: string[] = snap.data().votes ?? [];
    const updated = votes.includes(userId) ? votes.filter(v => v !== userId) : [...votes, userId];
    tx.set(ref, {votes: updated}, {merge: true});
  });
}

export function listenPlaylist(chatId: string, callback: (items: PlaylistItem[]) => void): () => void {
  return onSnapshot(
    query(playlistRef(chatId), orderBy('addedAt', 'desc')),
    snap => callback(snap.docs.map(d => ({id: d.id, ...d.data()})) as PlaylistItem[]),
    () => callback([]),
  );
}
