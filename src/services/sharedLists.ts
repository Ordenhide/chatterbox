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

import {sealedField, type ArtifactCrypto} from './e2eeArtifacts';

/**
 * Seals an item's user-typed text, leaving its bookkeeping fields readable —
 * those are needed to render and merge the list and reveal nothing about it.
 */
function sealItems(items: SharedListItem[], crypto: ArtifactCrypto): Record<string, unknown>[] {
  return items.map(({id, text, checked, checkedBy}: any) => ({
    id,
    checked,
    ...(checkedBy ? {checkedBy} : {}),
    ...sealedField(crypto, 'text', 'encryptedText', text),
  }));
}

export async function createSharedList(
  chatId: string,
  listId: string,
  title: string,
  items: SharedListItem[],
  crypto?: ArtifactCrypto,
) {
  await setDoc(doc(listsRef(chatId), listId), {
    ...(crypto ? sealedField(crypto, 'title', 'encryptedTitle', title) : {title}),
    items: crypto ? sealItems(items, crypto) : items,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateSharedListItem(
  chatId: string,
  listId: string,
  items: SharedListItem[],
  crypto?: ArtifactCrypto,
) {
  await setDoc(
    doc(listsRef(chatId), listId),
    {items: crypto ? sealItems(items, crypto) : items, updatedAt: serverTimestamp()},
    {merge: true},
  );
}

export function listenSharedList(
  chatId: string,
  listId: string,
  callback: (data: {title: string; items: SharedListItem[]} | null) => void,
  crypto?: ArtifactCrypto,
) {
  return onSnapshot(
    doc(listsRef(chatId), listId),
    snapshot => {
      if (!snapshot.exists) {
        callback(null);
        return;
      }
      const raw = snapshot.data() as Record<string, any>;
      if (!crypto) {
        callback(raw as {title: string; items: SharedListItem[]});
        return;
      }
      callback({
        title: crypto.open(raw.title, raw.encryptedTitle),
        items: ((raw.items ?? []) as Record<string, any>[]).map(it => ({
          id: it.id,
          checked: !!it.checked,
          checkedBy: it.checkedBy,
          text: crypto.open(it.text, it.encryptedText),
        })) as SharedListItem[],
      });
    },
    () => callback(null),
  );
}
