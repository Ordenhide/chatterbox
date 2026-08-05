import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import {SharedCountdown} from '../types';

const db = getFirestore();

const countdownsRef = (chatId: string) =>
  collection(doc(collection(db, 'chats'), chatId), 'countdowns');

import {sealedField, type ArtifactCrypto} from './e2eeArtifacts';
import {guardQuerySnapshot} from './snapshotGuard';

export async function createCountdown(
  chatId: string,
  data: Omit<SharedCountdown, 'id' | 'createdAt' | 'chatId'>,
  crypto?: ArtifactCrypto,
): Promise<string> {
  const ref = doc(countdownsRef(chatId));
  // Date and RSVPs stay readable — they drive the countdown itself. What the
  // event *is* gets sealed.
  const {title, ...rest} = data as any;
  await setDoc(ref, {
    ...rest,
    ...(crypto ? sealedField(crypto, 'title', 'encryptedTitle', title) : {title}),
    chatId,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteCountdown(
  chatId: string,
  countdownId: string,
): Promise<void> {
  await deleteDoc(doc(countdownsRef(chatId), countdownId));
}

export async function rsvpCountdown(
  chatId: string,
  countdownId: string,
  userId: string,
  status: 'going' | 'maybe' | 'skip',
): Promise<void> {
  const ref = doc(countdownsRef(chatId), countdownId);
  const snap = await getDocs(
    query(countdownsRef(chatId), orderBy('createdAt', 'desc')),
  );
  const existing = snap.docs.find(d => d.id === countdownId);
  const rsvps = (existing?.data()?.rsvps as Record<string, string>) ?? {};
  rsvps[userId] = status;
  await setDoc(ref, {rsvps}, {merge: true});
}

export async function toggleTask(
  chatId: string,
  countdownId: string,
  tasks: SharedCountdown['tasks'],
  taskId: string,
): Promise<void> {
  const updated = (tasks ?? []).map(t =>
    t.id === taskId ? {...t, done: !t.done} : t,
  );
  await setDoc(doc(countdownsRef(chatId), countdownId), {tasks: updated}, {merge: true});
}

export function listenCountdowns(
  chatId: string,
  callback: (items: SharedCountdown[]) => void,
  crypto?: ArtifactCrypto,
): () => void {
  return onSnapshot(
    query(countdownsRef(chatId), orderBy('createdAt', 'desc')),
    guardQuerySnapshot('listen_countdowns', snapshot => {
      const items = snapshot.docs.map(d => {
        const raw = d.data() as Record<string, any>;
        if (!crypto) return {id: d.id, ...raw};
        return {
          ...raw,
          id: d.id,
          title: crypto.open(raw.title, raw.encryptedTitle),
          tasks: ((raw.tasks ?? []) as Record<string, any>[]).map(task => ({
            id: task.id,
            done: !!task.done,
            assignee: task.assignee,
            text: crypto.open(task.text, task.encryptedText),
          })),
        };
      }) as SharedCountdown[];
      callback(items);
    }),
    () => callback([]),
  );
}
