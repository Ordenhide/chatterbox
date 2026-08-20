import {
  doc,
  getFirestore,
  onSnapshot,
  updateDoc,
  setDoc,
  arrayUnion,
  serverTimestamp,
} from './firebase/firestore';
import {WhiteboardStroke} from '../types';
import {guardDocSnapshot} from './snapshotGuard';

const db = getFirestore();
const WHITEBOARD_ID = 'default';

function whiteboardRef(chatId: string) {
  return doc(db, 'chats', chatId, 'whiteboards', WHITEBOARD_ID);
}

export function listenWhiteboard(
  chatId: string,
  callback: (strokes: WhiteboardStroke[]) => void,
): () => void {
  const ref = whiteboardRef(chatId);
  return onSnapshot(
    ref,
    guardDocSnapshot('listen_whiteboard', snapshot => {
      const data = snapshot.data();
      const strokes = (data?.strokes ?? []) as WhiteboardStroke[];
      callback(strokes);
    }),
    () => callback([]),
  );
}

export async function addStroke(
  chatId: string,
  stroke: WhiteboardStroke,
): Promise<void> {
  const ref = whiteboardRef(chatId);
  try {
    await updateDoc(ref, {
      strokes: arrayUnion(stroke),
      updatedAt: serverTimestamp(),
    });
  } catch {
    await setDoc(ref, {strokes: [stroke], updatedAt: serverTimestamp()});
  }
}

export async function clearWhiteboard(chatId: string): Promise<void> {
  const ref = whiteboardRef(chatId);
  await setDoc(ref, {strokes: [], updatedAt: serverTimestamp()}, {merge: true});
}
