// Shared countdowns — a chat's upcoming events with RSVPs and prep tasks.
// Schema matches the mobile app (chats/{chatId}/countdowns).
import {collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, setDoc} from 'firebase/firestore';
import {db} from '../firebase';
import type {CountdownTask, SharedCountdown} from '../types';

const countdownsRef = (chatId: string) => collection(db, 'chats', chatId, 'countdowns');

export async function createCountdown(
  chatId: string,
  data: Omit<SharedCountdown, 'id' | 'createdAt' | 'chatId'>,
): Promise<string> {
  const ref = doc(countdownsRef(chatId));
  await setDoc(ref, {...data, chatId, createdAt: Date.now()});
  return ref.id;
}

export async function deleteCountdown(chatId: string, countdownId: string): Promise<void> {
  await deleteDoc(doc(countdownsRef(chatId), countdownId));
}

export async function rsvpCountdown(
  chatId: string,
  countdownId: string,
  userId: string,
  status: 'going' | 'maybe' | 'skip',
): Promise<void> {
  const ref = doc(countdownsRef(chatId), countdownId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const rsvps = (snap.data().rsvps as Record<string, string>) ?? {};
    rsvps[userId] = status;
    tx.set(ref, {rsvps}, {merge: true});
  });
}

export async function addTask(chatId: string, countdownId: string, text: string): Promise<void> {
  const ref = doc(countdownsRef(chatId), countdownId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const tasks = (snap.data().tasks as CountdownTask[]) ?? [];
    const task: CountdownTask = {id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, done: false};
    tx.set(ref, {tasks: [...tasks, task]}, {merge: true});
  });
}

export async function toggleTask(chatId: string, countdownId: string, taskId: string): Promise<void> {
  const ref = doc(countdownsRef(chatId), countdownId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const tasks = ((snap.data().tasks as CountdownTask[]) ?? []).map(task =>
      task.id === taskId ? {...task, done: !task.done} : task,
    );
    tx.set(ref, {tasks}, {merge: true});
  });
}

export function listenCountdowns(chatId: string, callback: (items: SharedCountdown[]) => void): () => void {
  return onSnapshot(
    query(countdownsRef(chatId), orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => ({id: d.id, ...d.data()})) as SharedCountdown[]),
    () => callback([]),
  );
}
