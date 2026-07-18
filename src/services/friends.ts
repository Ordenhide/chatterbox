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
} from '@react-native-firebase/firestore';
import {Friend, FriendRequest} from '../types';
import {reportError} from './telemetry';

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

export async function sendFriendRequest(fromId: string, toId: string) {
  if (!fromId || !toId || fromId === toId) {
    return;
  }

  const requestId = buildFriendPairId(fromId, toId);
  const requestRef = doc(friendRequestsRef(), requestId);
  const friendRef = doc(friendsRef(), requestId);

  try {
    await runTransaction(db, async tx => {
      const friendSnap = await tx.get(friendRef);
      if (friendSnap.exists) {
        return;
      }
      const requestSnap = await tx.get(requestRef);
      if (requestSnap.exists) {
        return;
      }
      tx.set(requestRef, {
        fromId,
        toId,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    logError(error, 'sendFriendRequest');
  }
}

export async function acceptFriendRequest(requestId: string, userId: string) {
  try {
    const requestRef = doc(friendRequestsRef(), requestId);
    await runTransaction(db, async tx => {
      const requestSnap = await tx.get(requestRef);
      if (!requestSnap.exists) {
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
    if (!requestSnap.exists) {
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

