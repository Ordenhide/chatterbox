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
} from './firebase/firestore';
import {BlockRecord} from '../types';
import {reportError} from './errorLog';

const db = getFirestore();
const blocksRef = () => collection(db, 'blocks');

const logError = (error: unknown, context: string) => {
  if (__DEV__) {
    console.error(context, error);
  }
  reportError(error, context);
};

/**
 * Blocking.
 *
 * ## What it does
 *
 * - Stops a *new* two-party chat being created in either direction
 *   (firestore.rules, blockedFromStarting), which is the promise the UI makes:
 *   "You cannot start a chat with this user".
 * - Stops push notifications from a blocked sender reaching you
 *   (functions/index.js, notifyNewMessage).
 * - Hides each side's moments and their images from the other
 *   (firestore.rules and storage.rules).
 * - Stops friend requests and friendship creation in either direction.
 *
 * ## What it does not do, and why
 *
 * A blocked user can still write messages into a chat that already existed
 * before the block. That is not an oversight to be quietly left: denying the
 * write in the rules was considered and rejected, because a rejected send
 * stays in the sender's outbox and is retried on every launch forever, and
 * `permission-denied` cannot be told apart from the displaced-session case —
 * so denying would risk silently discarding legitimate messages from an
 * ordinary user whose session had rotated.
 *
 * Closing it properly needs the client to distinguish a permanent refusal
 * from a transient one, the way isRecipientUnreachable already does for a
 * deleted account. Until then the messages arrive but are silent, and this
 * comment exists so nobody reads the feature as doing more than it does.
 */
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

