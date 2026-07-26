import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {db} from '../firebase';
import type {BlockRecord, Friend, FriendRequest} from '../types';

export const pairId = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);
export const blockId = (blocker: string, blocked: string) => `${blocker}_${blocked}`;

// ---- Requests --------------------------------------------------------------

export type SendRequestResult = 'sent' | 'exists' | 'friends' | 'invalid';

/**
 * Sends a friend request. Returns the outcome so the UI can give accurate
 * feedback instead of silently no-op'ing. Errors (permission/network) propagate
 * to the caller — the caller must surface them.
 */
export async function sendFriendRequest(fromId: string, toId: string): Promise<SendRequestResult> {
  if (!fromId || !toId || fromId === toId) return 'invalid';
  const id = pairId(fromId, toId);
  return runTransaction(db, async tx => {
    const friendSnap = await tx.get(doc(db, 'friends', id));
    if (friendSnap.exists()) return 'friends';
    const reqSnap = await tx.get(doc(db, 'friendRequests', id));
    if (reqSnap.exists()) return 'exists';
    tx.set(doc(db, 'friendRequests', id), {
      fromId,
      toId,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return 'sent';
  });
}

export async function acceptFriendRequest(requestId: string, myUid: string) {
  const requestRef = doc(db, 'friendRequests', requestId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(requestRef);
    if (!snap.exists()) return;
    const req = snap.data() as FriendRequest;
    if (req.toId !== myUid) return;
    tx.set(doc(db, 'friends', pairId(req.fromId, req.toId)), {
      userIds: [req.fromId, req.toId],
      status: 'accepted',
      createdAt: serverTimestamp(),
    });
    tx.delete(requestRef);
  });
}

export async function declineFriendRequest(requestId: string) {
  await deleteDoc(doc(db, 'friendRequests', requestId));
}

export async function removeFriend(myUid: string, otherId: string) {
  await deleteDoc(doc(db, 'friends', pairId(myUid, otherId)));
}

// ---- Blocks ----------------------------------------------------------------

export async function blockUser(blockerId: string, blockedId: string) {
  if (!blockerId || !blockedId || blockerId === blockedId) return;
  await setDoc(doc(db, 'blocks', blockId(blockerId, blockedId)), {
    blockerId,
    blockedId,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await deleteDoc(doc(db, 'blocks', blockId(blockerId, blockedId)));
}

// ---- Listeners -------------------------------------------------------------

export function listenFriends(myUid: string, cb: (f: Friend[]) => void) {
  return onSnapshot(
    query(collection(db, 'friends'), where('userIds', 'array-contains', myUid)),
    s => cb(s.docs.map(d => ({id: d.id, ...(d.data() as Omit<Friend, 'id'>)}))),
    e => {
      console.warn('listenFriends:', e.message);
      cb([]);
    },
  );
}

export function listenIncomingRequests(myUid: string, cb: (r: FriendRequest[]) => void) {
  return onSnapshot(
    query(collection(db, 'friendRequests'), where('toId', '==', myUid), where('status', '==', 'pending')),
    s => cb(s.docs.map(d => ({id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>)}))),
    e => {
      console.warn('listenIncomingRequests:', e.message);
      cb([]);
    },
  );
}

export function listenOutgoingRequests(myUid: string, cb: (r: FriendRequest[]) => void) {
  return onSnapshot(
    query(collection(db, 'friendRequests'), where('fromId', '==', myUid), where('status', '==', 'pending')),
    s => cb(s.docs.map(d => ({id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>)}))),
    e => {
      console.warn('listenOutgoingRequests:', e.message);
      cb([]);
    },
  );
}

export function listenBlocked(myUid: string, cb: (b: BlockRecord[]) => void) {
  return onSnapshot(
    query(collection(db, 'blocks'), where('blockerId', '==', myUid)),
    s => cb(s.docs.map(d => ({id: d.id, ...(d.data() as Omit<BlockRecord, 'id'>)}))),
    e => {
      console.warn('listenBlocked:', e.message);
      cb([]);
    },
  );
}
