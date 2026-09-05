/**
 * Who you can start a group with, derived from the chats you already have.
 *
 * This replaces a directory. Adding someone to a conversation used to mean
 * typing their email, which required the server to hold a searchable email for
 * every account and let any signed-in user turn a person into the list of
 * conversations they were in. Invite links removed the need for that on the
 * way *in* (services/invites.ts); this removes it for everything after.
 *
 * The set is exactly the people you have a one-to-one chat with — which is to
 * say, people you have already exchanged an invite with. Their uid is already
 * in a document you can read, so no lookup happens: this is a projection of
 * data the client is holding anyway, not a query.
 *
 * The label is your own name for them from `nameBy`, then the name they sealed
 * into the chat (services/introductions.ts), then the chat's own name. None is
 * a profile field and none was looked up; if there is no name at all they are
 * shown by the short form of their uid rather than by something the server
 * volunteered.
 *
 * Kept free of Firestore imports so it stays a pure function of data the
 * caller already has — which is also what makes it testable without a mock.
 * Callers that want the sealed names pass them in; see NewChatScreen.
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
 * never supplied one. Short enough to tell two apart, and visibly an id rather
 * than a person, so nobody reads it as a name the app knows.
 */
export function uidLabel(uid: string): string {
  return uid.slice(0, 8);
}

export function contactsFromChats(
  chats: ChatRoom[],
  myUid: string,
  /**
   * Names the other side sealed to you, by chat id — services/introductions.ts.
   * Ranked below your own label and above the chat's name, so this list calls
   * someone the same thing the chat list does.
   */
  introduced: Record<string, string> = {},
): Contact[] {
  const byUid = new Map<string, Contact>();

  for (const chat of chats) {
    const participants = chat.participants || [];
    // Direct chats only. A group tells you its members are reachable by
    // *someone*, not that you have a way to reach them yourself.
    if (participants.length !== 2 || !participants.includes(myUid)) continue;
    const peer = participants.find(uid => uid !== myUid);
    if (!peer || peer === myUid) continue;

    // updatedAt, falling back to createdAt — not the larger of the two. A chat
    // created recently and never used is less current than one created long ago
    // and used this morning, and max() would rank them the other way round.
    const activeAt = millis(chat.updatedAt) || millis(chat.createdAt);
    const named =
      chat.nameBy?.[myUid]?.trim() || introduced[chat.id]?.trim() || chat.name?.trim() || '';
    const contact: Contact = {
      uid: peer,
      // 'Chat' is what createChat writes when nobody supplied a name, so it is
      // the absence of a label rather than one.
      label: named && named !== 'Chat' ? named : uidLabel(peer),
      activeAt,
    };

    // Two direct chats with the same person can exist — the de-duplication in
    // NewChat only ever covered the chats one device could see. Keep the one
    // that has been used most recently, since that is the one the user means.
    const existing = byUid.get(peer);
    if (!existing || contact.activeAt > existing.activeAt) byUid.set(peer, contact);
  }

  return [...byUid.values()].sort(
    (a, b) => b.activeAt - a.activeAt || a.label.localeCompare(b.label),
  );
}

