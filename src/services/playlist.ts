import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import {PlaylistItem} from '../types';

const db = getFirestore();

function playlistRef(chatId: string) {
  return collection(db, 'chats', chatId, 'playlist');
}

export async function addTrack(
  chatId: string,
  track: Omit<PlaylistItem, 'id' | 'addedAt' | 'votes'>,
): Promise<string> {
  const ref = doc(playlistRef(chatId));
  await setDoc(ref, {
    ...track,
    addedAt: Date.now(),
    votes: [],
  });
  return ref.id;
}

export async function removeTrack(
  chatId: string,
  trackId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'chats', chatId, 'playlist', trackId));
}

export async function voteTrack(
  chatId: string,
  trackId: string,
  userId: string,
): Promise<void> {
  const ref = doc(db, 'chats', chatId, 'playlist', trackId);
  const snap = await getDocs(query(playlistRef(chatId)));
  const current = snap.docs.find(d => d.id === trackId);
  const votes: string[] = current?.data().votes ?? [];
  const updated = votes.includes(userId)
    ? votes.filter(v => v !== userId)
    : [...votes, userId];
  await setDoc(ref, {votes: updated}, {merge: true});
}

export function listenPlaylist(
  chatId: string,
  callback: (items: PlaylistItem[]) => void,
): () => void {
  const q = query(playlistRef(chatId), orderBy('addedAt', 'desc'));
  return onSnapshot(
    q,
    snapshot => {
      const items: PlaylistItem[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as PlaylistItem[];
      callback(items);
    },
    error => {
      if (__DEV__) {
        console.warn('listenPlaylist error:', error);
      }
      callback([]);
    },
  );
}
