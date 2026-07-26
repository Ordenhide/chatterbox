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
  scheduledFor: number;
  user?: {_id: string; name?: string};
}

export async function scheduleMessage(
  chatId: string,
  text: string,
  scheduledFor: number,
  me: {uid: string; name: string},
): Promise<void> {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await setDoc(doc(scheduledCol(chatId), id), {
    _id: id,
    text,
    user: {_id: me.uid, name: me.name},
    scheduledFor,
    sent: false,
  });
}

export async function cancelScheduledMessage(chatId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(scheduledCol(chatId), messageId));
}

export function listenScheduledMessages(
  chatId: string,
  cb: (messages: ScheduledMessage[]) => void,
) {
  return onSnapshot(
    query(scheduledCol(chatId), where('sent', '==', false), orderBy('scheduledFor', 'asc')),
    snap => cb(snap.docs.map(d => ({...(d.data() as ScheduledMessage), _id: d.id}))),
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
