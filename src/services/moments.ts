import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from './firebase/firestore';
import {deleteObject, getDownloadURL, getStorage, ref, uploadFileFromUri} from './firebase/storage';
import {Moment, MomentComment, MomentVisibility} from '../types';
import {reportError} from './telemetry';
import {isExifStrippingEnabled} from './privacyGuard';
import ImageResizer from 'react-native-image-resizer';

const db = getFirestore();
const storage = getStorage();
const momentsRef = () => collection(db, 'moments');
const momentLikesRef = (momentId: string) => collection(doc(momentsRef(), momentId), 'likes');
const momentCommentsRef = (momentId: string) => collection(doc(momentsRef(), momentId), 'comments');

const logError = (error: unknown, context: string) => {
  if (__DEV__) {
    console.error(context, error);
  }
  reportError(error, context);
};

export async function createMoment(
  authorId: string,
  params: {text?: string; mediaUrl?: string; mediaType?: 'image' | 'video'; visibility?: MomentVisibility},
) {
  if (!authorId) {
    return;
  }
  try {
    const momentDoc = doc(momentsRef());
    await setDoc(momentDoc, {
    authorId,
    text: params.text || '',
    mediaUrl: params.mediaUrl || null,
    mediaType: params.mediaType || null,
    visibility: params.visibility || 'friends',
    createdAt: serverTimestamp(),
    clientCreatedAt: Date.now(),
    likeCount: 0,
    commentCount: 0,
  });
    return momentDoc.id;
  } catch (error) {
    logError(error, 'createMoment');
    return undefined;
  }
}

export async function fetchUserMoments(userId: string): Promise<Moment[]> {
  if (!userId) return [];
  try {
    const snapshot = await getDocs(query(momentsRef(), where('authorId', '==', userId)));
    const moments = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Moment, 'id'>),
    })) as Moment[];
    moments.sort((a, b) => {
      const aTime =
        (a.updatedAt as any)?.toMillis?.() ??
        (a.updatedAt as any)?.toDate?.()?.getTime?.() ??
        (a.createdAt as any)?.toMillis?.() ??
        (a.createdAt as any)?.toDate?.()?.getTime?.() ??
        (typeof a.createdAt === 'number' ? a.createdAt : 0) ??
        a.clientCreatedAt ??
        0;
      const bTime =
        (b.updatedAt as any)?.toMillis?.() ??
        (b.updatedAt as any)?.toDate?.()?.getTime?.() ??
        (b.createdAt as any)?.toMillis?.() ??
        (b.createdAt as any)?.toDate?.()?.getTime?.() ??
        (typeof b.createdAt === 'number' ? b.createdAt : 0) ??
        b.clientCreatedAt ??
        0;
      if (bTime === aTime) {
        return b.id.localeCompare(a.id);
      }
      return bTime - aTime;
    });
    return moments;
  } catch (error) {
    logError(error, 'fetchUserMoments');
    return [];
  }
}

export async function fetchMomentsForAuthors(
  currentUserId: string,
  friendIds: string[],
): Promise<Moment[]> {
  if (!currentUserId) return [];
  const uniqueFriends = Array.from(new Set(friendIds)).filter(id => id && id !== currentUserId);
  const chunkSize = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueFriends.length; i += chunkSize) {
    chunks.push(uniqueFriends.slice(i, i + chunkSize));
  }

  const resultsByKey = new Map<string, Moment[]>();
  const attachSnapshot = (key: string, snapshot: any) => {
    if (!snapshot) {
      resultsByKey.set(key, []);
      return;
    }
    const moments = snapshot.docs.map((docSnap: any) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Moment, 'id'>),
    })) as Moment[];
    resultsByKey.set(key, moments);
  };

  const tasks: Promise<void>[] = [];

  tasks.push(
    getDocs(query(momentsRef(), where('authorId', '==', currentUserId)))
      .then(snapshot => attachSnapshot('self', snapshot))
      .catch(error => {
        logError(error, 'fetchMomentsForAuthors');
        resultsByKey.set('self', []);
      }),
  );

  chunks.forEach((chunk, index) => {
    tasks.push(
      getDocs(query(momentsRef(), where('authorId', 'in', chunk), where('visibility', '==', 'public')))
        .then(snapshot => attachSnapshot(`public-${index}`, snapshot))
        .catch(error => {
          logError(error, 'fetchMomentsForAuthors');
          resultsByKey.set(`public-${index}`, []);
        }),
    );
    tasks.push(
      getDocs(query(momentsRef(), where('authorId', 'in', chunk), where('visibility', '==', 'friends')))
        .then(snapshot => attachSnapshot(`friends-${index}`, snapshot))
        .catch(error => {
          logError(error, 'fetchMomentsForAuthors');
          resultsByKey.set(`friends-${index}`, []);
        }),
    );
  });

  await Promise.all(tasks);

  const mergedMap = new Map<string, Moment>();
  resultsByKey.forEach(list => {
    list.forEach(item => mergedMap.set(item.id, item));
  });
  const merged = Array.from(mergedMap.values()).sort((a, b) => {
    const aTime =
      (a.updatedAt as any)?.toMillis?.() ??
      (a.updatedAt as any)?.toDate?.()?.getTime?.() ??
      (a.createdAt as any)?.toMillis?.() ??
      (a.createdAt as any)?.toDate?.()?.getTime?.() ??
      (typeof a.createdAt === 'number' ? a.createdAt : 0) ??
      a.clientCreatedAt ??
      0;
    const bTime =
      (b.updatedAt as any)?.toMillis?.() ??
      (b.updatedAt as any)?.toDate?.()?.getTime?.() ??
      (b.createdAt as any)?.toMillis?.() ??
      (b.createdAt as any)?.toDate?.()?.getTime?.() ??
      (typeof b.createdAt === 'number' ? b.createdAt : 0) ??
      b.clientCreatedAt ??
      0;
    if (bTime === aTime) {
      return b.id.localeCompare(a.id);
    }
    return bTime - aTime;
  });
  return merged;
}

export async function updateMoment(
  momentId: string,
  updates: {
    text?: string;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video' | null;
    visibility?: MomentVisibility;
  },
) {
  if (!momentId) return;
  try {
    await setDoc(
      doc(momentsRef(), momentId),
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      {merge: true},
    );
  } catch (error) {
    logError(error, 'updateMoment');
  }
}

export async function deleteMoment(momentId: string, mediaUrl?: string | null) {
  if (!momentId) return;
  try {
    if (mediaUrl) {
      await deleteObject(ref(storage, mediaUrl)).catch(() => undefined);
    }
    await deleteDoc(doc(momentsRef(), momentId));
  } catch (error) {
    logError(error, 'deleteMoment');
  }
}

export async function likeMoment(momentId: string, userId: string) {
  if (!momentId || !userId) return;
  const likeRef = doc(momentLikesRef(momentId), userId);
  try {
    await runTransaction(db, async tx => {
    const likeSnap = await tx.get(likeRef);
    if (likeSnap.exists()) return;
    tx.set(likeRef, {createdAt: serverTimestamp()});
    tx.set(doc(momentsRef(), momentId), {likeCount: increment(1)}, {merge: true});
  });
  } catch (error) {
    logError(error, 'likeMoment');
  }
}

export async function unlikeMoment(momentId: string, userId: string) {
  if (!momentId || !userId) return;
  const likeRef = doc(momentLikesRef(momentId), userId);
  try {
    await runTransaction(db, async tx => {
    const likeSnap = await tx.get(likeRef);
    if (!likeSnap.exists()) return;
    tx.delete(likeRef);
    tx.set(doc(momentsRef(), momentId), {likeCount: increment(-1)}, {merge: true});
  });
  } catch (error) {
    logError(error, 'unlikeMoment');
  }
}

export function listenMomentLikes(
  momentId: string,
  userId: string,
  callback: (payload: {count: number; liked: boolean}) => void,
) {
  if (!momentId) {
    callback({count: 0, liked: false});
    return () => {};
  }
  return onSnapshot(
    momentLikesRef(momentId),
    snapshot => {
      if (!snapshot) {
        callback({count: 0, liked: false});
        return;
      }
      const liked = userId ? snapshot.docs.some(docSnap => docSnap.id === userId) : false;
      callback({count: snapshot.size, liked});
    },
    error => {
      logError(error, 'listenMomentLikes');
      callback({count: 0, liked: false});
    },
  );
}

export async function addMomentComment(
  momentId: string,
  authorId: string,
  text: string,
  mentions: string[] = [],
) {
  if (!momentId || !authorId || !text.trim()) return;
  const commentRef = doc(momentCommentsRef(momentId));
  try {
    await runTransaction(db, async tx => {
    tx.set(commentRef, {
      momentId,
      authorId,
      text: text.trim(),
      mentions,
      createdAt: serverTimestamp(),
    });
    tx.set(doc(momentsRef(), momentId), {commentCount: increment(1)}, {merge: true});
  });
    return commentRef.id;
  } catch (error) {
    logError(error, 'addMomentComment');
    return undefined;
  }
}

export async function deleteMomentComment(momentId: string, commentId: string) {
  if (!momentId || !commentId) return;
  const commentRef = doc(momentCommentsRef(momentId), commentId);
  try {
    await runTransaction(db, async tx => {
    const snapshot = await tx.get(commentRef);
    if (!snapshot.exists()) return;
    tx.delete(commentRef);
    tx.set(doc(momentsRef(), momentId), {commentCount: increment(-1)}, {merge: true});
  });
  } catch (error) {
    logError(error, 'deleteMomentComment');
  }
}

export function listenMomentComments(
  momentId: string,
  callback: (comments: MomentComment[]) => void,
) {
  if (!momentId) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    query(momentCommentsRef(momentId), orderBy('createdAt', 'asc')),
    snapshot => {
      if (!snapshot) {
        callback([]);
        return;
      }
      const comments = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<MomentComment, 'id'>),
      })) as MomentComment[];
      callback(comments);
    },
    error => {
      logError(error, 'listenMomentComments');
      callback([]);
    },
  );
}

export async function uploadMomentMedia(
  authorId: string,
  uri: string,
  mediaType: 'image' | 'video',
  onProgress?: (percent: number) => void,
): Promise<string> {
  const ext = mediaType === 'video' ? 'mp4' : 'jpg';
  const fileName = `${Date.now()}.${ext}`;
  const storageRef = ref(storage, `moments/${authorId}/${fileName}`);
  try {
    let uploadUri = uri;
    if (mediaType === 'image' && isExifStrippingEnabled()) {
      try {
        const resized = await ImageResizer.createResizedImage(
          uri,
          1080,
          1080,
          'JPEG',
          70,
          0,
          undefined,
          false,
          {mode: 'none', onlyScaleDown: true},
        );
        uploadUri = resized.uri || uri;
      } catch {
        // Fall back to original URI if stripping fails
      }
    }
    return uploadFileFromUri(storageRef, uploadUri, onProgress);
  } catch (error) {
    logError(error, 'uploadMomentMedia');
    throw error;
  }
}

export function listenUserMoments(userId: string, callback: (moments: Moment[]) => void) {
  return onSnapshot(
    query(momentsRef(), where('authorId', '==', userId)),
    snapshot => {
      if (!snapshot) {
        callback([]);
        return;
      }
      const moments = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Moment, 'id'>),
      })) as Moment[];
      moments.sort((a, b) => {
        const aTime =
          (a.updatedAt as any)?.toMillis?.() ??
          (a.updatedAt as any)?.toDate?.()?.getTime?.() ??
          (a.createdAt as any)?.toMillis?.() ??
          (a.createdAt as any)?.toDate?.()?.getTime?.() ??
          (typeof a.createdAt === 'number' ? a.createdAt : 0) ??
          a.clientCreatedAt ??
          0;
        const bTime =
          (b.updatedAt as any)?.toMillis?.() ??
          (b.updatedAt as any)?.toDate?.()?.getTime?.() ??
          (b.createdAt as any)?.toMillis?.() ??
          (b.createdAt as any)?.toDate?.()?.getTime?.() ??
          (typeof b.createdAt === 'number' ? b.createdAt : 0) ??
          b.clientCreatedAt ??
          0;
        if (bTime === aTime) {
          return b.id.localeCompare(a.id);
        }
        return bTime - aTime;
      });
      callback(moments);
    },
    error => {
      logError(error, 'listenUserMoments');
      callback([]);
    },
  );
}

export function listenMomentsForAuthors(
  currentUserId: string,
  friendIds: string[],
  callback: (moments: Moment[]) => void,
) {
  if (!currentUserId) {
    callback([]);
    return () => {};
  }

  const uniqueFriends = Array.from(new Set(friendIds)).filter(id => id && id !== currentUserId);
  const chunkSize = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueFriends.length; i += chunkSize) {
    chunks.push(uniqueFriends.slice(i, i + chunkSize));
  }

  const resultsByKey = new Map<string, Moment[]>();
  const mergeAndEmit = () => {
    const mergedMap = new Map<string, Moment>();
    resultsByKey.forEach(list => {
      list.forEach(item => mergedMap.set(item.id, item));
    });
    const merged = Array.from(mergedMap.values()).sort((a, b) => {
      const aTime =
        (a.updatedAt as any)?.toMillis?.() ??
        (a.updatedAt as any)?.toDate?.()?.getTime?.() ??
        (a.createdAt as any)?.toMillis?.() ??
        (a.createdAt as any)?.toDate?.()?.getTime?.() ??
        (typeof a.createdAt === 'number' ? a.createdAt : 0) ??
        a.clientCreatedAt ??
        0;
      const bTime =
        (b.updatedAt as any)?.toMillis?.() ??
        (b.updatedAt as any)?.toDate?.()?.getTime?.() ??
        (b.createdAt as any)?.toMillis?.() ??
        (b.createdAt as any)?.toDate?.()?.getTime?.() ??
        (typeof b.createdAt === 'number' ? b.createdAt : 0) ??
        b.clientCreatedAt ??
        0;
      if (bTime === aTime) {
        return b.id.localeCompare(a.id);
      }
      return bTime - aTime;
    });
    callback(merged);
  };

  const unsubscribers: Array<() => void> = [];

  const attachSnapshot = (key: string, snapshot: any) => {
    if (!snapshot) {
      resultsByKey.set(key, []);
      mergeAndEmit();
      return;
    }
    const moments = snapshot.docs.map((docSnap: any) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Moment, 'id'>),
    })) as Moment[];
    resultsByKey.set(key, moments);
    mergeAndEmit();
  };

  unsubscribers.push(
    onSnapshot(
      query(momentsRef(), where('authorId', '==', currentUserId)),
      snapshot => attachSnapshot('self', snapshot),
      error => {
        logError(error, 'listenMomentsForAuthors');
        resultsByKey.set('self', []);
        mergeAndEmit();
      },
    ),
  );

  chunks.forEach((chunk, index) => {
    unsubscribers.push(
      onSnapshot(
        query(momentsRef(), where('authorId', 'in', chunk), where('visibility', '==', 'public')),
        snapshot => attachSnapshot(`public-${index}`, snapshot),
        error => {
          logError(error, 'listenMomentsForAuthors');
          resultsByKey.set(`public-${index}`, []);
          mergeAndEmit();
        },
      ),
    );
    unsubscribers.push(
      onSnapshot(
        query(momentsRef(), where('authorId', 'in', chunk), where('visibility', '==', 'friends')),
        snapshot => attachSnapshot(`friends-${index}`, snapshot),
        error => {
          logError(error, 'listenMomentsForAuthors');
          resultsByKey.set(`friends-${index}`, []);
          mergeAndEmit();
        },
      ),
    );
  });

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

