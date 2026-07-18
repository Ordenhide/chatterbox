import {doc, getFirestore, setDoc, serverTimestamp} from '@react-native-firebase/firestore';

const db = getFirestore();

export async function enableFocusMode(
  userId: string,
  durationMs: number,
  autoReply?: string,
) {
  await setDoc(
    doc(db, 'users', userId),
    {
      focusMode: {
        enabled: true,
        until: Date.now() + durationMs,
        autoReply: autoReply || 'I\'m currently in focus mode. I\'ll get back to you later.',
      },
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
}

export async function disableFocusMode(userId: string) {
  const {deleteField} = require('@react-native-firebase/firestore');
  await setDoc(
    doc(db, 'users', userId),
    {
      focusMode: {enabled: false, until: deleteField(), autoReply: deleteField()},
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
}
