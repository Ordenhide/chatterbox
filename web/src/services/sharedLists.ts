// Shared lists — collaborative checklists inside a chat (groceries, to-dos,
// packing…). Schema matches the mobile app (chats/{chatId}/sharedLists).
import {collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from '../firebase';
import type {SharedList, SharedListItem} from '../types';
import {sealedField, type ArtifactCrypto} from './e2eeArtifacts';

const listsRef = (chatId: string) => collection(db, 'chats', chatId, 'sharedLists');

/**
 * Seals an item's user-typed text, leaving its bookkeeping fields (id, checked,
 * checkedBy) readable — those are needed to render and merge the list, and
 * reveal nothing about its contents.
 */
function sealItems(items: SharedListItem[], crypto: ArtifactCrypto): Record<string, unknown>[] {
  return items.map(({id, text, checked, checkedBy}) => ({
    id,
    checked,
    ...(checkedBy ? {checkedBy} : {}),
    ...sealedField(crypto, 'text', 'encryptedText', text),
  }));
}

export async function createSharedList(
  chatId: string,
  title: string,
  items: SharedListItem[] = [],
  crypto?: ArtifactCrypto,
): Promise<string> {
  const ref = doc(listsRef(chatId));
  await setDoc(ref, {
    ...(crypto ? sealedField(crypto, 'title', 'encryptedTitle', title) : {title}),
    items: crypto ? sealItems(items, crypto) : items,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Replace a list's items (add/check/rename/remove all funnel through here). */
export async function updateSharedListItems(
  chatId: string,
  listId: string,
  items: SharedListItem[],
  crypto?: ArtifactCrypto,
): Promise<void> {
  await setDoc(
    doc(listsRef(chatId), listId),
    {items: crypto ? sealItems(items, crypto) : items, updatedAt: serverTimestamp()},
    {merge: true},
  );
}

export async function deleteSharedList(chatId: string, listId: string): Promise<void> {
  await deleteDoc(doc(listsRef(chatId), listId));
}

/**
 * `crypto` decrypts titles and item text where present. Lists written before
 * encryption existed carry plaintext and are returned unchanged, so passing no
 * crypto (or an inert one) degrades to the original behaviour.
 */
export function listenSharedLists(
  chatId: string,
  callback: (lists: SharedList[]) => void,
  crypto?: ArtifactCrypto,
): () => void {
  return onSnapshot(
    query(listsRef(chatId), orderBy('createdAt', 'desc')),
    snap =>
      callback(
        snap.docs.map(d => {
          const raw = d.data() as Record<string, any>;
          const rawItems = (raw.items ?? []) as Record<string, any>[];
          return {
            id: d.id,
            title: crypto ? crypto.open(raw.title, raw.encryptedTitle) : raw.title ?? '',
            items: rawItems.map(it => ({
              id: it.id,
              checked: !!it.checked,
              checkedBy: it.checkedBy,
              text: crypto ? crypto.open(it.text, it.encryptedText) : it.text ?? '',
            })) as SharedListItem[],
          };
        }),
      ),
    () => callback([]),
  );
}
