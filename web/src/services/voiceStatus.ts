import {doc, serverTimestamp, setDoc} from 'firebase/firestore';
import {deleteObject, getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import {db} from '../firebase';
import {storage} from './storage';

/**
 * A short voice clip on your profile — the audio equivalent of a status line.
 *
 * Mirrors src/services/voiceStatus.ts on mobile, writing the same
 * `users/{uid}.voiceStatus` shape and the same Storage path, so a status
 * recorded on a phone plays on the web and vice versa.
 *
 * The one real difference is where the audio comes from. Mobile records to a
 * file and re-reads it by path; a browser already holds a Blob from
 * MediaRecorder, so this takes the Blob directly rather than staging it through
 * a fake file:// URL.
 */

/** One object per user, deliberately overwritten — a voice status is a current
 * state, not a history, so old clips should not accumulate in Storage. */
const statusPath = (userId: string) => `voiceStatus/${userId}/status.webm`;

export async function uploadVoiceStatus(
  userId: string,
  audio: Blob,
  durationSeconds: number,
): Promise<string> {
  const objectRef = ref(storage, statusPath(userId));
  await uploadBytes(objectRef, audio);
  const url = await getDownloadURL(objectRef);

  await setDoc(
    doc(db, 'users', userId),
    {
      voiceStatus: {url, duration: Math.round(durationSeconds), createdAt: Date.now()},
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );

  return url;
}

export async function removeVoiceStatus(userId: string): Promise<void> {
  // Storage first, but never fatally: if the object is already gone (or was
  // never written) the profile field must still be cleared, or the UI keeps
  // showing a status whose audio 404s.
  await deleteObject(ref(storage, statusPath(userId))).catch(() => undefined);

  await setDoc(
    doc(db, 'users', userId),
    {voiceStatus: null, updatedAt: serverTimestamp()},
    {merge: true},
  );
}
