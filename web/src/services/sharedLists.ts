// Shared lists — collaborative checklists inside a chat (groceries, to-dos,
// packing…). Schema matches the mobile app (chats/{chatId}/sharedLists).
import {collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from '../firebase';
import type {SharedList, SharedListItem} from '../types';

const listsRef = (chatId: string) => collection(db, 'chats', chatId, 'sharedLists');

export async function createSharedList(
  chatId: string,
  title: string,
  items: SharedListItem[] = [],
): Promise<string> {
  const ref = doc(listsRef(chatId));
  await setDoc(ref, {title, items, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
  return ref.id;
}

/** Replace a list's items (add/check/rename/remove all funnel through here). */
export async function updateSharedListItems(
  chatId: string,
  listId: string,
  items: SharedListItem[],
): Promise<void> {
  await setDoc(doc(listsRef(chatId), listId), {items, updatedAt: serverTimestamp()}, {merge: true});
}

export async function deleteSharedList(chatId: string, listId: string): Promise<void> {
  await deleteDoc(doc(listsRef(chatId), listId));
}

export function listenSharedLists(chatId: string, callback: (lists: SharedList[]) => void): () => void {
  return onSnapshot(
    query(listsRef(chatId), orderBy('createdAt', 'desc')),
    snap =>
      callback(
        snap.docs.map(d => ({id: d.id, title: d.data().title ?? '', items: (d.data().items ?? []) as SharedListItem[]})),
      ),
    () => callback([]),
  );
}
