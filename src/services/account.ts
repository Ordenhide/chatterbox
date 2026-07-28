import {
  EmailAuthProvider,
  deleteUser,
  getAuth,
  reauthenticateWithCredential,
  updatePassword,
} from '@react-native-firebase/auth';
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import {mmkvStorage} from './storageMMKV';
import {reportError} from './telemetry';

/**
 * Account-level operations: changing a password, and permanently deleting an
 * account together with its data. Mirrors web/src/services/account.ts — same
 * ordering, same limitations — using the React Native Firebase SDK.
 *
 * Both are "sensitive operations" to Firebase Auth, which refuses them on a
 * token older than a few minutes (auth/requires-recent-login), so both take
 * the current password and reauthenticate first. That doubles as proof that
 * the person holding the unlocked phone is the account owner.
 */

const db = getFirestore();

export interface PurgeReport {
  chatsProcessed: number;
  messagesDeleted: number;
  momentsDeleted: number;
  storageObjectsDeleted: number;
  /** Non-fatal failures. The purge deliberately continues past these: once the
   * auth user is gone the user cannot sign back in to retry, so a partial
   * purge beats aborting and leaving everything behind. */
  errors: string[];
}

export type PasswordChangeError =
  | 'wrong-password'
  | 'weak-password'
  | 'too-many-requests'
  | 'unknown';

export function describeAuthError(error: unknown): PasswordChangeError {
  const code = (error as {code?: string})?.code || '';
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
  const user = getAuth().currentUser;
  if (!user?.email) throw new Error('not signed in');
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, currentPassword),
  );
}

/** Changes the signed-in user's password. Throws with `.reason` set. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('not signed in');
  try {
    await reauthenticate(currentPassword);
    await updatePassword(user, newPassword);
  } catch (error) {
    const wrapped = new Error('password change failed') as Error & {
      reason: PasswordChangeError;
    };
    wrapped.reason = describeAuthError(error);
    throw wrapped;
  }
}

const PAGE = 400;

/** Deletes every doc matched by a query, in batches under Firestore's 500 cap. */
async function deleteQueryInChunks(baseQuery: any): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await getDocs(query(baseQuery, limit(PAGE)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < PAGE) break;
  }
  return total;
}

async function deleteByUrl(url: string, report: PurgeReport): Promise<void> {
  // Inline media (data: URIs) lives inside the Firestore document, so it is
  // already gone once that document is deleted — there is no Storage object.
  if (!url.startsWith('http')) return;
  try {
    await storage().refFromURL(url).delete();
    report.storageObjectsDeleted++;
  } catch {
    // Already deleted, or the URL does not map to an object in this bucket.
  }
}

function mediaUrlsOf(message: any): string[] {
  return [message?.image, message?.video, message?.audio, message?.file?.uri].filter(
    (u: unknown): u is string => typeof u === 'string' && u.length > 0,
  );
}

/**
 * Removes the user from one chat: deletes the messages they authored and the
 * media those messages point at, repairs the cached lastMessage preview, then
 * drops them from `participants`.
 */
async function purgeChat(chatId: string, uid: string, report: PurgeReport): Promise<void> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  // Media first: once the message documents are gone their URLs are
  // unrecoverable and the Storage objects would be orphaned forever.
  const mine = await getDocs(query(messagesRef, where('user._id', '==', uid)));
  for (const d of mine.docs) {
    for (const url of mediaUrlsOf(d.data())) {
      await deleteByUrl(url, report);
    }
  }

  report.messagesDeleted += await deleteQueryInChunks(
    query(messagesRef, where('user._id', '==', uid)),
  );

  // `chat.lastMessage` is a denormalised copy of the newest message's text,
  // shown in both clients' chat lists. Leaving it would keep the departing
  // user's own words on screen after their messages are gone.
  const chatRef = doc(db, 'chats', chatId);
  try {
    const newest = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(1)));
    const survivor = newest.docs[0]?.data() as any;
    await updateDoc(chatRef, {
      lastMessage: survivor
        ? {text: survivor.text || '[Media]', createdAt: survivor.createdAt ?? null}
        : {text: '', createdAt: null},
    });
  } catch (error) {
    report.errors.push(`lastMessage repair failed for chat ${chatId}: ${String(error)}`);
  }

  try {
    await updateDoc(chatRef, {participants: arrayRemove(uid)});
  } catch (error) {
    report.errors.push(`leaving chat ${chatId} failed: ${String(error)}`);
  }
  report.chatsProcessed++;
}

/**
 * Erases this user's data everywhere the security rules let a client reach it.
 * Runs BEFORE the auth account is deleted — afterwards every request would be
 * unauthenticated and denied.
 *
 * Known limits, imposed by the rules rather than by choice:
 *  - A block another user placed on this uid is deletable only by its blocker,
 *    so those records survive.
 *  - Likes/comments this user left on other people's moments would need a
 *    collection-group query the rules do not permit; only those attached to
 *    their own moments are removed.
 *  - Media on end-to-end encrypted messages is addressed by a sealed URL this
 *    code cannot read, so the document goes but the Storage object is
 *    orphaned rather than deleted.
 */
export async function purgeUserData(uid: string): Promise<PurgeReport> {
  const report: PurgeReport = {
    chatsProcessed: 0,
    messagesDeleted: 0,
    momentsDeleted: 0,
    storageObjectsDeleted: 0,
    errors: [],
  };

  try {
    const chats = await getDocs(
      query(collection(db, 'chats'), where('participants', 'array-contains', uid)),
    );
    for (const c of chats.docs) {
      await purgeChat(c.id, uid, report);
    }
  } catch (error) {
    report.errors.push(`chats failed: ${String(error)}`);
  }

  try {
    const moments = await getDocs(query(collection(db, 'moments'), where('authorId', '==', uid)));
    for (const m of moments.docs) {
      for (const sub of ['likes', 'comments']) {
        try {
          await deleteQueryInChunks(collection(db, 'moments', m.id, sub));
        } catch (error) {
          report.errors.push(`moment ${m.id}/${sub} failed: ${String(error)}`);
        }
      }
      const mediaUrl = (m.data() as {mediaUrl?: string | null})?.mediaUrl;
      if (mediaUrl) await deleteByUrl(mediaUrl, report);
      try {
        await deleteDoc(doc(db, 'moments', m.id));
        report.momentsDeleted++;
      } catch (error) {
        report.errors.push(`moment ${m.id} failed: ${String(error)}`);
      }
    }
  } catch (error) {
    report.errors.push(`moments failed: ${String(error)}`);
  }

  const graphQueries: [string, any][] = [
    ['friends', query(collection(db, 'friends'), where('userIds', 'array-contains', uid))],
    ['friendRequests(from)', query(collection(db, 'friendRequests'), where('fromId', '==', uid))],
    ['friendRequests(to)', query(collection(db, 'friendRequests'), where('toId', '==', uid))],
    ['blocks(mine)', query(collection(db, 'blocks'), where('blockerId', '==', uid))],
  ];
  for (const [label, q] of graphQueries) {
    try {
      await deleteQueryInChunks(q);
    } catch (error) {
      report.errors.push(`${label} failed: ${String(error)}`);
    }
  }

  for (const sub of ['bookmarks', 'reminders', 'private', 'publicKeys']) {
    try {
      await deleteQueryInChunks(collection(db, 'users', uid, sub));
    } catch (error) {
      report.errors.push(`users/${uid}/${sub} failed: ${String(error)}`);
    }
  }

  // Moment media is namespaced by uid, so it can be purged wholesale.
  try {
    const listing = await storage().ref(`moments/${uid}`).listAll();
    for (const item of listing.items) {
      try {
        await item.delete();
        report.storageObjectsDeleted++;
      } catch {
        // already gone
      }
    }
  } catch (error) {
    report.errors.push(`storage moments/${uid} failed: ${String(error)}`);
  }

  // The profile document last: other clients resolve names and avatars
  // through it, so removing it earlier would leave dangling references while
  // the rest of the purge was still running.
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    report.errors.push(`profile failed: ${String(error)}`);
  }

  return report;
}

/**
 * Clears everything this device stored locally for the account.
 *
 * Most important is the E2EE secret key (services/e2eeKeys.ts): it exists
 * ONLY here and is never uploaded, so nothing else could ever clean it up.
 * MMKV is wiped wholesale rather than key-by-key because this app is
 * single-account per device — there is no second user's data to preserve, and
 * an allowlist would silently miss keys added by future features.
 */
export async function clearLocalData(): Promise<void> {
  try {
    await mmkvStorage.clear();
  } catch (error) {
    reportError(error, 'account_clear_local_failed');
  }
}

/**
 * Permanently deletes the account: reauthenticate, purge data, remove the
 * auth user, then wipe local storage. The ordering is not negotiable —
 * deleting the auth user first would make every remaining Firestore and
 * Storage request unauthenticated, stranding the data it was meant to erase.
 */
export async function deleteAccount(currentPassword: string): Promise<PurgeReport> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('not signed in');
  const uid = user.uid;

  try {
    await reauthenticate(currentPassword);
  } catch (error) {
    const wrapped = new Error('reauthentication failed') as Error & {
      reason: PasswordChangeError;
    };
    wrapped.reason = describeAuthError(error);
    throw wrapped;
  }

  const report = await purgeUserData(uid);
  await deleteUser(user);
  await clearLocalData();
  return report;
}
