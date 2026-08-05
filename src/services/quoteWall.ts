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
import {QuoteWallEntry} from '../types';
import {guardQuerySnapshot} from './snapshotGuard';

const db = getFirestore();

function quoteWallRef(chatId: string) {
  return collection(db, 'chats', chatId, 'quoteWall');
}

export async function addToQuoteWall(
  chatId: string,
  entry: Omit<QuoteWallEntry, 'id' | 'pinnedAt'>,
): Promise<string> {
  const ref = doc(quoteWallRef(chatId));
  await setDoc(ref, {
    ...entry,
    pinnedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function removeFromQuoteWall(
  chatId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'chats', chatId, 'quoteWall', entryId));
}

export function listenQuoteWall(
  chatId: string,
  callback: (entries: QuoteWallEntry[]) => void,
): () => void {
  const q = query(quoteWallRef(chatId), orderBy('pinnedAt', 'desc'));
  return onSnapshot(
    q,
    guardQuerySnapshot('listen_quote_wall', snapshot => {
      const entries: QuoteWallEntry[] = snapshot.docs.map(d => {
        const data = d.data();
        const pa = data.pinnedAt;
        return {
          id: d.id,
          messageId: data.messageId,
          text: data.text || '',
          senderName: data.senderName,
          senderId: data.senderId,
          pinnedBy: data.pinnedBy,
          pinnedByName: data.pinnedByName,
          createdAt: typeof data.createdAt === 'number'
            ? data.createdAt
            : data.createdAt?.toMillis?.() ?? Date.now(),
          pinnedAt: typeof pa === 'number' ? pa : pa?.toMillis?.() ?? Date.now(),
        };
      });
      callback(entries);
    }),
    error => {
      if (__DEV__) {
        console.warn('listenQuoteWall error:', error);
      }
      callback([]);
    },
  );
}
