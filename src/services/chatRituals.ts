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
  serverTimestamp,
} from '@react-native-firebase/firestore';
import {ChatRitual} from '../types';

const db = getFirestore();

function ritualsRef(chatId: string) {
  return collection(db, 'chats', chatId, 'rituals');
}

export async function createRitual(
  chatId: string,
  data: Omit<ChatRitual, 'id' | 'createdAt' | 'streak' | 'lastCompleted'>,
): Promise<string> {
  const ref = doc(ritualsRef(chatId));
  await setDoc(ref, {
    ...data,
    streak: 0,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteRitual(
  chatId: string,
  ritualId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'chats', chatId, 'rituals', ritualId));
}

export async function completeRitual(
  chatId: string,
  ritualId: string,
): Promise<void> {
  const ref = doc(db, 'chats', chatId, 'rituals', ritualId);
  const snap = await getDocs(
    query(ritualsRef(chatId)),
  );
  const current = snap.docs.find(d => d.id === ritualId);
  const streak = current ? (current.data().streak ?? 0) + 1 : 1;
  await setDoc(ref, {streak, lastCompleted: Date.now()}, {merge: true});
}

export function listenRituals(
  chatId: string,
  callback: (rituals: ChatRitual[]) => void,
): () => void {
  const q = query(ritualsRef(chatId), orderBy('createdAt'));
  return onSnapshot(
    q,
    snapshot => {
      const rituals: ChatRitual[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as ChatRitual[];
      callback(rituals);
    },
    error => {
      if (__DEV__) {
        console.warn('listenRituals error:', error);
      }
      callback([]);
    },
  );
}

export function getRitualPrompts(): string[] {
  return [
    'Share a photo of your day',
    'What made you smile today?',
    'Rate your day 1-10',
    'Share an unpopular opinion',
    'What are you grateful for?',
    'Send a song that describes your mood',
    'Share a childhood memory',
    "What's on your mind?",
    'Describe your ideal weekend',
    'Share something you learned today',
  ];
}
