import {doc, onSnapshot, serverTimestamp, setDoc, type Timestamp} from 'firebase/firestore';
import {db} from '../firebase';

/** Someone is considered "online" if their last heartbeat was within this window. */
export const ONLINE_WINDOW_MS = 60_000;

/** Writes the current user's `lastActiveAt` heartbeat. Best-effort. */
export async function heartbeat(uid: string): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {lastActiveAt: serverTimestamp()}, {merge: true});
  } catch {
    /* offline / permission — ignore */
  }
}

/**
 * Subscribes to another user's `lastActiveAt`, reporting it as epoch ms (or null
 * if unavailable / unreadable). Reads may be denied by profile-visibility rules,
 * in which case we simply report null and show no presence.
 */
export function listenPresence(uid: string, cb: (lastActiveMs: number | null) => void) {
  return onSnapshot(
    doc(db, 'users', uid),
    s => {
      const ts = s.data()?.lastActiveAt as Timestamp | undefined;
      cb(ts?.toMillis?.() ?? null);
    },
    () => cb(null),
  );
}
