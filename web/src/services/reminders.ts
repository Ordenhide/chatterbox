// Message reminders — "remind me about this" nudges, stored per-user under
// users/{uid}/reminders (schema matches mobile). Delivery is a client-side
// sweep (see useReminders): when remindAt passes, we fire a local notification
// and flip `sent`, so a reminder set on mobile can also fire on web and vice
// versa. Idempotency is guaranteed by the `sent` flag.
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import {db} from '../firebase';
import type {Reminder} from '../types';

const remindersRef = (userId: string) => collection(db, 'users', userId, 'reminders');

export async function createReminder(userId: string, reminder: Reminder): Promise<void> {
  await setDoc(doc(remindersRef(userId), reminder.id), {...reminder, sent: false});
}

export async function deleteReminder(userId: string, reminderId: string): Promise<void> {
  await deleteDoc(doc(remindersRef(userId), reminderId));
}

export async function markReminderSent(userId: string, reminderId: string): Promise<void> {
  await setDoc(doc(remindersRef(userId), reminderId), {sent: true}, {merge: true});
}

/** Live list of the user's pending (unsent) reminders, soonest first. */
export function listenReminders(userId: string, callback: (reminders: Reminder[]) => void): () => void {
  return onSnapshot(
    query(remindersRef(userId), where('sent', '==', false), orderBy('remindAt', 'asc')),
    snap => callback(snap.docs.map(d => ({...(d.data() as Reminder), id: d.id}))),
    () => callback([]),
  );
}
