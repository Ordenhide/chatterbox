import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {db} from '../firebase';
import type {ChatRoom} from '../types';

// Schema-matched to mobile: chats/{chatId}/scheduledMessages/{id} holding the
// full message doc plus {scheduledFor, sent}. The processScheduledMessages Cloud
// Function delivers these server-side; deliverDueScheduledMessages() below does
// the same client-side so scheduling works without that (billing-gated) function.
const scheduledCol = (chatId: string) => collection(db, 'chats', chatId, 'scheduledMessages');

export interface ScheduledMessage {
  _id: string;
  text?: string;
  /** Set instead of `text` once the body has been sealed — see scheduleMessage. */
  encrypted?: unknown;
  scheduledFor: number;
  user?: {_id: string; name?: string};
}

/**
 * Takes an already-sealed body rather than raw text.
 *
 * A scheduled message used to be written here as plain text and sat in
 * Firestore until its time came — in a chat where every ordinary message goes
 * out encrypted, with nothing in the UI saying this one was different.
 * Delivery copies the document verbatim, so it stayed unsealed in the thread
 * afterwards too. Sealing is the caller's job because only the composer knows
 * the chat's members and holds the keypair; taking `{text?, encrypted?}` here
 * makes it impossible to reach this function without having made that choice.
 */
export async function scheduleMessage(
  chatId: string,
  body: {text?: string; encrypted?: unknown},
  scheduledFor: number,
  me: {uid: string; name: string},
): Promise<void> {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await setDoc(doc(scheduledCol(chatId), id), {
    _id: id,
    text: body.text ?? '',
    ...(body.encrypted ? {encrypted: body.encrypted} : {}),
    user: {_id: me.uid, name: me.name},
    scheduledFor,
    sent: false,
  });
}

export async function cancelScheduledMessage(chatId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(scheduledCol(chatId), messageId));
}

/**
 * A pending scheduled message belongs to whoever wrote it. The collection is
 * per-chat, so a query over it returns every participant's — but a scheduled
 * message is an *outbox*, and only its author can cancel one (the rules make
 * delete author-only, since an unrestricted delete let any participant quietly
 * destroy someone else's pending message). The composer listed the whole chat's
 * and put a cancel button on each, so the button was inert on every row that
 * wasn't yours — and `.catch(() => undefined)` swallowed the denial, leaving
 * the row sitting there as though nothing had been clicked.
 *
 * Filtered in the client rather than as a `where('user._id', '==', myUid)`
 * clause: that would need a fourth composite index for a collection that holds
 * a handful of documents, and it would strand every already-loaded client until
 * the index finished building.
 */
export function ownScheduledMessages<T extends {user?: {_id?: string}}>(
  messages: T[],
  myUid: string,
): T[] {
  if (!myUid) return [];
  return messages.filter(m => m.user?._id === myUid);
}

export function listenScheduledMessages(
  chatId: string,
  myUid: string,
  cb: (messages: ScheduledMessage[]) => void,
) {
  return onSnapshot(
    query(scheduledCol(chatId), where('sent', '==', false), orderBy('scheduledFor', 'asc')),
    snap =>
      cb(
        ownScheduledMessages(
          snap.docs.map(d => ({...(d.data() as ScheduledMessage), _id: d.id})),
          myUid,
        ),
      ),
    () => cb([]),
  );
}

/**
 * Delivers any of this chat's scheduled messages whose time has passed, mirroring
 * the server function: writes the message into `messages`, updates chat metadata
 * (lastMessage + unreadCountBy), and deletes the scheduled doc. A transaction
 * claims each scheduled doc first so two open tabs can't double-send.
 */
export async function deliverDueScheduledMessages(chatId: string, myUid: string): Promise<number> {
  const now = Date.now();
  const dueSnap = await getDocs(
    query(scheduledCol(chatId), where('sent', '==', false), where('scheduledFor', '<=', now)),
  );
  if (dueSnap.empty) return 0;

  let delivered = 0;
  for (const d of dueSnap.docs) {
    const data = d.data();
    // Only the author's client delivers, so it isn't sent from someone else's session.
    if (data.user?._id !== myUid) continue;
    const schedRef = d.ref;
    const msgRef = doc(db, 'chats', chatId, 'messages', d.id);
    const chatRef = doc(db, 'chats', chatId);
    try {
      // eslint-disable-next-line no-await-in-loop
      const ok = await runTransaction(db, async tx => {
        const schedSnap = await tx.get(schedRef);
        if (!schedSnap.exists() || schedSnap.data().sent) return false;
        const chatSnap = await tx.get(chatRef);
        const {scheduledFor: _sf, sent: _s, ...message} = data;
        tx.set(msgRef, {...message, createdAt: serverTimestamp()});
        if (chatSnap.exists()) {
          const chat = chatSnap.data() as ChatRoom;
          const unreadCountBy: Record<string, number> = {...(chat.unreadCountBy || {})};
          (chat.participants || []).forEach(uid => {
            unreadCountBy[uid] = uid === myUid ? 0 : (unreadCountBy[uid] || 0) + 1;
          });
          tx.set(
            chatRef,
            {
              lastMessage: {text: data.text || '', createdAt: serverTimestamp()},
              updatedAt: serverTimestamp(),
              unreadCountBy,
            },
            {merge: true},
          );
        }
        tx.delete(schedRef);
        return true;
      });
      if (ok) delivered++;
    } catch {
      /* another client delivered it first — ignore */
    }
  }
  return delivered;
}
