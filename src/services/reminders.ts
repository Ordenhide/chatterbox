import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from './firebase/firestore';
import {Reminder} from '../types';

const db = getFirestore();

const remindersRef = (userId: string) =>
  collection(doc(collection(db, 'users'), userId), 'reminders');

export async function createReminder(userId: string, reminder: Reminder) {
  await setDoc(doc(remindersRef(userId), reminder.id), {
    ...reminder,
    sent: false,
  });
}

export async function deleteReminder(userId: string, reminderId: string) {
  await deleteDoc(doc(remindersRef(userId), reminderId));
}

export function listenReminders(
  userId: string,
  callback: (reminders: Reminder[]) => void,
) {
  return onSnapshot(
    query(
      remindersRef(userId),
      where('sent', '==', false),
      orderBy('remindAt', 'asc'),
    ),
    snapshot => {
      const reminders = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as Reminder[];
      callback(reminders);
    },
    () => callback([]),
  );
}
