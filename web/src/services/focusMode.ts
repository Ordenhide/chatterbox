import {deleteField, doc, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from '../firebase';

/**
 * Focus mode — auto-replies to anyone who messages you, until it expires.
 *
 * Only the flag lives here. The actual replying is server-side: the
 * `autoReplyFocusMode` Cloud Function triggers on new messages, reads the
 * recipient's `focusMode`, and posts the reply. That means this client just has
 * to write the same document shape the mobile app writes and the feature works
 * identically on both — there is no web-specific reply path to keep in step.
 *
 * Mirrors src/services/focusMode.ts in the mobile app. Keep the shape aligned
 * with the function's reader (`focus.until`, `focus.autoReply`, `enabled`): the
 * server is the one consumer, and it does not care which client wrote the doc.
 */

export const DEFAULT_AUTO_REPLY =
  "I'm currently in focus mode. I'll get back to you later.";

export async function enableFocusMode(
  userId: string,
  durationMs: number,
  autoReply?: string,
): Promise<void> {
  await setDoc(
    doc(db, 'users', userId),
    {
      focusMode: {
        enabled: true,
        // An absolute deadline rather than a duration: the server compares it
        // against its own clock when a message arrives, so a client that goes
        // offline mid-session still expires at the right moment.
        until: Date.now() + durationMs,
        autoReply: autoReply || DEFAULT_AUTO_REPLY,
      },
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
}

export async function disableFocusMode(userId: string): Promise<void> {
  await setDoc(
    doc(db, 'users', userId),
    {
      // `until` and `autoReply` are deleted rather than left behind, so a
      // stale deadline can't linger and make a later re-enable look expired
      // before it starts.
      focusMode: {enabled: false, until: deleteField(), autoReply: deleteField()},
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
}

/**
 * Whether a stored focusMode block is currently in effect.
 *
 * The server clears `enabled` lazily — only when a message actually arrives
 * (see autoReplyFocusMode) — so a document can read `enabled: true` well past
 * its deadline. Any UI showing focus state has to apply the deadline itself
 * rather than trusting the flag, or it will claim focus mode is on for hours
 * after it expired.
 */
export function isFocusActive(
  focus: {enabled?: boolean; until?: number} | undefined | null,
  now: number = Date.now(),
): boolean {
  if (!focus?.enabled) return false;
  return !focus.until || focus.until > now;
}
