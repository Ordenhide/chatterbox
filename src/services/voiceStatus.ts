import {doc, getFirestore, setDoc, serverTimestamp} from '@react-native-firebase/firestore';
import {getStorage, ref, uploadBytes, getDownloadURL, deleteObject} from '@react-native-firebase/storage';

const db = getFirestore();
const storage = getStorage();

export async function uploadVoiceStatus(
  userId: string,
  filePath: string,
  durationSeconds: number,
): Promise<string> {
  const storageRef = ref(storage, `voiceStatus/${userId}/status.m4a`);

  const response = await fetch(filePath.startsWith('file://') ? filePath : `file://${filePath}`);
  const blob = await response.blob();
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);

  await setDoc(
    doc(db, 'users', userId),
    {
      voiceStatus: {
        url,
        duration: Math.round(durationSeconds),
        createdAt: Date.now(),
      },
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );

  return url;
}

export async function removeVoiceStatus(userId: string): Promise<void> {
  try {
    const storageRef = ref(storage, `voiceStatus/${userId}/status.m4a`);
    await deleteObject(storageRef).catch(() => undefined);
  } catch {
    // storage file may not exist
  }

  await setDoc(
    doc(db, 'users', userId),
    {
      voiceStatus: null,
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
}
