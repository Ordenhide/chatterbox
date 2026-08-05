// Shared countdowns — a chat's upcoming events with RSVPs and prep tasks.
// Schema matches the mobile app (chats/{chatId}/countdowns).
import {collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, setDoc} from 'firebase/firestore';
import {db} from '../firebase';
import type {CountdownTask, SharedCountdown} from '../types';
import {sealedField, type ArtifactCrypto} from './e2eeArtifacts';

const countdownsRef = (chatId: string) => collection(db, 'chats', chatId, 'countdowns');

export async function createCountdown(
  chatId: string,
  data: Omit<SharedCountdown, 'id' | 'createdAt' | 'chatId'>,
  crypto?: ArtifactCrypto,
): Promise<string> {
  const ref = doc(countdownsRef(chatId));
  // The date and RSVPs stay readable — they drive sorting and the countdown
  // itself. What the event *is* gets sealed.
  const {title, ...rest} = data;
  await setDoc(ref, {
    ...rest,
    ...(crypto ? sealedField(crypto, 'title', 'encryptedTitle', title) : {title}),
    chatId,
    createdAt: Date.now(),
  });
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

export async function addTask(
  chatId: string,
  countdownId: string,
  text: string,
  crypto?: ArtifactCrypto,
): Promise<void> {
  const ref = doc(countdownsRef(chatId), countdownId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const tasks = (snap.data().tasks as Record<string, unknown>[]) ?? [];
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const task = {
      id,
      done: false,
      ...(crypto ? sealedField(crypto, 'text', 'encryptedText', text) : {text}),
    };
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

export function listenCountdowns(
  chatId: string,
  callback: (items: SharedCountdown[]) => void,
  crypto?: ArtifactCrypto,
): () => void {
  return onSnapshot(
    query(countdownsRef(chatId), orderBy('createdAt', 'desc')),
    snap =>
      callback(
        snap.docs.map(d => {
          const raw = d.data() as Record<string, any>;
          if (!crypto) return {id: d.id, ...raw} as SharedCountdown;
          return {
            ...raw,
            id: d.id,
            title: crypto.open(raw.title, raw.encryptedTitle),
            tasks: ((raw.tasks ?? []) as Record<string, any>[]).map(task => ({
              id: task.id,
              done: !!task.done,
              assignee: task.assignee,
              text: crypto.open(task.text, task.encryptedText),
            })) as CountdownTask[],
          } as SharedCountdown;
        }),
      ),
    () => callback([]),
  );
}
