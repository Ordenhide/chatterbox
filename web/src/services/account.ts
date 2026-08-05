import {
  EmailAuthProvider,
  deleteUser,
  linkWithPhoneNumber,
  reauthenticateWithCredential,
  unlink,
  updatePassword,
  type ApplicationVerifier,
  type ConfirmationResult,
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
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Query,
} from 'firebase/firestore';
import {deleteObject, listAll, ref} from 'firebase/storage';
import {auth, db} from '../firebase';
import {deleteQueryInChunks} from './firestoreBatch';
import {storage, deleteStorageObjectByUrl} from './storage';
import {resolveMessageMediaUrls} from './messageMedia';
import {getOrCreateDeviceKeypair} from './e2eeKeys';
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

export type PhoneLinkError =
  | 'wrong-password'
  | 'invalid-phone-number'
  | 'invalid-verification-code'
  | 'code-expired'
  | 'phone-already-in-use'
  | 'too-many-requests'
  | 'provider-not-enabled'
  | 'recaptcha-failed'
  | 'unknown';

export function describePhoneLinkError(err: unknown): PhoneLinkError {
  const code = (err as {code?: string})?.code || '';
  if (
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return 'wrong-password';
  }
  if (code === 'auth/invalid-phone-number') return 'invalid-phone-number';
  if (code === 'auth/invalid-verification-code') return 'invalid-verification-code';
  if (code === 'auth/code-expired') return 'code-expired';
  if (code === 'auth/credential-already-in-use' || code === 'auth/provider-already-linked') {
    return 'phone-already-in-use';
  }
  if (code === 'auth/too-many-requests') return 'too-many-requests';
  // Thrown when the Phone sign-in provider hasn't been turned on for this
  // Firebase project yet (Authentication -> Sign-in method, console-only
  // step, not something this codebase can enable on its own).
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return 'provider-not-enabled';
  }
  // The reCAPTCHA token was missing, expired, or rejected — the widget is
  // single-use, so this is also what a double-submit looks like. Distinct from
  // 'unknown' because the fix is "try again", not "something is broken":
  // the account, password and phone number were all fine.
  if (
    code === 'auth/invalid-app-credential' ||
    code === 'auth/captcha-check-failed' ||
    code === 'auth/missing-app-credential'
  ) {
    return 'recaptcha-failed';
  }
  return 'unknown';
}

/** Writes the linked phone number to the owner-only private subcollection — same rationale as
 * services/push.ts's fcmToken write: this is more sensitive than the public /users profile doc,
 * which any signed-in user can read. */
async function setUserPhoneNumber(uid: string, phoneNumber: string | null): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'private', 'contact'),
    {phoneNumber: phoneNumber ?? null, phoneUpdatedAt: serverTimestamp()},
    {merge: true},
  );
}

/**
 * Starts linking a phone number to the signed-in user's account. Reauthenticates first (same
 * "sensitive operation" reasoning as changePassword). `appVerifier` is a RecaptchaVerifier the
 * caller creates and mounts to a DOM node — the web SDK requires it; mobile does not.
 */
export async function sendPhoneLinkCode(
  currentPassword: string,
  phoneNumber: string,
  appVerifier: ApplicationVerifier,
): Promise<ConfirmationResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  try {
    await reauthenticate(currentPassword);
    return await linkWithPhoneNumber(user, phoneNumber.trim(), appVerifier);
  } catch (err) {
    const wrapped = new Error('phone link failed') as Error & {reason: PhoneLinkError; cause?: unknown};
    wrapped.reason = describePhoneLinkError(err);
    wrapped.cause = err;
    throw wrapped;
  }
}

/** Confirms the code sent by sendPhoneLinkCode and finishes linking the phone number. */
export async function confirmPhoneLink(confirmation: ConfirmationResult, code: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  try {
    const credential = await confirmation.confirm(code.trim());
    await setUserPhoneNumber(user.uid, credential.user.phoneNumber ?? null);
  } catch (err) {
    const wrapped = new Error('phone link confirmation failed') as Error & {reason: PhoneLinkError; cause?: unknown};
    wrapped.reason = describePhoneLinkError(err);
    wrapped.cause = err;
    throw wrapped;
  }
}

/** Removes the phone number linked to the signed-in user's account. */
export async function unlinkPhoneNumber(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  try {
    await unlink(user, 'phone');
    await setUserPhoneNumber(user.uid, null);
  } catch (err) {
    const wrapped = new Error('phone unlink failed') as Error & {reason: PhoneLinkError; cause?: unknown};
    wrapped.reason = describePhoneLinkError(err);
    wrapped.cause = err;
    throw wrapped;
  }
}

/**
 * Removes the user from one chat: deletes the messages they authored (and the
 * media those messages point at), repairs the chat's cached lastMessage
 * preview, then drops them from `participants` so the chat disappears from
 * their side. Deletes the chat outright only if nobody is left in it.
 * `secretKey` (this device's own, fetched once by purgeUserData) lets
 * encrypted media pointers be resolved too, not just plaintext ones — see
 * messageMedia.ts.
 */
async function purgeChat(
  chatId: string,
  uid: string,
  report: PurgeReport,
  secretKey: Uint8Array | null,
): Promise<void> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  // Delete media first: once the message documents are gone, the URLs they
  // held — plaintext or E2EE-sealed — are unrecoverable and the Storage
  // objects would be orphaned forever.
  const mine = await getDocs(query(messagesRef, where('user._id', '==', uid)));
  for (const d of mine.docs) {
    for (const url of resolveMessageMediaUrls(d.data() as Record<string, unknown>, secretKey, chatId)) {
      if (await deleteStorageObjectByUrl(url)) report.storageObjectsDeleted++;
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
  if (mediaUrl && (await deleteStorageObjectByUrl(mediaUrl))) report.storageObjectsDeleted++;
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
 *  - Media attached to end-to-end encrypted messages is decrypted with this
 *    device's own key before deletion (see messageMedia.ts), so it's cleaned
 *    up the same as plaintext media. It's still orphaned if that key is
 *    unavailable (e.g. this device never enrolled one) or a payload fails to
 *    decrypt — but that's now the degraded case, not the default outcome.
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
    secretKey = (await getOrCreateDeviceKeypair(uid)).secretKey;
  } catch (err) {
    report.errors.push(`device key unavailable: ${String(err)}`);
  }

  // Chats — messages + their media, then leave.
  try {
    const chats = await getDocs(
      query(collection(db, 'chats'), where('participants', 'array-contains', uid)),
    );
    for (const c of chats.docs) {
      await purgeChat(c.id, uid, report, secretKey);
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
