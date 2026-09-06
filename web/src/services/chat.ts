import {isReadReceiptsEnabled, isTypingIndicatorEnabled} from './privacyPrefs';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {db} from '../firebase';
import {isUnsyncedEmpty, onListenerError} from './listenerErrors';
import {deleteQueryInChunks} from './firestoreBatch';
import {MAX_GROUP_MEMBERS} from './e2ee';
import {assertRecipientReachable} from './recipient';
import {purgeExpiredTrash, trashMessages} from './messageTrash';
import {resolveMessageMediaUrls} from './messageMedia';
import {getDeviceKeypairIfEnrolled} from './e2eeKeys';
import {deleteStorageObjectByUrl} from './storage';
import type {ChatMessage, ChatRoom, EncryptedField, SealedEnvelopeField, UserProfile} from '../types';

export const MESSAGE_PAGE_SIZE = 30;

// ---- Users -----------------------------------------------------------------

/**
 * The uid comes from the document id, not from the document body.
 *
 * They should always agree — the rules require it — but they are different
 * kinds of fact: the id is where the document lives and cannot be written, the
 * field is something a client wrote. Callers act on the uid by starting a chat
 * with it, so it is taken from the half that cannot be wrong. Mirrors
 * profileFromDoc in the mobile client.
 */
function profileFromDoc(snap: {id: string; data: () => unknown}): UserProfile {
  return {...(snap.data() as UserProfile), uid: snap.id};
}

/**
 * There is no lookup by email or by name, on purpose.
 *
 * `getUserByEmail` lived here and queried `users` on an indexed plaintext
 * field, which meant any signed-in client could turn a person into the
 * conversations they were in. It was removed on 2026-09-05 together with its
 * mobile twin and with `list` on `users` (see firestore.rules). Reaching
 * someone new is an invite link (services/invites.ts); reaching someone you
 * already know is services/contacts.ts, which is a projection of chats rather
 * than a query.
 *
 * Do not add either back. A search box here is a directory whatever it is
 * called, and the rules will refuse the query anyway.
 */
export async function getUserById(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? profileFromDoc(snap) : null;
}

// ---- Chats -----------------------------------------------------------------

export function listenChatsForUser(userId: string, cb: (chats: ChatRoom[]) => void) {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    snap => {
      // Empty *and* from Firestore's own unsynced cache is "not yet", not
      // "no chats" — delivering it empties the list until the server answers.
      if (isUnsyncedEmpty(snap)) return;
      cb(snap.docs.map(d => ({id: d.id, ...(d.data() as Omit<ChatRoom, 'id'>)})));
    },
    err => onListenerError(err, 'listenChatsForUser', () => cb([])),
  );
}

// Matches the mobile app's createChat(participants, name).
export async function createChat(participants: string[], name?: string): Promise<string> {
  const ref = doc(collection(db, 'chats'));
  await setDoc(ref, {
    participants,
    name: name || 'Chat',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    pinnedBy: [],
    mutedBy: [],
  });
  return ref.id;
}

export class GroupFullError extends Error {
  readonly code = 'group-full';
  constructor(message = `a chat can hold at most ${MAX_GROUP_MEMBERS} members`) {
    super(message);
    this.name = 'GroupFullError';
  }
}

/**
 * Adds members to a chat. Mirrors the mobile app's addChatMembers.
 *
 * The cap is checked here *and* in firestore.rules. This check exists to give a
 * usable error before a write is attempted; the rule is what actually enforces
 * it, since anything client-side can be bypassed.
 *
 * arrayUnion rather than a read-modify-write of the whole array: two people
 * adding someone at the same moment would otherwise clobber each other, and one
 * of the new members would silently never be added — and so never be sealed to,
 * leaving them unable to read anything with nothing to indicate why.
 */
export async function addChatMembers(chatId: string, newMemberIds: string[]): Promise<void> {
  const toAdd = Array.from(new Set(newMemberIds.filter(Boolean)));
  if (toAdd.length === 0) return;

  const snap = await getDoc(doc(db, 'chats', chatId));
  const current = (snap.data()?.participants as string[]) || [];
  if (new Set([...current, ...toAdd]).size > MAX_GROUP_MEMBERS) throw new GroupFullError();

  await setDoc(
    doc(db, 'chats', chatId),
    {participants: arrayUnion(...toAdd), updatedAt: serverTimestamp()},
    {merge: true},
  );
}

/**
 * Removes the signed-in user from a chat.
 *
 * Only ever yourself: the rules reject removing anyone else, since there are no
 * admin roles and "anyone may remove anyone" would be the only alternative.
 * Messages already sent stay sealed to the keys they were sealed to, so leaving
 * neither revokes history you could already read nor grants access to anything
 * sent afterwards — senders simply stop including your copy.
 */
export async function leaveChat(chatId: string, myUserId: string): Promise<void> {
  await setDoc(
    doc(db, 'chats', chatId),
    {participants: arrayRemove(myUserId), updatedAt: serverTimestamp()},
    {merge: true},
  );
}

/** Find an existing 1:1 chat with the other user, or create one. */
// ---- Messages --------------------------------------------------------------

export type MessageCursor = QueryDocumentSnapshot;

/**
 * Live-subscribes to the newest page of messages. The callback also receives the
 * oldest doc snapshot in the window (the pagination cursor) and whether a full
 * page came back (a hint that older messages likely exist).
 */
export function listenMessages(
  chatId: string,
  cb: (messages: ChatMessage[], oldest: MessageCursor | null, maybeMore: boolean) => void,
) {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(MESSAGE_PAGE_SIZE),
  );
  return onSnapshot(
    q,
    snap => {
      // Empty *and* from Firestore's own unsynced cache is "not yet", not "no
      // messages" — that is what opens a thread blank and leaves it there.
      if (isUnsyncedEmpty(snap)) return;
      // `estimate` gives just-sent messages (pending serverTimestamp) a local
      // timestamp so they order correctly and show a time instead of being blank.
      const messages = snap.docs.map(d => ({
        _id: d.id,
        ...(d.data({serverTimestamps: 'estimate'}) as Omit<ChatMessage, '_id'>),
      }));
      const oldest = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
      cb(messages, oldest, snap.docs.length === MESSAGE_PAGE_SIZE);
    },
    err => onListenerError(err, 'listenMessages', () => cb([], null, false)),
  );
}

/**
 * One-shot fetch of the page of messages older than `cursor` (for infinite
 * scroll-up). Returns messages newest-first plus the next cursor and whether a
 * full page came back.
 */
export async function fetchOlderMessages(
  chatId: string,
  cursor: MessageCursor,
): Promise<{messages: ChatMessage[]; oldest: MessageCursor | null; maybeMore: boolean}> {
  const snap = await getDocs(
    query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'desc'),
      startAfter(cursor),
      limit(MESSAGE_PAGE_SIZE),
    ),
  );
  const messages = snap.docs.map(d => ({
    _id: d.id,
    ...(d.data({serverTimestamps: 'estimate'}) as Omit<ChatMessage, '_id'>),
  }));
  const oldest = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return {messages, oldest, maybeMore: snap.docs.length === MESSAGE_PAGE_SIZE};
}

/**
 * Sends a text message using the exact same document shape and chat-metadata
 * update (lastMessage + unreadCountBy transaction) as the mobile app's
 * sendMessage, so mobile and web interoperate.
 */
export async function sendTextMessage(
  chatId: string,
  text: string,
  me: {uid: string; name: string},
): Promise<string> {
  return sendMessage(chatId, {text}, me);
}

export interface OutgoingMedia {
  text?: string;
  image?: string;
  file?: {uri: string; name: string; size?: number};
  audio?: string;
  audioDuration?: number;
  burnAfterReading?: {duration: number};
  viewOnce?: boolean;
  system?: boolean;
  call?: {type: 'voice' | 'video'; outcome: 'missed' | 'declined'};
  replyTo?: ChatMessage['replyTo'];
  mentions?: string[];
  // E2EE — set by ChatPane's encryptOutgoingMessage in place of the plain
  // field it seals (see services/e2ee.ts). sendMessage below only persists
  // whatever it's given; it has no key material and does no sealing itself.
  encrypted?: EncryptedField | SealedEnvelopeField;
  encryptedImage?: EncryptedField | SealedEnvelopeField;
  encryptedAudio?: EncryptedField | SealedEnvelopeField;
  encryptedFileUri?: EncryptedField | SealedEnvelopeField;
}

/**
 * Sends a message (text and/or media), matching the mobile document shape and
 * the lastMessage / unreadCountBy chat-metadata update so mobile and web
 * interoperate. Media URLs come from Firebase Storage (see services/storage).
 *
 * Throws RecipientUnreachableError if the other participant deleted their
 * account. The check lives here rather than in the composer because every send
 * path — text, image, file, voice, scheduled — funnels through this one
 * function, and a guard in the UI would have to be repeated at each of them.
 *
 * Returns the new message's id, which the composer needs to attach a link
 * preview to the message it just sent (see services/linkPreview.ts). The id is
 * generated here rather than by the caller, so there was previously no way to
 * name the document afterwards.
 */
export async function sendMessage(
  chatId: string,
  media: OutgoingMedia,
  me: {uid: string; name: string},
): Promise<string> {
  await assertRecipientReachable(chatId, me.uid);

  const messageId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const doc_: Record<string, unknown> = {
    _id: messageId,
    text: media.text || '',
    createdAt: serverTimestamp(),
    user: {_id: me.uid, name: me.name},
  };
  if (media.image) doc_.image = media.image;
  if (media.file) doc_.file = media.file;
  if (media.audio) doc_.audio = media.audio;
  if (media.audioDuration) doc_.audioDuration = media.audioDuration;
  if (media.burnAfterReading) doc_.burnAfterReading = media.burnAfterReading;
  if (media.viewOnce) doc_.viewOnce = true;
  if (media.system) doc_.system = true;
  if (media.call) doc_.call = media.call;
  if (media.replyTo) doc_.replyTo = media.replyTo;
  if (media.mentions && media.mentions.length) doc_.mentions = media.mentions;
  if (media.encrypted) doc_.encrypted = media.encrypted;
  if (media.encryptedImage) doc_.encryptedImage = media.encryptedImage;
  if (media.encryptedAudio) doc_.encryptedAudio = media.encryptedAudio;
  if (media.encryptedFileUri) doc_.encryptedFileUri = media.encryptedFileUri;

  await setDoc(doc(db, 'chats', chatId, 'messages', messageId), doc_);

  // Never leak burn-message text into the chat-list preview. An encrypted
  // send clears the plain field it seals (see ChatPane's
  // encryptOutgoingMessage), so without this branch the preview would go
  // blank instead of falling through to '[Photo]' / etc.
  const isEncrypted = !!(
    media.encrypted ||
    media.encryptedImage ||
    media.encryptedAudio ||
    media.encryptedFileUri
  );
  const preview = media.burnAfterReading
    ? '🔥'
    : isEncrypted
    ? '🔒 Encrypted message'
    : media.text ||
      (media.image ? '[Photo]' : media.audio ? '[Voice message]' : media.file ? '[File]' : '');

  await runTransaction(db, async tx => {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await tx.get(chatRef);
    if (!chatSnap.exists()) return;
    const chat = chatSnap.data() as ChatRoom;
    const unreadCountBy: Record<string, number> = {...(chat.unreadCountBy || {})};
    (chat.participants || []).forEach(uid => {
      unreadCountBy[uid] = uid === me.uid ? 0 : (unreadCountBy[uid] || 0) + 1;
    });
    tx.set(
      chatRef,
      {
        lastMessage: {text: preview, createdAt: serverTimestamp()},
        updatedAt: serverTimestamp(),
        unreadCountBy,
      },
      {merge: true},
    );
  });

  return messageId;
}

/**
 * Attaches a resolved link preview to an already-sent message.
 *
 * A separate write rather than part of the send: the preview needs a network
 * round trip to the `fetchLinkPreview` function, and holding the message back
 * until a slow or dead site responds would make sending feel broken. The
 * bubble appears immediately and grows a card a moment later.
 *
 * `patch` comes from buildLinkPreviewPatch and is one of two shapes — sealed
 * or plaintext — so this function stays out of the crypto decision.
 */
/**
 * Merges a patch into one message document.
 *
 * Was setMessageLinkPreview; renamed when transcripts started being written
 * the same way — both are a field the client computes after the message is
 * already sent, and both go through a builder that decides between a sealed
 * field and a plaintext fallback.
 */
export async function patchMessage(
  chatId: string,
  messageId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await setDoc(doc(db, 'chats', chatId, 'messages', messageId), patch, {merge: true});
}

/** Reads this user's unread count once (before it's cleared) for the "new
 * messages" divider placement when opening a chat. */
export async function getInitialUnread(chatId: string, uid: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, 'chats', chatId));
    const map = (snap.data()?.unreadCountBy as Record<string, number>) || {};
    return map[uid] || 0;
  } catch {
    return 0;
  }
}

/** Clears this user's unread counter when they open a chat. */
export async function markChatRead(chatId: string, uid: string): Promise<void> {
  // The unread counter always clears — that is this function's job and it is
  // this user's own field. `lastReadAt` is the part the other person sees, and
  // it is opt-in: see services/privacyPrefs.
  await setDoc(
    doc(db, 'chats', chatId),
    {
      unreadCountBy: {[uid]: 0},
      ...(isReadReceiptsEnabled() ? {lastReadAt: {[uid]: Date.now()}} : null),
    },
    {merge: true},
  );
}

/** One-off fetch for contexts with no listener, e.g. looking up a forward
 * target's current members right before sealing a message for them. */
export async function getChat(chatId: string): Promise<ChatRoom | null> {
  const snapshot = await getDoc(doc(db, 'chats', chatId));
  return snapshot.exists() ? ({id: snapshot.id, ...(snapshot.data() as Omit<ChatRoom, 'id'>)}) : null;
}

/** Live chat doc — used for typing indicator, read receipts, pin/mute state. */
export function listenChat(chatId: string, cb: (chat: ChatRoom | null) => void) {
  return onSnapshot(doc(db, 'chats', chatId), s =>
    cb(s.exists() ? ({id: s.id, ...(s.data() as Omit<ChatRoom, 'id'>)}) : null),
  );
}

/** Toggle an emoji reaction on a message (reactions: {emoji: uid[]}). */
export async function toggleReaction(
  chatId: string,
  messageId: string,
  emoji: string,
  uid: string,
): Promise<void> {
  const ref = doc(db, 'chats', chatId, 'messages', messageId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const reactions: Record<string, string[]> = {...(snap.data().reactions || {})};
    const set = new Set(reactions[emoji] || []);
    if (set.has(uid)) set.delete(uid);
    else set.add(uid);
    if (set.size === 0) delete reactions[emoji];
    else reactions[emoji] = Array.from(set);
    tx.set(ref, {reactions}, {merge: true});
  });
}

/**
 * Hard-deletes multiple messages from the database at once. Fully removes each
 * document (no soft-delete flag) in 450-op batches to stay under Firestore's
 * 500-writes-per-batch limit. Also cleans up any Storage media those messages
 * pointed at (decrypting E2EE pointers with the caller's own device key first
 * — see messageMedia.ts), best-effort and only after the Firestore deletion
 * succeeds, so a Storage failure can never leave a live message pointing at
 * broken media.
 */
export async function deleteMessages(chatId: string, messageIds: string[], uid: string): Promise<void> {
  // Deletion is now recoverable: the documents are moved to the chat's trash
  // subcollection instead of being destroyed, and their Storage media is left
  // in place until the retention window closes (see services/messageTrash.ts).
  // Deleting the blob here would make recovery restore a broken pointer.
  await trashMessages(chatId, messageIds, uid);
  await recomputeChatLastMessage(chatId).catch(() => undefined);

  // Opportunistic sweep — this project has no scheduled functions enabled, so
  // expired trash is only ever cleaned up by a client that happens to be here.
  purgeExpiredTrash(chatId, uid).catch(() => undefined);
}

/** Delegates to deleteMessages so there's exactly one implementation of the
 * fetch → decrypt → delete → clean-up-Storage pipeline to keep correct. */
export async function deleteMessage(chatId: string, messageId: string, uid: string): Promise<void> {
  await deleteMessages(chatId, [messageId], uid);
}

// Same preview rules as sendMessage (never leak burn text).
function messagePreview(m: ChatMessage): string {
  if (m.burnAfterReading) return '🔥';
  return (
    m.text ||
    (m.image ? '[Photo]' : m.audio ? '[Voice message]' : m.file ? '[File]' : '')
  );
}

/**
 * Recomputes the chat's `lastMessage` preview from the newest remaining message
 * — call after deleting messages so the chat-list preview doesn't show a
 * just-deleted message. Clears the preview when the chat has no messages left.
 */
export async function recomputeChatLastMessage(chatId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(1)),
  );
  const chatRef = doc(db, 'chats', chatId);
  if (snap.empty) {
    await setDoc(chatRef, {lastMessage: {text: '', createdAt: null}}, {merge: true});
    return;
  }
  const m = snap.docs[0].data() as ChatMessage;
  await setDoc(
    chatRef,
    {lastMessage: {text: messagePreview(m), createdAt: m.createdAt ?? serverTimestamp()}},
    {merge: true},
  );
}

/** Edits a message's text in place, stamping `editedAt` so the UI can flag it. */
export async function editMessage(chatId: string, messageId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await setDoc(
    doc(db, 'chats', chatId, 'messages', messageId),
    {text: trimmed, editedAt: serverTimestamp()},
    {merge: true},
  );
}

/**
 * Posts a "Missed call" notice exactly once, keyed to the call id.
 *
 * Uses the SAME deterministic message id as the server-side `onCallEnded`
 * function (`missed_<callId>`) and refuses to write if that message already
 * exists — so the client fallback and the Cloud Function can both run without
 * duplicating the notice or double-incrementing unread counts. This is what
 * makes the feature work before Cloud Functions are deployed.
 */
export async function logMissedCall(
  chatId: string,
  callId: string,
  caller: {uid: string; name: string},
  type: 'voice' | 'video',
): Promise<void> {
  const messageId = `missed_${callId}`;
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  const chatRef = doc(db, 'chats', chatId);
  const text = type === 'video' ? 'Missed video call' : 'Missed voice call';

  await runTransaction(db, async tx => {
    const existing = await tx.get(msgRef);
    if (existing.exists()) return; // already logged (by us, the other client, or the server)
    const chatSnap = await tx.get(chatRef);
    if (!chatSnap.exists()) return;
    const chat = chatSnap.data() as ChatRoom;

    tx.set(msgRef, {
      _id: messageId,
      text,
      createdAt: serverTimestamp(),
      user: {_id: caller.uid, name: caller.name},
      system: true,
      call: {type, outcome: 'missed'},
    });

    const unreadCountBy: Record<string, number> = {...(chat.unreadCountBy || {})};
    (chat.participants || []).forEach(uid => {
      unreadCountBy[uid] = uid === caller.uid ? 0 : (unreadCountBy[uid] || 0) + 1;
    });
    tx.set(
      chatRef,
      {
        lastMessage: {text, createdAt: serverTimestamp()},
        updatedAt: serverTimestamp(),
        unreadCountBy,
      },
      {merge: true},
    );
  });
}

// ---- Ephemeral messages ----------------------------------------------------

/** Marks a burn-after-reading message as revealed (starts its countdown). */
export async function revealBurnMessage(
  chatId: string,
  messageId: string,
  burn: {duration: number},
): Promise<void> {
  await setDoc(
    doc(db, 'chats', chatId, 'messages', messageId),
    {burnAfterReading: {...burn, burnStartedAt: Date.now()}},
    {merge: true},
  );
}

/**
 * Wipes a burn message's content and flags it burned (matches mobile
 * `burnMessage`).
 *
 * Clears the `encrypted*` siblings as well as the plaintext fields. Clearing
 * only the plaintext ones destroyed almost nothing in the case the feature
 * exists for: in an encrypted chat those fields are *already* empty and the
 * content lives in the envelope, so a "burned" message stayed on the server
 * intact and openable by every recipient's device key.
 *
 * Media is deleted from Storage too — the bytes outlive the document, and
 * anyone who saw the message still holds the URL. Best-effort, and after the
 * Firestore write: orphaned bytes are recoverable, a live message pointing at
 * deleted media is not.
 */
export async function burnMessage(chatId: string, messageId: string, uid: string): Promise<void> {
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);

  // Resolve media before clearing the fields that name it.
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
    // No key, unreadable pointer, or the message is already gone. The clearing
    // below has to happen regardless.
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

/** Marks a view-once media message as viewed by `uid` and expired. */
export async function markViewOnceViewed(chatId: string, messageId: string, uid: string): Promise<void> {
  await setDoc(
    doc(db, 'chats', chatId, 'messages', messageId),
    {viewOnceViewedBy: arrayUnion(uid), viewOnceExpired: true, viewOnceOpenedAt: serverTimestamp()},
    {merge: true},
  );
}

// ---- Disappearing-messages policy -----------------------------------------

export const EXPIRY_OPTIONS: {hours: number}[] = [
  {hours: 0},
  {hours: 1},
  {hours: 24},
  {hours: 168},
  {hours: 720},
];

/**
 * Sets the chat's disappearing-messages policy in hours (0 = off). Enabling a
 * policy also stamps `messageExpirySince` = now, so the timer applies only to
 * messages sent from this point on — turning it on never retroactively deletes
 * existing history (and cancelling it right away deletes nothing).
 */
export async function setChatExpiryPolicy(chatId: string, hours: number): Promise<void> {
  const patch: {messageExpiry: number; messageExpirySince?: number} = {messageExpiry: hours};
  if (hours > 0) patch.messageExpirySince = Date.now();
  await setDoc(doc(db, 'chats', chatId), patch, {merge: true});
}

/**
 * Deletes messages that were sent AFTER the policy was enabled and have since
 * outlived the expiry window. Firestore rules let any participant delete
 * messages, so this enforces the policy client-side for both users. It never
 * touches messages that predate the policy (`since`), so enabling disappearing
 * messages can't wipe the existing conversation. No-op when the policy is off.
 */
export async function sweepExpiredMessages(chatId: string, hours: number, since?: number): Promise<number> {
  if (!hours || hours <= 0) return 0;
  // Without a recorded activation time we can't tell backlog from new messages,
  // so do nothing rather than risk deleting history.
  if (!since) return 0;
  const cutoffMs = Date.now() - hours * 3600 * 1000;
  // Nothing sent after activation is old enough to expire yet.
  if (cutoffMs <= since) return 0;
  return deleteQueryInChunks(
    query(
      collection(db, 'chats', chatId, 'messages'),
      where('createdAt', '>=', Timestamp.fromMillis(since)),
      where('createdAt', '<', Timestamp.fromMillis(cutoffMs)),
    ),
  );
}

let typingTimer: ReturnType<typeof setTimeout> | null = null;
export function setTyping(chatId: string, uid: string, isTyping: boolean): void {
  // Opt-in, and gated on the write rather than the render: suppressing it only
  // in the UI would leave the server accumulating a record of when this person
  // was at their keyboard while the app said the feature was off.
  if (!isTypingIndicatorEnabled()) return;
  setDoc(doc(db, 'chats', chatId), {typingBy: {[uid]: isTyping ? Date.now() : 0}}, {merge: true}).catch(
    () => undefined,
  );
  if (typingTimer) clearTimeout(typingTimer);
  if (isTyping) {
    typingTimer = setTimeout(() => {
      setDoc(doc(db, 'chats', chatId), {typingBy: {[uid]: 0}}, {merge: true}).catch(() => undefined);
    }, 4000);
  }
}

// ---- Chat settings ---------------------------------------------------------

export async function togglePinChat(chatId: string, uid: string, pinned: boolean): Promise<void> {
  await setDoc(
    doc(db, 'chats', chatId),
    {pinnedBy: pinned ? arrayRemove(uid) : arrayUnion(uid)},
    {merge: true},
  );
}

export async function toggleMuteChat(chatId: string, uid: string, muted: boolean): Promise<void> {
  await setDoc(
    doc(db, 'chats', chatId),
    {mutedBy: muted ? arrayRemove(uid) : arrayUnion(uid)},
    {merge: true},
  );
}

/**
 * Hides or recovers a chat for one user. Same per-user array shape as pin and
 * mute, so the other participant is unaffected and nothing about the
 * conversation itself changes.
 */
export async function toggleHideChat(chatId: string, uid: string, hidden: boolean): Promise<void> {
  await setDoc(
    doc(db, 'chats', chatId),
    {hiddenBy: hidden ? arrayRemove(uid) : arrayUnion(uid)},
    {merge: true},
  );
}

/**
 * Writes your sealed self-introduction onto a chat.
 *
 * Merged under your own uid, so it cannot displace anyone else's — and would
 * not be believed if it did, since the reader checks the envelope's sender key
 * against the peer's published one. See services/introductions.ts.
 */
export async function setChatIntroduction(
  chatId: string,
  uid: string,
  sealed: unknown,
): Promise<void> {
  await setDoc(doc(db, 'chats', chatId), {introBy: {[uid]: sealed}}, {merge: true});
}

/** Per-user custom chat name (nameBy: {uid: name}), matching the mobile app. */
export async function setChatName(chatId: string, uid: string, name: string | null): Promise<void> {
  await setDoc(doc(db, 'chats', chatId), {nameBy: {[uid]: name}}, {merge: true});
}


/** Pin/unpin a message within a chat (chat.pinnedMessageIds), matching mobile. */
export async function togglePinMessage(chatId: string, messageId: string): Promise<void> {
  const ref = doc(db, 'chats', chatId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const pinned = new Set((snap.data().pinnedMessageIds as string[]) || []);
    if (pinned.has(messageId)) pinned.delete(messageId);
    else pinned.add(messageId);
    tx.set(ref, {pinnedMessageIds: Array.from(pinned)}, {merge: true});
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  // Delete messages in bounded chunks (batches cap at 500) before the chat doc.
  await deleteQueryInChunks(collection(db, 'chats', chatId, 'messages'));
  await deleteDoc(doc(db, 'chats', chatId));
}
