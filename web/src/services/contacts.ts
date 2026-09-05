/**
 * Who you can start a group with, derived from the chats you already have.
 * Mirrors src/services/contacts.ts on mobile — see that file for why there is
 * no lookup here.
 *
 * Kept as its own module rather than folded into chatMeta.ts because the
 * question is different: chatMeta asks what to *call* a chat you are already
 * looking at, this asks who you are able to reach at all.
 */
import type {ChatRoom} from '../types';

export type Contact = {
  uid: string;
  label: string;
  /** For ordering — the most recently active chats first. */
  activeAt: number;
};

function millis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const withToDate = value as {toDate?: () => Date};
  if (typeof withToDate.toDate === 'function') return withToDate.toDate().getTime();
  const parsed = new Date(value as string).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * A uid is not a name, but it is the only true thing available when the user
 * never supplied one. Short enough to tell two apart, and visibly an id.
 */
export function uidLabel(uid: string): string {
  return uid.slice(0, 8);
}

export function contactsFromChats(chats: ChatRoom[], myUid: string): Contact[] {
  const byUid = new Map<string, Contact>();

  for (const chat of chats) {
    const participants = chat?.participants || [];
    // Direct chats only. A group tells you its members are reachable by
    // someone, not that you have a way to reach them yourself.
    if (participants.length !== 2 || !participants.includes(myUid)) continue;
    const peer = participants.find(uid => uid !== myUid);
    if (!peer || peer === myUid) continue;

    // updatedAt, falling back to createdAt — not the larger of the two. A chat
    // created recently and never used is less current than one created long ago
    // and used this morning.
    const activeAt = millis(chat.updatedAt) || millis(chat.createdAt);
    const named = chat.nameBy?.[myUid]?.trim() || chat.name?.trim() || '';
    const contact: Contact = {
      uid: peer,
      // 'Chat' is what createChat writes when nobody supplied a name, so it is
      // the absence of a label rather than one.
      label: named && named !== 'Chat' ? named : uidLabel(peer),
      activeAt,
    };

    const existing = byUid.get(peer);
    if (!existing || contact.activeAt > existing.activeAt) byUid.set(peer, contact);
  }

  return [...byUid.values()].sort(
    (a, b) => b.activeAt - a.activeAt || a.label.localeCompare(b.label),
  );
}
