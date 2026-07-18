import {
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
} from '@react-native-firebase/firestore';

const db = getFirestore();

const liveLocRef = (chatId: string) =>
  collection(doc(collection(db, 'chats'), chatId), 'liveLocations');

export async function startSharingLocation(
  chatId: string,
  userId: string,
  latitude: number,
  longitude: number,
  durationMs: number,
) {
  await setDoc(doc(liveLocRef(chatId), userId), {
    latitude,
    longitude,
    expiresAt: Date.now() + durationMs,
    updatedAt: serverTimestamp(),
  });
}

export async function updateLocation(
  chatId: string,
  userId: string,
  latitude: number,
  longitude: number,
) {
  await setDoc(
    doc(liveLocRef(chatId), userId),
    {latitude, longitude, updatedAt: serverTimestamp()},
    {merge: true},
  );
}

export async function stopSharingLocation(chatId: string, userId: string) {
  await deleteDoc(doc(liveLocRef(chatId), userId));
}

export function listenLiveLocation(
  chatId: string,
  userId: string,
  callback: (loc: {latitude: number; longitude: number; expiresAt: number} | null) => void,
) {
  return onSnapshot(
    doc(liveLocRef(chatId), userId),
    snapshot => {
      if (!snapshot.exists) {
        callback(null);
        return;
      }
      const data = snapshot.data() as {latitude: number; longitude: number; expiresAt: number};
      if (data.expiresAt < Date.now()) {
        callback(null);
        return;
      }
      callback(data);
    },
    () => callback(null),
  );
}
