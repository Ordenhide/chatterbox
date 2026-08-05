import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import {BookmarkedMessage} from '../types';
import {guardQuerySnapshot} from './snapshotGuard';

const db = getFirestore();

function bookmarksRef(userId: string) {
  return collection(db, 'users', userId, 'bookmarks');
}

export async function addBookmark(
  userId: string,
  bookmark: Omit<BookmarkedMessage, 'id' | 'bookmarkedAt'>,
): Promise<string> {
  const ref = doc(bookmarksRef(userId));
  await setDoc(ref, {
    ...bookmark,
    bookmarkedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function removeBookmark(
  userId: string,
  bookmarkId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'bookmarks', bookmarkId));
}

export function listenBookmarks(
  userId: string,
  callback: (bookmarks: BookmarkedMessage[]) => void,
): () => void {
  const q = query(bookmarksRef(userId), orderBy('bookmarkedAt', 'desc'));
  return onSnapshot(
    q,
    guardQuerySnapshot('listen_bookmarks', snapshot => {
      const bookmarks: BookmarkedMessage[] = snapshot.docs.map(d => {
        const data = d.data();
        const ba = data.bookmarkedAt;
        return {
          id: d.id,
          chatId: data.chatId,
          messageId: data.messageId,
          text: data.text || '',
          senderName: data.senderName,
          senderId: data.senderId,
          image: data.image,
          audio: data.audio,
          createdAt: typeof data.createdAt === 'number'
            ? data.createdAt
            : data.createdAt?.toMillis?.() ?? Date.now(),
          bookmarkedAt: typeof ba === 'number' ? ba : ba?.toMillis?.() ?? Date.now(),
        };
      });
      callback(bookmarks);
    }),
    error => {
      if (__DEV__) {
        console.warn('listenBookmarks error:', error);
      }
      callback([]);
    },
  );
}
