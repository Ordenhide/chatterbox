import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import {SharedListItem} from '../types';

const db = getFirestore();

const listsRef = (chatId: string) =>
  collection(doc(collection(db, 'chats'), chatId), 'sharedLists');

export async function createSharedList(
  chatId: string,
  listId: string,
  title: string,
  items: SharedListItem[],
) {
  await setDoc(doc(listsRef(chatId), listId), {
    title,
    items,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateSharedListItem(
  chatId: string,
  listId: string,
  items: SharedListItem[],
) {
  await setDoc(
    doc(listsRef(chatId), listId),
    {items, updatedAt: serverTimestamp()},
    {merge: true},
  );
}

export function listenSharedList(
  chatId: string,
  listId: string,
  callback: (data: {title: string; items: SharedListItem[]} | null) => void,
) {
  return onSnapshot(
    doc(listsRef(chatId), listId),
    snapshot => {
      if (!snapshot.exists) {
        callback(null);
        return;
      }
      const data = snapshot.data() as {title: string; items: SharedListItem[]};
      callback(data);
    },
    () => callback(null),
  );
}
