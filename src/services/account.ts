import {
  EmailAuthProvider,
  deleteUser,
  getAuth,
  reauthenticateWithCredential,
  updatePassword,
} from './firebase/auth';
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
} from './firebase/firestore';
import {deleteObject, getStorage, listAll, ref} from './firebase/storage';
import {mmkvStorage} from './storageMMKV';
import {reportError} from './errorLog';
import {deleteStorageObjectByUrl} from './firebaseChat';
import {resolveMessageMediaUrls} from './messageMedia';
import {clearDeviceKeypair, getDeviceKeypairIfEnrolled} from './e2eeKeys';
import {clearRatchetKeys} from './ratchetKeys';
import {clearRatchetSessions} from './ratchetSessionStore';
import {clearBodies} from './messageBodyStore';
import {clearMediaCache} from './mediaVault';
import {USER_SUBCOLLECTIONS} from './userSubcollections';

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

/**
 * Removes the user from one chat: deletes the messages they authored and the
 * media those messages point at, repairs the cached lastMessage preview, then
 * drops them from `participants`. `secretKey` (this device's own, fetched
 * once by purgeUserData) lets encrypted media pointers be resolved too, not
 * just plaintext ones — see messageMedia.ts.
 */
async function purgeChat(
  chatId: string,
  uid: string,
  report: PurgeReport,
  secretKey: Uint8Array | null,
): Promise<void> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  // Media first: once the message documents are gone their URLs — plaintext
  // or E2EE-sealed — are unrecoverable and the Storage objects would be
  // orphaned forever.
  const mine = await getDocs(query(messagesRef, where('user._id', '==', uid)));
  for (const d of mine.docs) {
    for (const url of resolveMessageMediaUrls(d.data() as Record<string, unknown>, secretKey, chatId)) {
      if (await deleteStorageObjectByUrl(url)) report.storageObjectsDeleted++;
    }
  }

  report.messagesDeleted += await deleteQueryInChunks(
    query(messagesRef, where('user._id', '==', uid)),
  );

  /**
   * The sibling subcollections this user owns documents in. These have to go
   * before `participants: arrayRemove(uid)` below, because every rule in this
   * chat is gated on isChatParticipant(chatId) — the moment that array loses
   * the uid, the client can no longer reach any of it, and deleteAccount
   * removes the auth user seconds later. So anything skipped here is not
   * "cleaned up next time", it is permanent.
   *
   * What was being left behind: pending scheduled messages, which still hold
   * their text; trash entries, which by design hold a byte-identical copy of a
   * message the user had already chosen to delete; sealed sender-key chains;
   * and the live-location document. Someone who asked for their account to be
   * deleted was leaving the content of their deleted messages on the server.
   *
   * Each query filters on the same field its read rule tests, which is what
   * makes it legal — Firestore rejects a query the rules cannot prove safe from
   * its constraints alone.
   */
  const ownedInChat: [string, any][] = [
    ['scheduledMessages', query(collection(db, 'chats', chatId, 'scheduledMessages'), where('user._id', '==', uid))],
    ['trash', query(collection(db, 'chats', chatId, 'trash'), where('deletedBy', '==', uid))],
    ['senderKeys', query(collection(db, 'chats', chatId, 'senderKeys'), where('from', '==', uid))],
  ];
  for (const [label, q] of ownedInChat) {
    try {
      await deleteQueryInChunks(q);
    } catch (error) {
      report.errors.push(`chat ${chatId}/${label} failed: ${String(error)}`);
    }
  }
  // Keyed by uid rather than queried: one document, deleted by path.
  try {
    await deleteDoc(doc(db, 'chats', chatId, 'liveLocations', uid));
  } catch (error) {
    report.errors.push(`chat ${chatId}/liveLocations failed: ${String(error)}`);
  }

  /**
   * Deliberately left: sharedLists, quoteWall and calls. Those are joint
   * artifacts of the chat, not this user's own documents — a shared list does
   * not stop being the other person's record because one of them left, and
   * deleting it out from under the remaining participant would be destroying
   * their data to satisfy someone else's erasure request. They carry a uid in
   * an attribution field, which is the same residue a departed participant
   * already leaves in the chat's history.
   *
   * This list used to name expenses, playlist and countdowns as well. Those
   * features are gone and their rules were removed on 2026-09-05, so there is
   * nothing left to leave behind.
   */

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
 *  - Media on end-to-end encrypted messages is decrypted with this device's
 *    own key before deletion (see messageMedia.ts), so it's cleaned up the
 *    same as plaintext media. It's still orphaned if that key is unavailable
 *    (e.g. this device never enrolled one) or a payload fails to decrypt —
 *    but that's now the degraded case, not the default outcome.
 */
export async function purgeUserData(uid: string): Promise<PurgeReport> {
  const report: PurgeReport = {
    chatsProcessed: 0,
    messagesDeleted: 0,
    momentsDeleted: 0,
    storageObjectsDeleted: 0,
    errors: [],
  };

  // Fetched once, up front: X25519 is symmetric, so this device's own key
  // decrypts any message pointer in a chat this user participates in,
  // whether they sent it or received it (see e2ee.ts). Falls back to null on
  // failure so a keypair problem degrades to "encrypted media stays
  // orphaned" — today's status quo — rather than aborting the purge; the
  // account is being deleted regardless, and a partial purge beats none.
  let secretKey: Uint8Array | null = null;
  try {
    // Non-enrolling: publishing a fresh key on the way out would be the
    // last thing this account ever did, and the degraded path below already
    // covers a missing one.
    const keypair = await getDeviceKeypairIfEnrolled(uid);
    secretKey = keypair?.secretKey ?? null;
    if (!keypair) {
      report.errors.push(
        'device key unavailable: this device is not enrolled, so encrypted pointers were left unread',
      );
    }
  } catch (error) {
    report.errors.push(`device key unavailable: ${String(error)}`);
  }

  try {
    const chats = await getDocs(
      query(collection(db, 'chats'), where('participants', 'array-contains', uid)),
    );
    for (const c of chats.docs) {
      await purgeChat(c.id, uid, report, secretKey);
    }
  } catch (error) {
    report.errors.push(`chats failed: ${String(error)}`);
  }

  try {
    // Moments the feature is gone, but moments the *documents* are not: an
    // account that posted before the removal still has them, and deletion has
    // to reach data this build can no longer create.
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
      if (mediaUrl && (await deleteStorageObjectByUrl(mediaUrl))) report.storageObjectsDeleted++;
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

  // Deleting the profile document does NOT delete these — see
  // userSubcollections.ts for why a name left off this list is unrecoverable.
  for (const sub of USER_SUBCOLLECTIONS) {
    try {
      await deleteQueryInChunks(collection(db, 'users', uid, sub));
    } catch (error) {
      report.errors.push(`users/${uid}/${sub} failed: ${String(error)}`);
    }
  }

  // Moment media is namespaced by uid, so it can be purged wholesale.
  try {
    // Modular rather than the namespaced storage().ref() chain: the namespaced
    // API is React-Native-Firebase-only, and the modular signatures are the
    // ones the Firebase JS SDK also exposes — which is what lets this run on a
    // platform with no native Firebase SDK.
    const listing = await listAll(ref(getStorage(), `moments/${uid}`));
    for (const item of listing.items) {
      try {
        await deleteObject(item);
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
 *
 * That wholesale wipe stopped being sufficient once the secret key moved into
 * the OS key store, which lives outside MMKV entirely — hence the explicit
 * clearDeviceKeypair. Without it, deleting your account would leave your
 * identity key in the Keychain indefinitely: the one thing this function
 * exists to prevent.
 *
 * Every key-store user has to be named here for the same reason, which is why
 * the ratchet's three are listed explicitly rather than assumed to fall under
 * the MMKV wipe: its identity, its prekey secrets, and the key that encrypts
 * stored sessions all live in the key store too. The message body store adds a
 * fourth. Each is wrapped separately so one failure does not skip the rest.
 *
 * Decrypted attachments are on the same footing and for the same reason: they
 * are plaintext copies on the filesystem, outside MMKV, of every photo and
 * document the user ever opened. Leaving them would mean the one action that
 * is supposed to remove an account's data from a device left the most
 * personal part of it sitting in the caches directory.
 */
export async function clearLocalData(userId: string): Promise<void> {
  const steps: [string, () => Promise<void>][] = [
    ['account_clear_keystore_failed', () => clearDeviceKeypair(userId)],
    ['account_clear_ratchet_keys_failed', () => clearRatchetKeys(userId)],
    ['account_clear_ratchet_sessions_failed', () => clearRatchetSessions(userId)],
    // Decrypted message text, and the key-store entry protecting it. On the
    // same footing as the attachments below and for the same reason: it is a
    // plaintext copy of the conversation, and it is the copy that survives
    // without any network access at all.
    ['account_clear_message_bodies_failed', () => clearBodies(userId)],
    ['account_clear_media_cache_failed', () => clearMediaCache()],
  ];
  for (const [context, step] of steps) {
    try {
      await step();
    } catch (error) {
      reportError(error, context);
    }
  }
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
  await clearLocalData(uid);
  return report;
}
