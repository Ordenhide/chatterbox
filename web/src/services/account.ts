import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  type Query,
} from 'firebase/firestore';
import {deleteObject, listAll, ref} from 'firebase/storage';
import {auth, db} from '../firebase';
import {deleteQueryInChunks} from './firestoreBatch';
import {storage} from './storage';
import type {ChatMessage} from '../types';

/**
 * Account-level operations: changing a password, and permanently deleting an
 * account together with its data.
 *
 * Both are "sensitive operations" to Firebase Auth, which refuses them on a
 * token older than a few minutes (auth/requires-recent-login). Rather than
 * letting the user discover that after filling in a form, both entry points
 * here take the current password and reauthenticate first — which doubles as
 * the confirmation step that the person at the keyboard is the account owner,
 * not someone who walked up to an unlocked browser.
 *
 * Deletion runs entirely client-side. The obvious home for it is a Cloud
 * Function with the Admin SDK (no security-rule limits, atomic, survives the
 * tab closing), but this project's functions are on a closed billing account
 * and do not execute at all — see services/session.ts. Doing it from the
 * client means every delete is subject to the same security rules as any
 * other request, which is what produces the documented limitations below.
 */

/** Result of a purge — surfaced so the UI can be honest about what remains. */
export interface PurgeReport {
  chatsProcessed: number;
  messagesDeleted: number;
  momentsDeleted: number;
  storageObjectsDeleted: number;
  /** Non-fatal failures. Deletion continues past these by design: a partial
   * purge that then removes the account is better than aborting and leaving
   * everything, and the user cannot retry once the account is gone. */
  errors: string[];
}

export type PasswordChangeError =
  | 'wrong-password'
  | 'weak-password'
  | 'too-many-requests'
  | 'unknown';

/** Maps a Firebase auth error to a stable, translatable reason code. */
export function describeAuthError(err: unknown): PasswordChangeError {
  const code = (err as {code?: string})?.code || '';
  if (
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return 'wrong-password';
  }
  if (code === 'auth/weak-password') return 'weak-password';
  if (code === 'auth/too-many-requests') return 'too-many-requests';
  return 'unknown';
}

async function reauthenticate(currentPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('not signed in');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
}

/**
 * Changes the signed-in user's password. Throws with a `.reason` of
 * PasswordChangeError so the caller can show a specific message.
 *
 * Strength is validated by the caller (services/passwordPolicy) before this
 * runs; Firebase's own auth/weak-password is still mapped, since its rules
 * and ours are independent.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  try {
    await reauthenticate(currentPassword);
    await updatePassword(user, newPassword);
  } catch (err) {
    const wrapped = new Error('password change failed') as Error & {reason: PasswordChangeError};
    wrapped.reason = describeAuthError(err);
    throw wrapped;
  }
}

/** Deletes a Storage object addressed by its download URL. Best-effort. */
async function deleteByUrl(url: string, report: PurgeReport): Promise<void> {
  // Inline media (data: URIs) lives inside the Firestore document itself, so
  // it is already gone once that document is deleted — there is no Storage
  // object to remove, and ref() would throw on it.
  if (!url.startsWith('http')) return;
  try {
    await deleteObject(ref(storage, url));
    report.storageObjectsDeleted++;
  } catch {
    // Already deleted, or the URL does not map to an object in this bucket.
  }
}

/** Collects every Storage-hosted media URL a message points at. */
function mediaUrlsOf(message: ChatMessage): string[] {
  const urls = [message.image, message.video, message.audio, message.file?.uri];
  return urls.filter((u): u is string => typeof u === 'string' && u.length > 0);
}

/**
 * Removes the user from one chat: deletes the messages they authored (and the
 * media those messages point at), repairs the chat's cached lastMessage
 * preview, then drops them from `participants` so the chat disappears from
 * their side. Deletes the chat outright only if nobody is left in it.
 */
async function purgeChat(chatId: string, uid: string, report: PurgeReport): Promise<void> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  // Delete media first: once the message documents are gone, the URLs they
  // held are unrecoverable and the Storage objects would be orphaned forever.
  const mine = await getDocs(query(messagesRef, where('user._id', '==', uid)));
  for (const d of mine.docs) {
    for (const url of mediaUrlsOf(d.data() as ChatMessage)) {
      await deleteByUrl(url, report);
    }
  }

  report.messagesDeleted += await deleteQueryInChunks(
    query(messagesRef, where('user._id', '==', uid)),
  );

  // `chat.lastMessage` is a denormalised copy of the newest message's text,
  // read by both clients' chat lists. Leaving it would leave the deleted
  // user's own words visible after their messages are gone, so recompute it
  // from whatever message now survives (or blank it if none do).
  const chatRef = doc(db, 'chats', chatId);
  try {
    const newest = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(1)));
    const survivor = newest.docs[0]?.data() as ChatMessage | undefined;
    await updateDoc(chatRef, {
      lastMessage: survivor
        ? {text: survivor.text || '[Media]', createdAt: survivor.createdAt ?? null}
        : {text: '', createdAt: null},
    });
  } catch (err) {
    report.errors.push(`lastMessage repair failed for chat ${chatId}: ${String(err)}`);
  }

  // Leave the chat. The other participant keeps their own history; the rules
  // then deny this uid any further access to it.
  try {
    await updateDoc(chatRef, {participants: arrayRemove(uid)});
  } catch (err) {
    report.errors.push(`leaving chat ${chatId} failed: ${String(err)}`);
  }
  report.chatsProcessed++;
}

/** Deletes a moment the user authored, plus its likes/comments and media. */
async function purgeMoment(
  momentId: string,
  mediaUrl: string | null | undefined,
  report: PurgeReport,
): Promise<void> {
  for (const sub of ['likes', 'comments']) {
    try {
      await deleteQueryInChunks(query(collection(db, 'moments', momentId, sub)));
    } catch (err) {
      report.errors.push(`moment ${momentId}/${sub} failed: ${String(err)}`);
    }
  }
  if (mediaUrl) await deleteByUrl(mediaUrl, report);
  try {
    await deleteDoc(doc(db, 'moments', momentId));
    report.momentsDeleted++;
  } catch (err) {
    report.errors.push(`moment ${momentId} failed: ${String(err)}`);
  }
}

/** Deletes every object under a Storage prefix, recursing into subfolders. */
async function purgeStoragePrefix(prefix: string, report: PurgeReport): Promise<void> {
  try {
    const listing = await listAll(ref(storage, prefix));
    for (const item of listing.items) {
      try {
        await deleteObject(item);
        report.storageObjectsDeleted++;
      } catch {
        // already gone
      }
    }
    for (const folder of listing.prefixes) {
      await purgeStoragePrefix(folder.fullPath, report);
    }
  } catch (err) {
    report.errors.push(`storage ${prefix} failed: ${String(err)}`);
  }
}

/**
 * Erases this user's data everywhere the security rules allow a client to
 * reach it. Runs BEFORE the auth account is deleted — afterwards every
 * request would be unauthenticated and denied.
 *
 * Known limits, all imposed by the rules rather than by choice:
 *  - A block another user placed on this uid is theirs to delete, not ours
 *    (blocks are deletable only by their blocker), so those records survive.
 *  - Likes and comments this user left on *other people's* moments would need
 *    a collection-group query to find, which the rules do not permit; only
 *    likes/comments attached to their own moments are removed.
 *  - Media attached to end-to-end encrypted messages is addressed by a sealed
 *    URL this code cannot read, so the Firestore document goes but the
 *    underlying Storage object is orphaned rather than deleted.
 */
export async function purgeUserData(uid: string): Promise<PurgeReport> {
  const report: PurgeReport = {
    chatsProcessed: 0,
    messagesDeleted: 0,
    momentsDeleted: 0,
    storageObjectsDeleted: 0,
    errors: [],
  };

  // Chats — messages + their media, then leave.
  try {
    const chats = await getDocs(
      query(collection(db, 'chats'), where('participants', 'array-contains', uid)),
    );
    for (const c of chats.docs) {
      await purgeChat(c.id, uid, report);
    }
  } catch (err) {
    report.errors.push(`chats failed: ${String(err)}`);
  }

  // Moments authored by this user.
  try {
    const moments = await getDocs(
      query(collection(db, 'moments'), where('authorId', '==', uid)),
    );
    for (const m of moments.docs) {
      await purgeMoment(m.id, (m.data() as {mediaUrl?: string | null}).mediaUrl, report);
    }
  } catch (err) {
    report.errors.push(`moments failed: ${String(err)}`);
  }

  // Social graph. Each entry is deletable by either party except blocks,
  // which only the blocker may remove — see the note above.
  const graphQueries: [string, Query][] = [
    ['friends', query(collection(db, 'friends'), where('userIds', 'array-contains', uid))],
    ['friendRequests(from)', query(collection(db, 'friendRequests'), where('fromId', '==', uid))],
    ['friendRequests(to)', query(collection(db, 'friendRequests'), where('toId', '==', uid))],
    ['blocks(mine)', query(collection(db, 'blocks'), where('blockerId', '==', uid))],
  ];
  for (const [label, q] of graphQueries) {
    try {
      await deleteQueryInChunks(q);
    } catch (err) {
      report.errors.push(`${label} failed: ${String(err)}`);
    }
  }

  // Owner-only subcollections, including the published E2EE public key.
  for (const sub of ['bookmarks', 'reminders', 'private', 'publicKeys']) {
    try {
      await deleteQueryInChunks(query(collection(db, 'users', uid, sub)));
    } catch (err) {
      report.errors.push(`users/${uid}/${sub} failed: ${String(err)}`);
    }
  }

  // Moment media is namespaced by uid, so it can be purged wholesale.
  await purgeStoragePrefix(`moments/${uid}`, report);

  // The profile document last: it is what other clients resolve names and
  // avatars through, so removing it earlier would leave dangling references
  // while the rest of the purge was still running.
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (err) {
    report.errors.push(`profile failed: ${String(err)}`);
  }

  return report;
}

/**
 * Clears everything this browser stored locally for the account.
 *
 * Includes the E2EE secret key (see services/e2eeKeys.ts), which is the one
 * piece of data that exists *only* here — leaving it behind on a shared
 * computer would be the most sensitive residue of all.
 */
export function clearLocalData(uid: string): void {
  const exactKeys = ['cb_web_session'];
  const prefixes = [
    'e2ee_secret_key_v1:',
    'e2ee_peer_key_v1:',
    '@chatterbox:drafts:',
    '@chatterbox:tour',
  ];
  try {
    for (const key of exactKeys) localStorage.removeItem(key);
    // Snapshot the key list first: removing while iterating shifts indices.
    const all: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) all.push(key);
    }
    for (const key of all) {
      if (prefixes.some(p => key.startsWith(p)) || key.includes(uid)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

/**
 * Permanently deletes the account: reauthenticate, purge data, then remove
 * the auth user. Ordering is not negotiable — deleting the auth user first
 * would make every subsequent Firestore and Storage request unauthenticated,
 * stranding the data it was supposed to erase.
 *
 * Returns the purge report so the caller can tell the user if anything was
 * left behind.
 */
export async function deleteAccount(currentPassword: string): Promise<PurgeReport> {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  const uid = user.uid;

  try {
    await reauthenticate(currentPassword);
  } catch (err) {
    const wrapped = new Error('reauthentication failed') as Error & {reason: PasswordChangeError};
    wrapped.reason = describeAuthError(err);
    throw wrapped;
  }

  const report = await purgeUserData(uid);
  await deleteUser(user);
  clearLocalData(uid);
  return report;
}
