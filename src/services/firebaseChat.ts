import {
  collection,
  deleteField,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import {getStorage, getDownloadURL, putFile, ref} from '@react-native-firebase/storage';
import {Message, ChatRoom, User, CallSession, CallType} from '../types';
import {reportError} from './telemetry';
import {isStealthMode} from './privacyGuard';
import {decryptWithPassphrase, encryptWithPassphrase} from './crypto';
import {assertRecipientReachable} from './recipient';

const db = getFirestore();
const storage = getStorage();
const chatsRef = () => collection(db, 'chats');
const usersRef = () => collection(db, 'users');
const callsRef = (chatId: string) => collection(doc(chatsRef(), chatId), 'calls');
const USER_CACHE_MAX = 200;
const userCache = new Map<string, Promise<User | null>>();
const USER_QUERY_BATCH = 10;

function userCacheSet(key: string, value: Promise<User | null>) {
  if (userCache.size >= USER_CACHE_MAX) {
    const oldest = userCache.keys().next().value;
    if (oldest !== undefined) userCache.delete(oldest);
  }
  userCache.set(key, value);
}

const isPermissionDenied = (error: any) =>
  error?.code === 'firestore/permission-denied' || error?.code === 'permission-denied';

const logError = (error: unknown, context: string) => {
  if (__DEV__) {
    console.error(context, error);
  }
  reportError(error, context);
};

const deleteCollectionInBatches = async (colRef: any) => {
  let iterations = 0;
  const MAX_ITERATIONS = 50;
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const snapshot = await getDocs(query(colRef, limit(300)));
    if (snapshot.empty) break;
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
  }
};

export function clearUserCache() {
  userCache.clear();
}

function stripUndefined(value: any): any {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter(v => v !== undefined);
  }
  if (value && typeof value === 'object') {
    if (value.constructor && value.constructor !== Object) {
      return value;
    }
    const cleaned: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      const next = stripUndefined(val);
      if (next !== undefined) {
        cleaned[key] = next;
      }
    });
    return cleaned;
  }
  return value;
}

export async function upsertUserProfile(user: User) {
  await setDoc(
    doc(usersRef(), user.uid),
    {
      uid: user.uid,
      // Normalize to lowercase so the account stays discoverable by email —
      // this runs on every login, so a mixed-case value here would clobber the
      // normalized email from signup and break friend-request/new-chat lookups.
      email: user.email ? user.email.toLowerCase() : null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      // Push token lives in the owner-only private subcollection now, not on the
      // public profile (which any signed-in user can read). Strip any stale
      // value left on the public doc from older app versions.
      fcmToken: deleteField(),
      profileVisibility: user.profileVisibility || 'public',
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
}

export async function setUserFcmToken(userId: string, token: string | null) {
  await setDoc(
    doc(db, 'users', userId, 'private', 'push'),
    {
      fcmToken: token ?? null,
      fcmUpdatedAt: serverTimestamp(),
    },
    {merge: true},
  );
}

export async function getUserByEmail(email: string) {
  // Stored emails are lowercased (see upsertUserProfile); normalize the query
  // so lookups are case-insensitive, matching the web client.
  const snapshot = await getDocs(query(usersRef(), where('email', '==', email.trim().toLowerCase()), limit(1)));
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as User;
}

export async function searchUsersByEmailOrName(searchTerm: string, maxResults = 5) {
  const trimmed = searchTerm.trim();
  if (!trimmed) return [];
  // Emails are stored lowercased; names are matched as-typed.
  const emailTerm = trimmed.toLowerCase();
  const results: User[] = [];
  const seen = new Set<string>();
  const addResult = (user: User) => {
    if (!user?.uid || seen.has(user.uid)) return;
    seen.add(user.uid);
    results.push(user);
  };

  if (trimmed.includes('@')) {
    const snapshot = await getDocs(query(usersRef(), where('email', '==', emailTerm), limit(maxResults)));
    snapshot.docs.forEach(docSnap => addResult(docSnap.data() as User));
    return results;
  }

  const [emailSnap, nameSnap] = await Promise.all([
    getDocs(query(usersRef(), where('email', '==', emailTerm), limit(maxResults))),
    getDocs(query(usersRef(), where('displayName', '==', trimmed), limit(maxResults))),
  ]);

  emailSnap.docs.forEach(docSnap => addResult(docSnap.data() as User));
  nameSnap.docs.forEach(docSnap => addResult(docSnap.data() as User));
  return results.slice(0, maxResults);
}

export async function getUserById(uid: string) {
  if (!uid) return null;
  const cached = userCache.get(uid);
  if (cached) {
    return cached;
  }
  const fetchPromise = getDoc(doc(usersRef(), uid))
    .then(snapshot => (snapshot.exists ? ({uid: snapshot.id, ...(snapshot.data() as User)}) : null))
    .catch(error => {
      if (isPermissionDenied(error)) {
        const restricted = Promise.resolve<User | null>(null);
        userCacheSet(uid, restricted);
        return null;
      }
      userCache.delete(uid);
      throw error;
    });
  userCacheSet(uid, fetchPromise);
  return fetchPromise;
}

export async function getUsersByIds(userIds: string[]): Promise<Record<string, User | null>> {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  const results: Record<string, User | null> = {};
  const pending: string[] = [];

  await Promise.all(
    uniqueIds.map(async id => {
      const cached = userCache.get(id);
      if (cached) {
        results[id] = await cached;
      } else {
        pending.push(id);
      }
    }),
  );

  if (!pending.length) {
    return results;
  }

  const chunks: string[][] = [];
  for (let i = 0; i < pending.length; i += USER_QUERY_BATCH) {
    chunks.push(pending.slice(i, i + USER_QUERY_BATCH));
  }

  await Promise.all(
    chunks.map(async chunk => {
      try {
        const snapshot = await getDocs(query(usersRef(), where('__name__', 'in', chunk)));
        const found = new Set<string>();
        snapshot.docs.forEach(docSnap => {
          const data = {uid: docSnap.id, ...(docSnap.data() as User)};
          results[docSnap.id] = data;
          userCacheSet(docSnap.id, Promise.resolve(data));
          found.add(docSnap.id);
        });
        chunk.forEach(id => {
          if (!found.has(id)) {
            results[id] = null;
            userCacheSet(id, Promise.resolve(null));
          }
        });
      } catch (error: any) {
        if (!isPermissionDenied(error)) {
          throw error;
        }
        // If batch query is blocked by rules for some users, fall back to per-user reads.
        await Promise.all(
          chunk.map(async id => {
            try {
              const snap = await getDoc(doc(usersRef(), id));
              const data = snap.exists ? ({uid: snap.id, ...(snap.data() as User)}) : null;
              results[id] = data;
              userCacheSet(id, Promise.resolve(data));
            } catch (singleError: any) {
              if (isPermissionDenied(singleError)) {
                results[id] = null;
                userCacheSet(id, Promise.resolve(null));
                return;
              }
              throw singleError;
            }
          }),
        );
      }
    }),
  );

  return results;
}

export async function getChat(chatId: string) {
  const snapshot = await getDoc(doc(chatsRef(), chatId));
  return snapshot.exists ? ({id: snapshot.id, ...(snapshot.data() as ChatRoom)}) : null;
}

export function listenChatsForUser(userId: string, callback: (chats: ChatRoom[]) => void) {
  return onSnapshot(
    query(chatsRef(), where('participants', 'array-contains', userId), orderBy('updatedAt', 'desc')),
    snapshot => {
      if (!snapshot) {
        callback([]);
        return;
      }
      const chats = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ChatRoom[];
      callback(chats);
    },
    error => {
      if (isPermissionDenied(error)) {
        if (__DEV__) {
          console.warn('listenChatsForUser: permission denied (session may have ended)');
        }
        return;
      }
      logError(error, 'listenChatsForUser');
      callback([]);
    },
  );
}

export async function getChatsForUser(userId: string) {
  const snapshot = await getDocs(query(chatsRef(), where('participants', 'array-contains', userId)));
  return snapshot.docs.map(docSnap => ({id: docSnap.id, ...(docSnap.data() as ChatRoom)}));
}

export function listenMessages(chatId: string, callback: (messages: Message[]) => void) {
  const messagesRef = collection(doc(chatsRef(), chatId), 'messages');
  return onSnapshot(
    query(messagesRef, orderBy('createdAt', 'desc'), limit(50)),
    snapshot => {
      if (!snapshot) {
        callback([]);
        return;
      }
      const messages = snapshot.docs.map(docSnap => ({
        _id: docSnap.id,
        ...docSnap.data(),
        createdAtRaw: docSnap.get('createdAt'),
      })) as Message[];
      callback(messages);
    },
    error => {
      if (isPermissionDenied(error)) {
        if (__DEV__) {
          console.warn('listenMessages: permission denied (session may have ended)');
        }
        return;
      }
      logError(error, 'listenMessages');
      callback([]);
    },
  );
}

export async function getMessagesPage(
  chatId: string,
  cursor: any | null,
  pageSize = 50,
) {
  const messagesRef = collection(doc(chatsRef(), chatId), 'messages');
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)];
  if (cursor) {
    constraints.splice(1, 0, startAfter(cursor));
  }
  const snapshot = await getDocs(query(messagesRef, ...constraints));
  const messages = snapshot.docs.map(docSnap => ({
    _id: docSnap.id,
    ...docSnap.data(),
    createdAtRaw: docSnap.get('createdAt'),
  })) as Message[];
  return messages;
}

export function listenChat(chatId: string, callback: (chat: ChatRoom | null) => void) {
  return onSnapshot(
    doc(chatsRef(), chatId),
    snapshot => {
      if (!snapshot?.exists) {
        callback(null);
        return;
      }
      callback({id: snapshot.id, ...(snapshot.data() as ChatRoom)});
    },
    error => {
      logError(error, 'listenChat');
      callback(null);
    },
  );
}

export async function createChat(participants: string[], name?: string) {
  try {
    const ref = doc(chatsRef());
    await setDoc(ref, {
      participants,
      name: name || 'Chat',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      pinnedBy: [],
      mutedBy: [],
      pinnedMessageIds: [],
      lastReadAt: {},
      themeBy: {},
      typingBy: {},
    });
    return ref.id;
  } catch (error) {
    logError(error, 'createChat');
    throw error;
  }
}

/**
 * Sends a message.
 *
 * Throws RecipientUnreachableError if the other participant deleted their
 * account. The check lives here rather than in the composer because this screen
 * has more than a dozen send paths — text, GIF, image, video, voice, gesture,
 * lottery, scheduled, moment share — and a guard in the UI would have to be
 * repeated correctly at every one of them.
 */
export async function sendMessage(chatId: string, message: Message) {
  await assertRecipientReachable(chatId, String(message.user._id));

  const messageData = {
    ...message,
    createdAt: serverTimestamp(),
  };
  const messageRef = doc(collection(doc(chatsRef(), chatId), 'messages'), String(message._id));
  await setDoc(messageRef, stripUndefined(messageData));
  await runTransaction(db, async tx => {
    const chatRef = doc(chatsRef(), chatId);
    const snapshot = await tx.get(chatRef);
    if (!snapshot.exists) return;
    const chat = snapshot.data() as ChatRoom;
    const unreadCountBy = {...(chat.unreadCountBy || {})};
    chat.participants.forEach(uid => {
      if (uid === message.user._id) {
        unreadCountBy[uid] = 0;
      } else {
        unreadCountBy[uid] = (unreadCountBy[uid] || 0) + 1;
      }
    });
    // An E2EE-sealed message (see encryptOutgoingMessage in ChatScreen.tsx) has
    // already had text/image/video/audio/file.uri cleared by this point — only
    // the encryptedX sibling is set. Without this check, the chat list would
    // show a blank preview for the most recent message in an encrypted
    // conversation, on both mobile and web (both read this same field).
    const isEncrypted = !!(
      message.encrypted ||
      message.encryptedImage ||
      message.encryptedVideo ||
      message.encryptedAudio ||
      message.encryptedFileUri
    );
    tx.set(
      chatRef,
      {
        lastMessage: {
          text:
            message.text ||
            (message.moment ? 'Shared a moment' : isEncrypted ? '🔒 Encrypted message' : ''),
          createdAt: serverTimestamp(),
          image: message.image || null,
          video: message.video || null,
          audio: message.audio || null,
          file: message.file || null,
          moment: message.moment || null,
        },
        updatedAt: serverTimestamp(),
        unreadCountBy,
        lastReadAt: {
          ...(chat.lastReadAt || {}),
          [message.user._id]: Date.now(),
        },
      },
      {merge: true},
    );
  });
}

export async function updateMessage(chatId: string, messageId: string | number, updates: Partial<Message>) {
  await setDoc(doc(collection(doc(chatsRef(), chatId), 'messages'), String(messageId)), stripUndefined(updates), {
    merge: true,
  });
}

/**
 * Hard-deletes one or more messages — fully removes the documents (no
 * soft-delete flag), in 450-op batches, then refreshes the chat's lastMessage
 * preview so the chat list doesn't show a just-deleted message.
 */
export async function deleteMessages(chatId: string, messageIds: Array<string | number>): Promise<void> {
  const ids = [...new Set(messageIds.map(String))].filter(Boolean);
  const messagesRef = collection(doc(chatsRef(), chatId), 'messages');
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 450)) {
      batch.delete(doc(messagesRef, id));
    }
    await batch.commit();
  }
  await recomputeChatLastMessage(chatId).catch(() => undefined);
}

/** Rebuilds the chat's lastMessage preview from the newest remaining message. */
export async function recomputeChatLastMessage(chatId: string): Promise<void> {
  const messagesRef = collection(doc(chatsRef(), chatId), 'messages');
  const snap = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(1)));
  const chatRef = doc(chatsRef(), chatId);
  if (snap.empty) {
    await setDoc(
      chatRef,
      {lastMessage: {text: '', createdAt: null, image: null, video: null, audio: null, file: null, moment: null}},
      {merge: true},
    );
    return;
  }
  const m = snap.docs[0].data() as Message;
  await setDoc(
    chatRef,
    {
      lastMessage: {
        text: m.text || (m.moment ? 'Shared a moment' : ''),
        createdAt: m.createdAt ?? serverTimestamp(),
        image: m.image || null,
        video: m.video || null,
        audio: m.audio || null,
        file: m.file || null,
        moment: m.moment || null,
      },
    },
    {merge: true},
  );
}

export async function burnMessage(chatId: string, messageId: string | number) {
  const msgRef = doc(collection(doc(chatsRef(), chatId), 'messages'), String(messageId));
  await setDoc(
    msgRef,
    {
      text: '',
      image: null,
      video: null,
      videoDuration: null,
      audio: null,
      audioDuration: null,
      file: null,
      linkPreview: null,
      moment: null,
      burnAfterReading: {burned: true},
    },
    {merge: true},
  );
}

export async function toggleReaction(
  chatId: string,
  messageId: string | number,
  emoji: string,
  userId: string,
) {
  const ref = doc(collection(doc(chatsRef(), chatId), 'messages'), String(messageId));
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return;
    const message = snapshot.data() as Message;
    const reactions = message.reactions || {};
    const users = new Set(reactions[emoji] || []);
    if (users.has(userId)) {
      users.delete(userId);
    } else {
      users.add(userId);
    }
    reactions[emoji] = Array.from(users);
    tx.set(ref, {reactions}, {merge: true});
  });
}

export async function togglePinMessage(chatId: string, messageId: string | number) {
  const ref = doc(chatsRef(), chatId);
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return;
    const chat = snapshot.data() as ChatRoom;
    const pinned = new Set(chat.pinnedMessageIds || []);
    if (pinned.has(messageId)) {
      pinned.delete(messageId);
    } else {
      pinned.add(messageId);
    }
    tx.set(ref, {pinnedMessageIds: Array.from(pinned)}, {merge: true});
  });
}

export async function togglePinChat(chatId: string, userId: string) {
  const ref = doc(chatsRef(), chatId);
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return;
    const chat = snapshot.data() as ChatRoom;
    const pinnedBy = new Set(chat.pinnedBy || []);
    if (pinnedBy.has(userId)) {
      pinnedBy.delete(userId);
    } else {
      pinnedBy.add(userId);
    }
    tx.set(ref, {pinnedBy: Array.from(pinnedBy)}, {merge: true});
  });
}

export async function toggleMuteChat(chatId: string, userId: string) {
  const ref = doc(chatsRef(), chatId);
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return;
    const chat = snapshot.data() as ChatRoom;
    const mutedBy = new Set(chat.mutedBy || []);
    if (mutedBy.has(userId)) {
      mutedBy.delete(userId);
    } else {
      mutedBy.add(userId);
    }
    tx.set(ref, {mutedBy: Array.from(mutedBy)}, {merge: true});
  });
}

export async function setChatTheme(chatId: string, userId: string, color: string) {
  await setDoc(doc(chatsRef(), chatId), {themeBy: {[userId]: color}}, {merge: true});
}

export async function setChatWallpaper(chatId: string, userId: string, wallpaper: string | null) {
  await setDoc(doc(chatsRef(), chatId), {wallpaperBy: {[userId]: wallpaper}}, {merge: true});
}

export async function setChatName(chatId: string, userId: string, name: string | null) {
  await setDoc(
    doc(chatsRef(), chatId),
    {
      nameBy: {
        [userId]: name,
      },
    },
    {merge: true},
  );
}

export async function createCall(
  chatId: string,
  fromUserId: string,
  toUserId: string,
  type: CallType,
) {
  const ref = doc(callsRef(chatId));
  const payload: CallSession = {
    id: ref.id,
    chatId,
    participants: [fromUserId, toUserId],
    createdBy: fromUserId,
    type,
    status: 'ringing',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload as any);
  return ref.id;
}

export async function updateCall(chatId: string, callId: string, updates: Partial<CallSession>) {
  const payload = stripUndefined({
    ...updates,
    updatedAt: serverTimestamp(),
    ...(updates.status === 'ended' ? {endedAt: serverTimestamp()} : {}),
  });
  await setDoc(doc(callsRef(chatId), callId), payload, {merge: true});
  if (updates.status === 'ended') {
    cleanupCallCandidates(chatId, callId).catch(error => logError(error, 'cleanupCallCandidates'));
  }
}

export function listenCall(
  chatId: string,
  callId: string,
  callback: (call: CallSession | null) => void,
) {
  return onSnapshot(
    doc(callsRef(chatId), callId),
    snapshot => {
      if (!snapshot?.exists) {
        callback(null);
        return;
      }
      callback({id: snapshot.id, ...(snapshot.data() as CallSession)});
    },
    error => {
      logError(error, 'listenCall');
      callback(null);
    },
  );
}

export function listenLatestCall(
  chatId: string,
  callback: (call: CallSession | null) => void,
) {
  return onSnapshot(
    query(callsRef(chatId), orderBy('createdAt', 'desc'), limit(1)),
    snapshot => {
      if (!snapshot || snapshot.empty) {
        callback(null);
        return;
      }
      const docSnap = snapshot.docs[0];
      callback({id: docSnap.id, ...(docSnap.data() as CallSession)});
    },
    error => {
      if (isPermissionDenied(error)) {
        if (__DEV__) {
          console.warn(`listenLatestCall: permission denied for chat ${chatId}`);
        }
      } else {
        logError(error, 'listenLatestCall');
      }
      callback(null);
    },
  );
}

export async function addCallCandidate(
  chatId: string,
  callId: string,
  fromUserId: string,
  candidate: any,
) {
  const candidateRef = doc(collection(doc(callsRef(chatId), callId), 'candidates'));
  await setDoc(candidateRef, {
    from: fromUserId,
    candidate,
    createdAt: serverTimestamp(),
  });
}

export async function cleanupCallCandidates(chatId: string, callId: string) {
  try {
    const candidatesRef = collection(doc(callsRef(chatId), callId), 'candidates');
    await deleteCollectionInBatches(candidatesRef);
  } catch (error) {
    logError(error, 'cleanupCallCandidates');
    throw error;
  }
}

export async function cleanupStaleCalls(chatId: string, olderThanMs = 24 * 60 * 60 * 1000) {
  const snapshot = await getDocs(query(callsRef(chatId), where('status', '==', 'ended'), limit(50)));
  if (snapshot.empty) return;
  const cutoff = Date.now() - olderThanMs;
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as CallSession;
    const endedAt = (data.endedAt as any)?.toDate?.()
      ? (data.endedAt as any).toDate().getTime()
      : data.endedAt
      ? new Date(data.endedAt as any).getTime()
      : data.updatedAt
      ? new Date(data.updatedAt as any).getTime()
      : data.createdAt
      ? new Date(data.createdAt as any).getTime()
      : 0;
    if (endedAt && endedAt < cutoff) {
      await cleanupCallCandidates(chatId, docSnap.id);
      await deleteDoc(docSnap.ref);
    }
  }
}
export function listenCallCandidates(
  chatId: string,
  callId: string,
  callback: (candidate: any, from: string) => void,
) {
  return onSnapshot(
    collection(doc(callsRef(chatId), callId), 'candidates'),
    snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const data = change.doc.data() as {candidate: any; from: string};
        if (data?.candidate && data?.from) {
          callback(data.candidate, data.from);
        }
      });
    },
    error => {
      logError(error, 'listenCallCandidates');
    },
  );
}

export async function setLastRead(chatId: string, userId: string) {
  if (isStealthMode()) return;
  try {
    const {updateReadReceipt} = require('./readReceipts');
    updateReadReceipt(chatId, userId);
    await setDoc(
      doc(chatsRef(), chatId),
      {
        unreadCountBy: {[userId]: 0},
      },
      {merge: true},
    );
  } catch (error) {
    if (isPermissionDenied(error)) {
      if (__DEV__) {
        console.warn('setLastRead: permission denied (session may have ended)');
      }
      return;
    }
    logError(error, 'setLastRead');
    throw error;
  }
}

export async function setTyping(chatId: string, userId: string, isTyping: boolean) {
  if (isStealthMode()) return;
  const ref = doc(chatsRef(), chatId);
  if (isTyping) {
    await setDoc(ref, {typingBy: {[userId]: Date.now()}}, {merge: true});
  } else {
    await setDoc(ref, {typingBy: {[userId]: 0}}, {merge: true});
  }
}

export async function uploadFile(
  chatId: string,
  uri: string,
  path: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const storageRef = ref(storage, `chats/${chatId}/${path}`);
  const task = putFile(storageRef, uri);
  if (onProgress) {
    task.on('state_changed', snapshot => {
      const total = snapshot.totalBytes || 0;
      const transferred = snapshot.bytesTransferred || 0;
      if (total > 0) {
        const percent = Math.min(100, Math.round((transferred / total) * 100));
        onProgress(percent);
      }
    });
  }
  await task;
  return await getDownloadURL(storageRef);
}

export async function deleteChat(chatId: string) {
  try {
    const chatDoc = doc(chatsRef(), chatId);
    const messagesRef = collection(chatDoc, 'messages');
    const callsCollection = callsRef(chatId);

    await deleteCollectionInBatches(messagesRef);

    const callsSnapshot = await getDocs(callsCollection);
    for (const callDoc of callsSnapshot.docs) {
      const candidatesRef = collection(callDoc.ref, 'candidates');
      await deleteCollectionInBatches(candidatesRef);
    }
    await deleteCollectionInBatches(callsCollection);
    await deleteDoc(chatDoc);
  } catch (error) {
    logError(error, 'deleteChat');
    throw error;
  }
}

export async function exportChat(chatId: string) {
  const chatDoc = await getDoc(doc(chatsRef(), chatId));
  const messagesSnap = await getDocs(collection(doc(chatsRef(), chatId), 'messages'));
  return {
    chat: chatDoc.data(),
    messages: messagesSnap.docs.map(doc => ({_id: doc.id, ...doc.data()})),
  };
}

/**
 * Exports the signed-in user's own data: their profile, the chats they take
 * part in, and those chats' messages.
 *
 * This previously called `getDocs(usersRef())` with no filter. Because the
 * Firestore rules let any signed-in user read any profile, "export my data"
 * actually pulled *every user account in the database* into the file. The
 * chats query was unscoped too. Both are now filtered to the caller.
 */
export async function exportAll(userId: string) {
  if (!userId) throw new Error('exportAll requires the signed-in user id');
  try {
    const selfSnap = await getDoc(doc(usersRef(), userId));
    const chatsSnap = await getDocs(
      query(chatsRef(), where('participants', 'array-contains', userId)),
    );
    const messages: Record<string, any[]> = {};
    for (const chat of chatsSnap.docs) {
      const msgSnap = await getDocs(collection(doc(chatsRef(), chat.id), 'messages'));
      messages[chat.id] = msgSnap.docs.map(d => ({_id: d.id, ...d.data()}));
    }
    return {
      // RN Firebase exposes `exists` as a property, not a method (unlike the
      // firebase-js web SDK, where it is `exists()`).
      users: selfSnap.exists ? [selfSnap.data()] : [],
      chats: chatsSnap.docs.map(d => ({id: d.id, ...d.data()})),
      messages,
    };
  } catch (error) {
    logError(error, 'exportAll');
    throw error;
  }
}

export const MIN_BACKUP_PASSPHRASE_LENGTH = 12;

/**
 * Encrypts a backup with a user-supplied passphrase (scrypt → XChaCha20-Poly1305,
 * see services/crypto.ts).
 *
 * The previous "CBXENC1" format was not encryption: it XOR'd each character
 * against a keystream derived from a 32-bit string hash, so the plaintext was
 * recoverable from the ciphertext alone (the payload is JSON, so an attacker
 * knows it starts with `{"users":`). It was also always invoked with the
 * hardcoded passphrase "chatterbox", meaning there was no user secret at all.
 * CBXENC1 is still *readable* below so existing backups aren't stranded, but it
 * is never produced again.
 */
export async function encryptedExportAll(userId: string, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
    throw new Error(`passphrase must be at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters`);
  }
  const data = await exportAll(userId);
  return `CBXENC2:${encryptWithPassphrase(JSON.stringify(data), passphrase)}`;
}

export async function decryptedImportAll(encrypted: string, passphrase: string): Promise<void> {
  if (encrypted.startsWith('CBXENC2:')) {
    // Throws on a wrong passphrase or tampered payload (Poly1305 verification).
    const json = decryptWithPassphrase(encrypted.slice('CBXENC2:'.length), passphrase);
    return importAll(JSON.parse(json));
  }

  if (encrypted.startsWith('CBXENC1:')) {
    // Legacy read path only. These backups were produced with the broken XOR
    // scheme under the fixed passphrase "chatterbox"; the argument is ignored
    // because it was never actually variable.
    const encoded = decodeURIComponent(escape(atob(encrypted.slice('CBXENC1:'.length))));
    const legacyPassphrase = 'chatterbox';
    let key = 0;
    for (let i = 0; i < legacyPassphrase.length; i++) {
      key = ((key << 5) - key + legacyPassphrase.charCodeAt(i)) | 0;
    }
    const json = Array.from(encoded)
      .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ ((key + i * 31) & 0xff)))
      .join('');
    return importAll(JSON.parse(json));
  }

  return importAll(JSON.parse(encrypted));
}

export async function importChat(chatId: string, payload: {chat?: ChatRoom; messages?: Message[]}) {
  if (payload.chat) {
    await setDoc(doc(chatsRef(), chatId), payload.chat, {merge: true});
  }
  if (payload.messages) {
    const batch = writeBatch(db);
    const msgRef = collection(doc(chatsRef(), chatId), 'messages');
    payload.messages.forEach(msg => {
      const docId = String(msg._id || doc(msgRef).id);
      batch.set(doc(msgRef, docId), msg);
    });
    await batch.commit();
  }
}

export async function importAll(payload: {users?: User[]; chats?: ChatRoom[]; messages?: Record<string, Message[]>}) {
  try {
    if (payload.users) {
      const batch = writeBatch(db);
      payload.users.forEach(u => batch.set(doc(usersRef(), u.uid), u, {merge: true}));
      await batch.commit();
    }
    if (payload.chats) {
      const batch = writeBatch(db);
      payload.chats.forEach(chat => {
        const id = chat.id;
        batch.set(doc(chatsRef(), id), chat, {merge: true});
      });
      await batch.commit();
    }
    if (payload.messages) {
      for (const [chatId, msgs] of Object.entries(payload.messages)) {
        const batch = writeBatch(db);
        const msgRef = collection(doc(chatsRef(), chatId), 'messages');
        msgs.forEach(msg => {
          const docId = String(msg._id || doc(msgRef).id);
          batch.set(doc(msgRef, docId), msg);
        });
        await batch.commit();
      }
    }
  } catch (error) {
    logError(error, 'importAll');
    throw error;
  }
}

