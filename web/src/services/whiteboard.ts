import {
  arrayRemove,
  arrayUnion,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {db} from '../firebase';
import type {WhiteboardStroke} from '../types';

// Shared per-chat whiteboard, schema-matched to the mobile app:
// chats/{chatId}/whiteboards/default { strokes: WhiteboardStroke[], updatedAt }.
const WHITEBOARD_ID = 'default';

function whiteboardRef(chatId: string) {
  return doc(db, 'chats', chatId, 'whiteboards', WHITEBOARD_ID);
}

export function listenWhiteboard(
  chatId: string,
  cb: (strokes: WhiteboardStroke[]) => void,
): () => void {
  return onSnapshot(
    whiteboardRef(chatId),
    snap => cb((snap.data()?.strokes ?? []) as WhiteboardStroke[]),
    () => cb([]),
  );
}

export async function addStroke(chatId: string, stroke: WhiteboardStroke): Promise<void> {
  const ref = whiteboardRef(chatId);
  try {
    await updateDoc(ref, {strokes: arrayUnion(stroke), updatedAt: serverTimestamp()});
  } catch {
    // Doc doesn't exist yet — create it.
    await setDoc(ref, {strokes: [stroke], updatedAt: serverTimestamp()});
  }
}

/**
 * Removes specific strokes (undo / eraser). Uses arrayRemove, which matches by
 * deep equality — so pass the stroke objects exactly as they came from the
 * listener.
 */
export async function removeStrokes(chatId: string, strokes: WhiteboardStroke[]): Promise<void> {
  if (strokes.length === 0) return;
  await updateDoc(whiteboardRef(chatId), {
    strokes: arrayRemove(...strokes),
    updatedAt: serverTimestamp(),
  });
}

export async function clearWhiteboard(chatId: string): Promise<void> {
  await setDoc(whiteboardRef(chatId), {strokes: [], updatedAt: serverTimestamp()}, {merge: true});
}
