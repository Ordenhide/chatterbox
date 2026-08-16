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
import type {QuoteWallEntry} from '../types';

/**
 * The quote wall: messages a chat has pinned as worth keeping.
 *
 * Mirrors src/services/quoteWall.ts on mobile, including the Firestore path
 * (`chats/{chatId}/quoteWall`), so entries pinned on one client appear on the
 * other.
 *
 * Note the entries are stored in plaintext, unlike the messages they come from.
 * That is inherited from mobile rather than chosen here — pinning a quote
 * copies its text out of the E2EE envelope into a new document that nothing
 * seals. Worth fixing, but it must change on both clients at once or they stop
 * being able to read each other's wall, so it is deliberately left alone here.
 */

function quoteWallRef(chatId: string) {
  return collection(db, 'chats', chatId, 'quoteWall');
}

export async function addToQuoteWall(
  chatId: string,
  entry: Omit<QuoteWallEntry, 'id' | 'pinnedAt'>,
): Promise<string> {
  const ref = doc(quoteWallRef(chatId));
  await setDoc(ref, {...entry, pinnedAt: serverTimestamp()});
  return ref.id;
}

export async function removeFromQuoteWall(chatId: string, entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'chats', chatId, 'quoteWall', entryId));
}

/**
 * Normalises the two shapes a timestamp arrives in.
 *
 * A locally-written entry still carries the sentinel `serverTimestamp()`
 * resolved to a Firestore Timestamp, while one read back later is a plain
 * number. Without this the wall would sort correctly on one client and throw on
 * the other.
 */
function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  const ts = value as {toMillis?: () => number} | null | undefined;
  return ts?.toMillis?.() ?? Date.now();
}

export function listenQuoteWall(
  chatId: string,
  callback: (entries: QuoteWallEntry[]) => void,
): () => void {
  return onSnapshot(
    query(quoteWallRef(chatId), orderBy('pinnedAt', 'desc')),
    snapshot => {
      callback(
        snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            messageId: data.messageId,
            text: data.text || '',
            senderName: data.senderName,
            senderId: data.senderId,
            pinnedBy: data.pinnedBy,
            pinnedByName: data.pinnedByName,
            createdAt: toMillis(data.createdAt),
            pinnedAt: toMillis(data.pinnedAt),
          };
        }),
      );
    },
    error => {
      console.warn('listenQuoteWall error:', error);
      callback([]);
    },
  );
}
