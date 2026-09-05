import type {ChatRoom, UserProfile} from '../types';

export interface ChatMeta {
  title: string;
  /** Stable per-chat identity for anything that needs to seed off it (avatar
   * color, cipher texture) — the other participant's uid for a 1:1, this
   * chat's own id as a fallback for a chat with only yourself in it. */
  seed: string;
}

/**
 * A chat's display title and identity seed, given what's known about its
 * participants so far.
 *
 * Shared by HomeScreen's sidebar and QuickSwitcher's palette — both list the
 * same chats and must resolve the same title for a given one, so this lives
 * here rather than duplicated in each.
 *
 * A group titled after whichever member happens to be first in the
 * participants array reads as a 1:1 with the wrong person, so groups use the
 * chat's own name (set at creation from the member list) and then a plain
 * count — never a single member's name. Mirrors the mobile header.
 */
export function resolveChatMeta(
  chat: ChatRoom,
  myUid: string,
  userCache: Record<string, UserProfile>,
): ChatMeta {
  const custom = chat.nameBy?.[myUid];
  const otherUid = chat.participants.find(p => p !== myUid) || chat.id;
  const other = otherUid ? userCache[otherUid] : undefined;
  const isGroup = chat.participants.length > 2;
  const title = isGroup
    ? custom || chat.name || `${chat.participants.length} members`
    : custom || other?.displayName || chat.name || 'Chat';
  return {title, seed: otherUid};
}
