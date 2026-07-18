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

export async function createCountdown(
  chatId: string,
  data: Omit<SharedCountdown, 'id' | 'createdAt' | 'chatId'>,
): Promise<string> {
  const ref = doc(countdownsRef(chatId));
  await setDoc(ref, {
    ...data,
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
): () => void {
  return onSnapshot(
    query(countdownsRef(chatId), orderBy('createdAt', 'desc')),
    snapshot => {
      const items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as SharedCountdown[];
      callback(items);
    },
    () => callback([]),
  );
}
