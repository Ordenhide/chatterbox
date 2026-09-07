/**
 * Friend requests, friendships and blocks.
 *
 * ## Kept on purpose, and on borrowed time
 *
 * This is a social graph in plaintext on the server: `friends/{id}.userIds`
 * and `friendRequests` say who knows whom, in documents Firestore can read,
 * index and hand over. For an app whose users are chosen for caring about
 * privacy, that is the wrong shape — metadata like this is often worth more
 * than the message contents it sits beside, and the contents here are the
 * part that is already encrypted.
 *
 * It survived the removal of Moments (2026-09-05), which is what it mostly
 * existed to serve — a feed needs a friend graph to decide who can see a post.
 * It stays because blocking and requests are still wanted, not because this
 * implementation is right. The intent is to rebuild it under metadata
 * minimisation rather than to keep it as-is.
 *
 * So: **do not build new features on this graph.** Anything that makes more of
 * the app depend on a server-readable list of who talks to whom makes that
 * rebuild more expensive, and it is already the largest gap between this app
 * and what its users would check first. Starting a chat, notably, does not go
 * through here — it takes an invite link (services/invites.ts) — so the graph
 * is not load-bearing for the messenger itself.
 *
 * It is now the *last* place a plaintext relationship is written down. The
 * email directory is gone, `users/{uid}` no longer carries an address, a photo
 * or a name, and a display name reaches the other side sealed. This file did
 * not change, which is exactly why it stands out.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from './firebase/firestore';
import {Friend, FriendRequest} from '../types';
import {reportError} from './errorLog';

const db = getFirestore();
const friendsRef = () => collection(db, 'friends');
const friendRequestsRef = () => collection(db, 'friendRequests');

const logError = (error: unknown, context: string) => {
  if (__DEV__) {
    console.error(context, error);
  }
  reportError(error, context);
};

export function buildFriendPairId(userA: string, userB: string) {
  return userA < userB ? `${userA}_${userB}` : `${userB}_${userA}`;
}

export type SendRequestResult = 'sent' | 'exists' | 'friends' | 'invalid' | 'error';

/**
 * Sends a friend request and reports the outcome so the UI can give accurate
 * feedback (instead of always claiming success). Stays non-throwing — callers
 * may fire-and-forget — surfacing failures as the 'error' result.
 */
export async function sendFriendRequest(fromId: string, toId: string): Promise<SendRequestResult> {
  if (!fromId || !toId || fromId === toId) {
    return 'invalid';
  }

  const requestId = buildFriendPairId(fromId, toId);
  const requestRef = doc(friendRequestsRef(), requestId);
  const friendRef = doc(friendsRef(), requestId);

  try {
    return await runTransaction<SendRequestResult>(db, async tx => {
      const friendSnap = await tx.get(friendRef);
      if (friendSnap.exists()) {
        return 'friends';
      }
      const requestSnap = await tx.get(requestRef);
      if (requestSnap.exists()) {
        return 'exists';
      }
      tx.set(requestRef, {
        fromId,
        toId,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      return 'sent';
    });
  } catch (error) {
    logError(error, 'sendFriendRequest');
    return 'error';
  }
}

export async function acceptFriendRequest(requestId: string, userId: string) {
  try {
    const requestRef = doc(friendRequestsRef(), requestId);
    await runTransaction(db, async tx => {
      const requestSnap = await tx.get(requestRef);
      if (!requestSnap.exists()) {
        return;
      }
      const request = requestSnap.data() as FriendRequest;
      if (request.toId !== userId) {
        return;
      }
      const friendId = buildFriendPairId(request.fromId, request.toId);
      const friendRef = doc(friendsRef(), friendId);
      tx.set(friendRef, {
        userIds: [request.fromId, request.toId],
        status: 'accepted',
        createdAt: serverTimestamp(),
      });
      tx.delete(requestRef);
    });
  } catch (error) {
    logError(error, 'acceptFriendRequest');
  }
}

export async function declineFriendRequest(requestId: string, userId: string) {
  const requestRef = doc(friendRequestsRef(), requestId);
  try {
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) {
      return;
    }
    const request = requestSnap.data() as FriendRequest;
    if (request.toId !== userId && request.fromId !== userId) {
      return;
    }
    await deleteDoc(requestRef);
  } catch (error) {
    logError(error, 'declineFriendRequest');
  }
}

export async function removeFriend(userId: string, otherId: string) {
  if (!userId || !otherId || userId === otherId) {
    return;
  }
  const friendId = buildFriendPairId(userId, otherId);
  try {
    await deleteDoc(doc(friendsRef(), friendId));
  } catch (error) {
    logError(error, 'removeFriend');
  }
}

export function listenFriendRequests(userId: string, callback: (requests: FriendRequest[]) => void) {
  return onSnapshot(
    query(friendRequestsRef(), where('toId', '==', userId), where('status', '==', 'pending')),
    snapshot => {
      if (!snapshot) {
        callback([]);
        return;
      }
      const requests = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<FriendRequest, 'id'>),
      })) as FriendRequest[];
      callback(requests);
    },
    error => {
      logError(error, 'listenFriendRequests');
      callback([]);
    },
  );
}

export function listenOutgoingFriendRequests(
  userId: string,
  callback: (requests: FriendRequest[]) => void,
) {
  return onSnapshot(
    query(friendRequestsRef(), where('fromId', '==', userId), where('status', '==', 'pending')),
    snapshot => {
      if (!snapshot) {
        callback([]);
        return;
      }
      const requests = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<FriendRequest, 'id'>),
      })) as FriendRequest[];
      callback(requests);
    },
    error => {
      logError(error, 'listenOutgoingFriendRequests');
      callback([]);
    },
  );
}

export function listenFriends(userId: string, callback: (friends: Friend[]) => void) {
  return onSnapshot(
    query(friendsRef(), where('userIds', 'array-contains', userId)),
    snapshot => {
      if (!snapshot) {
        callback([]);
        return;
      }
      const friends = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Friend, 'id'>),
      })) as Friend[];
      callback(friends);
    },
    error => {
      logError(error, 'listenFriends');
      callback([]);
    },
  );
}

