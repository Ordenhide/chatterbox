/**
 * Hidden chats.
 *
 * Kept deliberately parallel to web/src/services/hiddenChats.ts — same names,
 * same semantics — matching this repo's parallel-not-shared convention.
 *
 * Hiding is per-user and stored as `hiddenBy: [uid]` on the chat document —
 * the same shape as the existing `pinnedBy` / `mutedBy` arrays, so it needs no
 * schema migration and no security-rules change (participants may already
 * update their own chat doc).
 *
 * Two decisions worth stating, because both are the opposite of "archive" in
 * some other apps:
 *
 * 1. A new message does **not** unhide the chat. "Hidden until you recover it"
 *    is what the word promises; a chat that reappears on its own would be a
 *    privacy surprise, and this app already has mute for "keep it visible but
 *    quiet".
 * 2. Hiding is deliberately independent of muting. They compose — hide for
 *    out-of-sight, mute for silence, both for neither — rather than one
 *    silently implying the other.
 *
 * Hiding is *not* a security boundary: the other participant is unaffected,
 * and the chat is still readable by anyone with access to this account. It
 * controls what this user sees in their own list, nothing more.
 */
import type {ChatRoom} from '../types';

export function isChatHidden(chat: Pick<ChatRoom, 'hiddenBy'>, uid: string): boolean {
  return !!chat.hiddenBy?.includes(uid);
}

/**
 * Splits chats into what belongs in the normal list and what has been hidden.
 * A single pass so the list and the "Hidden" entry can never disagree about
 * which bucket a chat is in.
 */
export function partitionChats<T extends Pick<ChatRoom, 'hiddenBy'>>(
  chats: T[],
  uid: string,
): {visible: T[]; hidden: T[]} {
  // Generic over the element type: the mobile list decorates each chat with
  // display fields before rendering, and narrowing to ChatRoom here would
  // silently strip them.
  const visible: T[] = [];
  const hidden: T[] = [];
  for (const chat of chats) (isChatHidden(chat, uid) ? hidden : visible).push(chat);
  return {visible, hidden};
}

/**
 * Unread total across a set of chats, skipping muted ones — matching what the
 * Chats badge already counts, so the hidden entry reads consistently with it.
 */
export function unreadTotal(
  chats: Pick<ChatRoom, 'mutedBy' | 'unreadCountBy'>[],
  uid: string,
): number {
  return chats.reduce(
    (sum, chat) => (chat.mutedBy?.includes(uid) ? sum : sum + (chat.unreadCountBy?.[uid] || 0)),
    0,
  );
}
