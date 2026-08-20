import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
} from './firebase/firestore';

/**
 * Detects whether the person on the other end of a 1:1 chat still has an
 * account.
 *
 * When a user deletes their account (services/account.ts) the chat document
 * itself survives — the other participant keeps their own messages, so the
 * conversation stays readable. But nothing about it says the recipient is
 * gone, and the security rules still let the survivor write messages into it
 * (chats/{id}/messages allows any *current* participant). Without this check a
 * message sent to a deleted account is accepted by the server, renders as
 * delivered, and is read by nobody, forever.
 *
 * Mirrors web/src/services/recipient.ts — same signals, same ordering, same
 * refusal to fail closed. Keep the two in step.
 */

const db = getFirestore();

/** `unknown` means "could not determine" — callers must treat it as sendable. */
export type RecipientState = 'ok' | 'deleted' | 'unknown';

export class RecipientUnreachableError extends Error {
  readonly code = 'recipient-deleted';
  constructor(message = 'the recipient account no longer exists') {
    super(message);
    this.name = 'RecipientUnreachableError';
  }
}

export function isRecipientUnreachable(error: unknown): boolean {
  return (error as {code?: string})?.code === 'recipient-deleted';
}

/** The other participant of a 1:1 chat, or null if there isn't one. */
export function peerUidOf(participants: unknown, myUid: string): string | null {
  if (!Array.isArray(participants)) return null;
  return participants.find(p => typeof p === 'string' && p && p !== myUid) || null;
}

/**
 * Structural signal: I am the only participant left.
 *
 * `arrayRemove(uid)` on `participants` happens in exactly one place in this
 * codebase — purgeChat in services/account.ts — so a 1:1 chat that has lost its
 * other participant means that participant deleted their account. Chats are
 * always created with both uids in a single write (createChat), so there is no
 * window during which a live chat legitimately has one participant.
 *
 * Returns false for a missing/empty array: that is "not loaded yet", not
 * "deleted", and guessing wrong here would block a perfectly good conversation.
 */
export function hasLostPeer(participants: unknown, myUid: string): boolean {
  if (!Array.isArray(participants) || participants.length === 0) return false;
  return peerUidOf(participants, myUid) === null;
}

/**
 * Authoritative signal: the peer is still listed as a participant, but their
 * profile document is gone.
 *
 * Covers a partially-completed purge — purgeChat removes the participant entry
 * per chat and can report a non-fatal failure for any one of them, while the
 * profile delete at the end of purgeUserData still succeeds. Since the account
 * is gone either way, the profile is the signal that actually matches what we
 * tell the user.
 *
 * `/users/{uid}` is readable by any signed-in user, so a missing document here
 * really is a missing document and not a permission failure being mistaken for
 * one. Reads from the server on purpose, and deliberately does NOT go through
 * firebaseChat's getUserById: that function memoises profiles for the life of
 * the process, so a peer fetched before they deleted their account would keep
 * answering "still here" from the cache — precisely the case this exists for.
 */
export async function isProfileDeleted(peerUid: string): Promise<boolean> {
  try {
    const snap = await getDocFromServer(doc(db, 'users', peerUid));
    return !snap.exists();
  } catch {
    // Offline, or the read failed. Unknown is not deleted.
    return false;
  }
}

/**
 * Full check for the chat UI, run once when a chat is opened.
 *
 * Prefers the free structural signal and only pays for a profile read when the
 * peer is still listed.
 */
export async function checkRecipient(
  participants: unknown,
  myUid: string,
): Promise<RecipientState> {
  if (hasLostPeer(participants, myUid)) return 'deleted';
  const peer = peerUidOf(participants, myUid);
  if (!peer) return 'unknown'; // not loaded yet
  return (await isProfileDeleted(peer)) ? 'deleted' : 'ok';
}

/**
 * Send-path backstop. Throws RecipientUnreachableError if the chat has lost its
 * other participant.
 *
 * Uses only the structural signal and a cached read: this runs before every
 * single message, and an open chat already holds a live listener on this exact
 * document, so `getDoc` is served from the local cache without a network round
 * trip. The profile check is deliberately left to the UI, which runs it once
 * per chat open and replaces the composer — paying for a second server read on
 * every send would not buy anything the banner hasn't already prevented.
 *
 * Never throws on a failed read. Being unable to check is not evidence that the
 * recipient is gone, and blocking a real message because Firestore was briefly
 * unreachable would be a far worse bug than the one this guards against.
 */
export async function assertRecipientReachable(chatId: string, myUid: string): Promise<void> {
  let participants: unknown;
  try {
    const snap = await getDoc(doc(db, 'chats', chatId));
    if (!snap.exists()) return;
    participants = snap.data()?.participants;
  } catch {
    return;
  }
  if (hasLostPeer(participants, myUid)) throw new RecipientUnreachableError();
}
