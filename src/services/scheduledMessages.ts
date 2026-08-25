import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  deleteDoc,
  where,
} from './firebase/firestore';
import {Message} from '../types';
import {guardQuerySnapshot} from './snapshotGuard';

const db = getFirestore();

const scheduledRef = (chatId: string) =>
  collection(doc(collection(db, 'chats'), chatId), 'scheduledMessages');

/**
 * `message` must already be sealed if the chat's peers are enrolled — the
 * composer runs it through encryptOutgoingMessage first. Scheduling used to
 * write plain text here, in a chat where every ordinary message goes out
 * encrypted, and it stayed plain: delivery copies the document verbatim into
 * `messages`.
 */
export async function scheduleMessage(chatId: string, message: Message, scheduledFor: number) {
  const id = String(message._id);
  await setDoc(doc(scheduledRef(chatId), id), {
    ...message,
    scheduledFor,
    sent: false,
  });
}

export async function cancelScheduledMessage(chatId: string, messageId: string) {
  await deleteDoc(doc(scheduledRef(chatId), messageId));
}

/**
 * A pending scheduled message belongs to whoever wrote it. The collection is
 * per-chat, so a query over it returns every participant's — but a scheduled
 * message is an *outbox*, and only its author can cancel one (the rules make
 * delete author-only, since an unrestricted delete let any participant quietly
 * destroy someone else's pending message). Showing another person's here means
 * a count that isn't yours and a cancel button that cannot work.
 *
 * Filtered in the client rather than as a `where('user._id', '==', myUid)`
 * clause: that would need a fourth composite index for a collection that holds
 * a handful of documents, and it would strand every already-installed client
 * until the index finished building.
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
  callback: (messages: Array<Message & {scheduledFor: number}>) => void,
) {
  return onSnapshot(
    query(scheduledRef(chatId), where('sent', '==', false), orderBy('scheduledFor', 'asc')),
    guardQuerySnapshot('listen_scheduled_messages', snapshot => {
      const messages = snapshot.docs.map(d => ({
        _id: d.id,
        ...d.data(),
      })) as Array<Message & {scheduledFor: number}>;
      callback(ownScheduledMessages(messages, myUid));
    }),
    () => callback([]),
  );
}
