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
} from '@react-native-firebase/firestore';
import {Message} from '../types';
import {guardQuerySnapshot} from './snapshotGuard';

const db = getFirestore();

const scheduledRef = (chatId: string) =>
  collection(doc(collection(db, 'chats'), chatId), 'scheduledMessages');

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

export function listenScheduledMessages(
  chatId: string,
  callback: (messages: Array<Message & {scheduledFor: number}>) => void,
) {
  return onSnapshot(
    query(scheduledRef(chatId), where('sent', '==', false), orderBy('scheduledFor', 'asc')),
    guardQuerySnapshot('listen_scheduled_messages', snapshot => {
      const messages = snapshot.docs.map(d => ({
        _id: d.id,
        ...d.data(),
      })) as Array<Message & {scheduledFor: number}>;
      callback(messages);
    }),
    () => callback([]),
  );
}
