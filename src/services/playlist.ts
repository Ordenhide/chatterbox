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

import {sealedField, type ArtifactCrypto} from './e2eeArtifacts';
import {guardQuerySnapshot} from './snapshotGuard';

export async function addTrack(
  chatId: string,
  track: Omit<PlaylistItem, 'id' | 'addedAt' | 'votes'>,
  crypto?: ArtifactCrypto,
): Promise<string> {
  const ref = doc(playlistRef(chatId));
  // addedBy / addedByName stay readable: they attribute the track and say
  // nothing about what it is.
  const {title, artist, url, ...rest} = track as any;
  await setDoc(ref, {
    ...rest,
    ...(crypto
      ? {
          ...sealedField(crypto, 'title', 'encryptedTitle', title),
          ...sealedField(crypto, 'artist', 'encryptedArtist', artist),
          ...sealedField(crypto, 'url', 'encryptedUrl', url),
        }
      : {title, artist: artist ?? '', url}),
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
  crypto?: ArtifactCrypto,
): () => void {
  const q = query(playlistRef(chatId), orderBy('addedAt', 'desc'));
  return onSnapshot(
    q,
    guardQuerySnapshot('listen_playlist', snapshot => {
      const items: PlaylistItem[] = snapshot.docs.map(d => {
        const raw = d.data() as Record<string, any>;
        if (!crypto) return {id: d.id, ...raw};
        return {
          ...raw,
          id: d.id,
          title: crypto.open(raw.title, raw.encryptedTitle),
          artist: crypto.open(raw.artist, raw.encryptedArtist),
          url: crypto.open(raw.url, raw.encryptedUrl),
        };
      }) as PlaylistItem[];
      callback(items);
    }),
    error => {
      if (__DEV__) {
        console.warn('listenPlaylist error:', error);
      }
      callback([]);
    },
  );
}
