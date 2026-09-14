import {
  arrayRemove,
  arrayUnion,
  type QueryConstraint,
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
} from './firebase/firestore';
import {getStorage, getDownloadURL, ref, deleteObject, uploadFileFromUri} from './firebase/storage';
import {Message, ChatRoom, User, CallSession, CallType} from '../types';
import {reportError} from './errorLog';
import {
  isPermissionDenied,
  isUnsyncedEmpty,
  logError,
  logListenerError,
  onListenerError,
} from './listenerErrors';
import {stripUndefined} from './firestoreValues';
import {isTypingIndicatorEnabled} from './privacyGuard';
import {assertRecipientReachable} from './recipient';
import {resolveMessageMediaUrls} from './messageMedia';
import {MAX_GROUP_MEMBERS} from './e2ee';
import {getDeviceKeypairIfEnrolled} from './e2eeKeys';
import {purgeExpiredTrash, trashMessages} from './messageTrash';

const db = getFirestore();
const storage = getStorage();
const chatsRef = () => collection(db, 'chats');
const usersRef = () => collection(db, 'users');
const callsRef = (chatId: string) => collection(doc(chatsRef(), chatId), 'calls');
const USER_CACHE_MAX = 200;
const userCache = new Map<string, Promise<User | null>>();

function userCacheSet(key: string, value: Promise<User | null>) {
  if (userCache.size >= USER_CACHE_MAX) {
    const oldest = userCache.keys().next().value;
    if (oldest !== undefined) userCache.delete(oldest);
  }
  userCache.set(key, value);
}

const deleteCollectionInBatches = async (colRef: any, ...constraints: any[]) => {
  let iterations = 0;
  const MAX_ITERATIONS = 50;
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    // The constraints go *before* the limit so a filtered sweep still pages.
    const snapshot = await getDocs(query(colRef, ...constraints, limit(300)));
    if (snapshot.empty) break;
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
  }
};

export function clearUserCache() {
  userCache.clear();
}

/**
 * The public half of an account: as little as the app can work with.
 *
 * `email`, `photoURL` and `displayName` all used to live here. The email was
 * the searchable field the directory ran on, and once the directory went (see
 * the note above `getUserById`) it was a real-world identifier sitting on the
 * server for no remaining purpose — readable by anyone who knew the uid, which
 * is everyone you have ever been in a group with. The photo was a Storage URL
 * with the same audience and no expiry.
 *
 * The name went last and could not simply be dropped: a chat list of
 * eight-character uids is not usable. It moved instead — sealed to the person
 * who needs it and stored on the chat, where the server holds a blob it cannot
 * read. See services/introductions.ts.
 *
 * Both are written as `deleteField()` rather than simply omitted, because
 * `merge: true` leaves an omitted field exactly where it was: every account
 * created before this would have kept its address forever. This runs on every
 * sign-in, so an account clears itself the next time its owner opens the app.
 *
 * Firebase Auth still holds the address — it is the credential — and nothing
 * here changes that. What changes is that it is no longer in a document other
 * users can read.
 */
export async function upsertUserProfile(user: User) {
  await setDoc(
    doc(usersRef(), user.uid),
    {
      uid: user.uid,
      email: deleteField(),
      photoURL: deleteField(),
      displayName: deleteField(),
      // Push token lives in the owner-only private subcollection now, not on the
      // public profile (which anyone knowing the uid can read). Strip any stale
      // value left on the public doc from older app versions.
      fcmToken: deleteField(),
      // Same treatment, and the same reason. claimSession used to record a
      // device description here — platform, a stable device id and the OS
      // device name — through the Admin SDK, which the rules do not police.
      // It is no longer written; this clears it off the accounts that already
      // carry one, on their next sign-in.
      deviceInfo: deleteField(),
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

/**
 * There is no lookup by email or by name, on purpose.
 *
 * Both used to live here, and both worked by querying `users` on an indexed
 * plaintext field — which meant any signed-in client could turn a person into
 * the conversations they were in, and meant the server had to keep that field
 * searchable. They were removed on 2026-09-05 along with `list` on `users`
 * (see firestore.rules): reaching someone new is an invite link
 * (services/invites.ts), and reaching someone you already know is
 * services/contacts.ts, which is a projection of chats rather than a query.
 *
 * Do not add either back. A search box here is a directory, whatever it is
 * called, and the rules will refuse the query anyway.
 */
export async function getUserById(uid: string) {
  if (!uid) return null;
  const cached = userCache.get(uid);
  if (cached) {
    return cached;
  }
  const fetchPromise = getDoc(doc(usersRef(), uid))
    .then(snapshot => (snapshot.exists() ? ({...(snapshot.data() as User), uid: snapshot.id}) : null))
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

/**
 * Profiles for a set of uids, one `get` each.
 *
 * This used to batch with `where('__name__', 'in', chunk)`, which Firestore
 * evaluates as a *list* — and `list` on `users` is now denied, because a rule
 * that allows it allows enumerating the directory this app spent a release
 * removing (see firestore.rules and the note above `getUserById`). Every batch
 * would have been refused and fallen through to exactly the per-uid reads
 * below, one round trip later and one permission error louder.
 *
 * The cost is real — N reads instead of N/30 — and it is bounded by the group
 * size cap, paid once, and served from `userCache` afterwards. A read that
 * names the document it wants cannot be turned into a query for everyone.
 */
export async function getUsersByIds(userIds: string[]): Promise<Record<string, User | null>> {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  const results: Record<string, User | null> = {};

  await Promise.all(
    uniqueIds.map(async id => {
      const cached = userCache.get(id);
      if (cached) {
        results[id] = await cached;
        return;
      }
      try {
        const snap = await getDoc(doc(usersRef(), id));
        const data = snap.exists() ? ({...(snap.data() as User), uid: snap.id}) : null;
        results[id] = data;
        userCacheSet(id, Promise.resolve(data));
      } catch (error: any) {
        // A profile this user may not read is indistinguishable from one that
        // is not there, and both mean the same thing to the caller.
        if (!isPermissionDenied(error)) throw error;
        results[id] = null;
        userCacheSet(id, Promise.resolve(null));
      }
    }),
  );

  return results;
}

export async function getChat(chatId: string) {
  const snapshot = await getDoc(doc(chatsRef(), chatId));
  return snapshot.exists() ? ({...(snapshot.data() as ChatRoom), id: snapshot.id}) : null;
}

/** One-off fetch for contexts with no listener, e.g. the FCM background
 * handler decrypting a single message to build a local notification. */
export async function getMessageById(chatId: string, messageId: string) {
  const snapshot = await getDoc(doc(collection(doc(chatsRef(), chatId), 'messages'), messageId));
  return snapshot.exists() ? (snapshot.data() as Message) : null;
}

export function listenChatsForUser(userId: string, callback: (chats: ChatRoom[]) => void) {
  return onSnapshot(
    query(chatsRef(), where('participants', 'array-contains', userId), orderBy('updatedAt', 'desc')),
    snapshot => {
      // No snapshot object at all is "no result", not "no chats" — same
      // distinction onListenerError draws below, and isUnsyncedEmpty draws
      // for an empty first snapshot Firestore served from its own cache.
      if (!snapshot || isUnsyncedEmpty(snapshot)) return;
      const chats = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ChatRoom[];
      callback(chats);
    },
    error => {
      onListenerError(error, 'listenChatsForUser', () => callback([]));
    },
  );
}

export async function getChatsForUser(userId: string) {
  const snapshot = await getDocs(query(chatsRef(), where('participants', 'array-contains', userId)));
  return snapshot.docs.map(docSnap => ({...(docSnap.data() as ChatRoom), id: docSnap.id}));
}

export function listenMessages(chatId: string, callback: (messages: Message[]) => void) {
  const messagesRef = collection(doc(chatsRef(), chatId), 'messages');
  return onSnapshot(
    query(messagesRef, orderBy('createdAt', 'desc'), limit(50)),
    snapshot => {
      // No snapshot object at all is "no result", not "no messages" — nor is
      // an empty first snapshot Firestore served from its own unsynced cache,
      // which is what opened a thread blank and left it there.
      if (!snapshot || isUnsyncedEmpty(snapshot)) return;
      const messages = snapshot.docs.map(docSnap => ({
        _id: docSnap.id,
        ...docSnap.data(),
        createdAtRaw: docSnap.get('createdAt'),
      })) as Message[];
      callback(messages);
    },
    error => {
      onListenerError(error, 'listenMessages', () => callback([]));
    },
  );
}

export async function getMessagesPage(
  chatId: string,
  cursor: any | null,
  pageSize = 50,
) {
  const messagesRef = collection(doc(chatsRef(), chatId), 'messages');
  // Typed as QueryConstraint[] explicitly: RNFB 26 gives each helper its own
  // constraint type (QueryOrderByConstraint, QueryStartAtConstraint, ...), so
  // an inferred array of two becomes a narrow union that rejects the third.
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(pageSize)];
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
      if (!snapshot?.exists()) {
        callback(null);
        return;
      }
      callback({...(snapshot.data() as ChatRoom), id: snapshot.id});
    },
    error => {
      onListenerError(error, 'listenChat', () => callback(null));
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
      typingBy: {},
    });
    return ref.id;
  } catch (error) {
    logError(error, 'createChat');
    throw error;
  }
}

export class GroupFullError extends Error {
  readonly code = 'group-full';
  constructor(message = `a chat can hold at most ${MAX_GROUP_MEMBERS} members`) {
    super(message);
    this.name = 'GroupFullError';
  }
}

/**
 * Adds members to a chat.
 *
 * The cap is checked here *and* in firestore.rules. This check exists to give a
 * usable error before a write is attempted; the rule is what actually enforces
 * it, since anything client-side can be bypassed. Both read MAX_GROUP_MEMBERS
 * so they cannot drift apart.
 *
 * arrayUnion rather than a read-modify-write of the whole array: two people
 * adding someone at the same moment would otherwise clobber each other, and one
 * of the new members would silently never be added — and so would never be
 * sealed to, making them unable to read anything.
 */
export async function addChatMembers(chatId: string, newMemberIds: string[]): Promise<void> {
  const toAdd = Array.from(new Set(newMemberIds.filter(Boolean)));
  if (toAdd.length === 0) return;
  try {
    const chat = await getChat(chatId);
    const current = chat?.participants || [];
    const merged = new Set([...current, ...toAdd]);
    if (merged.size > MAX_GROUP_MEMBERS) throw new GroupFullError();

    await setDoc(
      doc(chatsRef(), chatId),
      {participants: arrayUnion(...toAdd), updatedAt: serverTimestamp()},
      {merge: true},
    );
  } catch (error) {
    if (!(error instanceof GroupFullError)) logError(error, 'addChatMembers');
    throw error;
  }
}

/**
 * Removes the signed-in user from a chat.
 *
 * Only ever yourself: the security rules reject removing anyone else (there are
 * no admin roles, so "anyone may remove anyone" would be the only alternative).
 * Messages already sent stay sealed to the keys they were sealed to — leaving
 * does not retroactively lock you out of history you could already read, and
 * equally does not grant access to anything sent after you go, because senders
 * stop including your copy.
 */
export async function leaveChat(chatId: string, myUserId: string): Promise<void> {
  try {
    await setDoc(
      doc(chatsRef(), chatId),
      {participants: arrayRemove(myUserId), updatedAt: serverTimestamp()},
      {merge: true},
    );
  } catch (error) {
    logError(error, 'leaveChat');
    throw error;
  }
}

/**
 * Sends a message.
 *
 * Throws RecipientUnreachableError if the other participant deleted their
 * account. The check lives here rather than in the composer because this screen
 * has more than a dozen send paths — text, image, video, voice, gesture,
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
    if (!snapshot.exists()) return;
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
            message.text || (isEncrypted ? '🔒 Encrypted message' : ''),
          createdAt: serverTimestamp(),
          image: message.image || null,
          video: message.video || null,
          audio: message.audio || null,
          file: message.file || null,
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
 * preview so the chat list doesn't show a just-deleted message. Also cleans
 * up any Storage media those messages pointed at (decrypting E2EE pointers
 * with the caller's own device key first — see messageMedia.ts), best-effort
 * and only after the Firestore deletion succeeds, so a Storage failure can
 * never leave a live message pointing at broken media.
 */
export async function deleteMessages(
  chatId: string,
  messageIds: Array<string | number>,
  uid: string,
): Promise<void> {
  // Deletion is recoverable: messages move to the chat's trash subcollection
  // and their Storage media is kept until the retention window closes (see
  // services/messageTrash.ts). Mobile must route through the same path as web,
  // or one platform would permanently destroy what the other still offers to
  // recover.
  await trashMessages(chatId, messageIds.map(String), uid);
  await recomputeChatLastMessage(chatId).catch(() => undefined);
  purgeExpiredTrash(chatId, uid).catch(() => undefined);
}

/** Rebuilds the chat's lastMessage preview from the newest remaining message. */
export async function recomputeChatLastMessage(chatId: string): Promise<void> {
  const messagesRef = collection(doc(chatsRef(), chatId), 'messages');
  const snap = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(1)));
  const chatRef = doc(chatsRef(), chatId);
  if (snap.empty) {
    await setDoc(
      chatRef,
      {lastMessage: {text: '', createdAt: null, image: null, video: null, audio: null, file: null}},
      {merge: true},
    );
    return;
  }
  const m = snap.docs[0].data() as Message;
  await setDoc(
    chatRef,
    {
      lastMessage: {
        text: m.text || '',
        createdAt: m.createdAt ?? serverTimestamp(),
        image: m.image || null,
        video: m.video || null,
        audio: m.audio || null,
        file: m.file || null,
      },
    },
    {merge: true},
  );
}

/**
 * Destroys a burn-after-reading message's content once it has been read.
 *
 * This used to clear only the plaintext fields, which meant it destroyed
 * almost nothing in the case the feature exists for. In an encrypted chat the
 * plaintext fields are *already* empty — the content lives in the `encrypted*`
 * siblings — so "burning" an E2EE message left the ciphertext sitting in
 * Firestore intact, still openable by every recipient's device key, while the
 * UI reported it as burned. The clearing has to cover both shapes.
 *
 * Media is deleted from Storage too, for the same reason one layer down: the
 * bytes outlive the message document, and anyone who saw the message before it
 * burned still holds the URL. Best-effort and deliberately after the Firestore
 * write — a Storage failure must not leave a live message pointing at media
 * that is already gone, and the reverse (orphaned bytes) is the recoverable
 * direction.
 */
export async function burnMessage(chatId: string, messageId: string | number, uid: string) {
  const msgRef = doc(collection(doc(chatsRef(), chatId), 'messages'), String(messageId));

  // Resolve media before the fields naming it are cleared.
  let mediaUrls: string[] = [];
  try {
    const snap = await getDoc(msgRef);
    if (snap.exists()) {
      // Non-enrolling: resolving the media a burn should delete is a read.
      // With no key the URLs stay unresolved and the bytes are orphaned —
      // already the documented best-effort outcome here, and a far smaller
      // loss than overwriting the account's published key.
      const keypair = await getDeviceKeypairIfEnrolled(uid);
      if (keypair) {
        mediaUrls = resolveMessageMediaUrls(
          snap.data() as Record<string, unknown>,
          keypair.secretKey,
          chatId,
        );
      }
    }
  } catch {
    // No key, an unreadable pointer, or the message already gone. The content
    // clearing below is the part that must happen regardless.
  }

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
      encrypted: null,
      encryptedImage: null,
      encryptedVideo: null,
      encryptedAudio: null,
      encryptedFileUri: null,
      encryptedLinkPreview: null,
      burnAfterReading: {burned: true},
    },
    {merge: true},
  );

  await Promise.all(mediaUrls.map(url => deleteStorageObjectByUrl(url).catch(() => false)));
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
    if (!snapshot.exists()) return;
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
    if (!snapshot.exists()) return;
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
    if (!snapshot.exists()) return;
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
    if (!snapshot.exists()) return;
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

/**
 * Hides or recovers a chat for one user. Same per-user array shape as pin and
 * mute, so the other participant is unaffected and nothing about the
 * conversation itself changes.
 */
export async function toggleHideChat(chatId: string, userId: string, hidden: boolean) {
  const ref = doc(chatsRef(), chatId);
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return;
    const chat = snapshot.data() as ChatRoom;
    const hiddenBy = new Set(chat.hiddenBy || []);
    if (hidden) {
      hiddenBy.delete(userId);
    } else {
      hiddenBy.add(userId);
    }
    tx.set(ref, {hiddenBy: Array.from(hiddenBy)}, {merge: true});
  });
}

/**
 * Writes your sealed self-introduction onto a chat.
 *
 * Merged into `introBy` under your own uid, so it cannot displace anyone
 * else's — and would not be believed if it did, since the reader checks the
 * envelope's sender key against the peer's published one. See
 * services/introductions.ts.
 */
export async function setChatIntroduction(chatId: string, userId: string, sealed: unknown) {
  await setDoc(doc(chatsRef(), chatId), {introBy: {[userId]: sealed}}, {merge: true});
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
      if (!snapshot?.exists()) {
        callback(null);
        return;
      }
      callback({...(snapshot.data() as CallSession), id: snapshot.id});
    },
    error => {
      onListenerError(error, 'listenCall', () => callback(null));
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
      callback({...(docSnap.data() as CallSession), id: docSnap.id});
    },
    error => {
      onListenerError(error, 'listenLatestCall', () => callback(null));
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
      logListenerError(error, 'listenCallCandidates');
    },
  );
}

export async function setLastRead(chatId: string, userId: string) {
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

/**
 * Publishes the typing indicator. Never rejects.
 *
 * Both callers are fire-and-forget by construction — one is a debounce timer,
 * the other a focus-effect cleanup — so neither awaits this and neither could
 * act on a failure if it did. Left to reject, it surfaced as an unhandled
 * promise rejection: a full-screen red console error in dev, and in release the
 * silent kind that this project has already been bitten by once (see the
 * scheduled-send path, which failed invisibly for exactly this reason).
 *
 * The failure is not hypothetical or rare. Writing the indicator is an update
 * to the chat document, which the rules allow only to a participant, and the
 * cleanup callback fires *as the screen unmounts* — including on the unmount
 * that follows leaving the chat. Leaving therefore ends, reliably, with one
 * denied write for a chat the user just chose to leave.
 *
 * Swallowing is right here rather than lazy: a typing indicator is best-effort
 * presence. A dropped one is invisible, and there is nothing to retry or report
 * to the user. It is still logged, so a *broad* permission failure does not
 * become undetectable.
 */
export async function setTyping(chatId: string, userId: string, isTyping: boolean) {
  // Off by default. `typingBy` is a plaintext record of when this person was at
  // their phone and how long they spent composing — behaviour the message
  // encryption does not cover — so it is written only when asked for.
  if (!isTypingIndicatorEnabled()) return;
  try {
    await setDoc(
      doc(chatsRef(), chatId),
      {typingBy: {[userId]: isTyping ? Date.now() : 0}},
      {merge: true},
    );
  } catch (error) {
    logError(error, 'setTyping');
  }
}

export async function uploadFile(
  chatId: string,
  uri: string,
  path: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const storageRef = ref(storage, `chats/${chatId}/${path}`);
  return uploadFileFromUri(storageRef, uri, onProgress);
}

/**
 * Best-effort delete of a Storage object by its download URL. Never throws.
 * Shared by message-media cleanup (deleteMessages below) and account purge
 * (account.ts) — one primitive for "this URL's object should go away."
 */
export async function deleteStorageObjectByUrl(url: string): Promise<boolean> {
  // Inline media (data: URIs) lives inside the Firestore document itself, so
  // there's no Storage object behind it — and ref() would throw on it.
  if (!url.startsWith('http')) return false;
  try {
    await deleteObject(ref(storage, url));
    return true;
  } catch {
    // Already deleted, or the URL doesn't map to an object in this bucket.
    return false;
  }
}

/**
 * Removes this user from a chat, taking the content that is theirs with them.
 *
 * Replaces a `deleteChat` that swept the whole `messages` collection and then
 * deleted the chat document. That could not work and had not for some time:
 * the message rule allows a delete only by the message's author (see
 * firestore.rules — it was narrowed so one member of a group could not destroy
 * everyone's history), so the sweep hit the other participant's first message
 * and the whole thing failed with permission-denied. The confirmation dialog
 * had been promising to "permanently delete the entire chat history for all
 * participants" the entire time, which the rules make impossible by design.
 *
 * What is actually possible is what this does. Everything authored by this
 * user goes — messages, anything they had scheduled, their own trash — and
 * then they leave. The other participant keeps their own messages and the
 * conversation.
 *
 * Ordering is not incidental: every rule involved is gated on still being a
 * participant, so leaving first would lock this user out of deleting their own
 * content. Leaving is last, and only after the deletes have succeeded.
 *
 * Scheduled messages matter more than they look. Left behind, they would be
 * delivered by processScheduledMessages into a conversation this user is no
 * longer part of, minutes or days after they left it.
 *
 * Deliberately not touched: call records, and the missed-call system notices
 * the rules would technically let any participant remove. Both are shared
 * history rather than this user's content, and the point of this function is
 * that the distinction is now respected.
 */
export async function leaveAndClearOwnContent(chatId: string, myUserId: string) {
  if (!myUserId) throw new Error('leaveAndClearOwnContent requires the signed-in user id');
  try {
    const chatDoc = doc(chatsRef(), chatId);
    const mine = where('user._id', '==', myUserId);

    await deleteCollectionInBatches(collection(chatDoc, 'messages'), mine);
    await deleteCollectionInBatches(collection(chatDoc, 'scheduledMessages'), mine);
    await deleteCollectionInBatches(
      collection(chatDoc, 'trash'),
      where('deletedBy', '==', myUserId),
    );

    await leaveChat(chatId, myUserId);
  } catch (error) {
    logError(error, 'leaveAndClearOwnContent');
    throw error;
  }
}

