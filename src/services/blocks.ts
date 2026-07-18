import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@react-native-firebase/firestore';
import {BlockRecord} from '../types';
import {reportError} from './telemetry';

const db = getFirestore();
const blocksRef = () => collection(db, 'blocks');

const logError = (error: unknown, context: string) => {
  if (__DEV__) {
    console.error(context, error);
  }
  reportError(error, context);
};

export function buildBlockId(blockerId: string, blockedId: string) {
  return `${blockerId}_${blockedId}`;
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (!blockerId || !blockedId || blockerId === blockedId) return;
  const id = buildBlockId(blockerId, blockedId);
  await setDoc(doc(blocksRef(), id), {
    blockerId,
    blockedId,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  if (!blockerId || !blockedId || blockerId === blockedId) return;
  const id = buildBlockId(blockerId, blockedId);
  await deleteDoc(doc(blocksRef(), id));
}

export function listenBlockedByMe(userId: string, callback: (records: BlockRecord[]) => void) {
  return onSnapshot(
    query(blocksRef(), where('blockerId', '==', userId)),
    snapshot => {
      if (!snapshot) {
        callback([]);
        return;
      }
      const records = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<BlockRecord, 'id'>),
      })) as BlockRecord[];
      callback(records);
    },
    error => {
      logError(error, 'listenBlockedByMe');
      callback([]);
    },
  );
}

export function listenBlockedMe(userId: string, callback: (records: BlockRecord[]) => void) {
  return onSnapshot(
    query(blocksRef(), where('blockedId', '==', userId)),
    snapshot => {
      if (!snapshot) {
        callback([]);
        return;
      }
      const records = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<BlockRecord, 'id'>),
      })) as BlockRecord[];
      callback(records);
    },
    error => {
      logError(error, 'listenBlockedMe');
      callback([]);
    },
  );
}

