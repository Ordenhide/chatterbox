/**
 * Recently deleted messages — a recovery window before permanent removal.
 *
 * Kept deliberately parallel to web/src/services/messageTrash.ts — same names,
 * same semantics — matching this repo's parallel-not-shared convention.
 *
 * Deleting moves the message document into `chats/{chatId}/trash/{messageId}`
 * with `deletedBy` / `deletedAt`, rather than flagging it in place. Two
 * reasons, both load-bearing:
 *
 * - The thread query stays untouched. Firestore rejects an entire query when
 *   the read rule tests a field the query doesn't filter on, so a
 *   `deleted == false` rule on /messages would have broken the message list.
 * - The rules can then be strict: only the deleter may read the trashed copy.
 *   Left in /messages, the other participant's client could still fetch it,
 *   and "delete for everyone" would have quietly become a UI illusion.
 *
 * **Storage media is deliberately NOT removed at delete time** — that happens
 * only at purge. Deleting the blob up front would make recovery restore a
 * message pointing at a 404.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from './firebase/firestore';
import {resolveMessageMediaUrls} from './messageMedia';
import {deleteObject, getStorage, ref} from './firebase/storage';
import {getDeviceKeypairIfEnrolled} from './e2eeKeys';

const storage = getStorage();

/**
 * Local copy of firebaseChat's helper rather than an import: that module
 * already imports this one, and a static cycle between them is fragile.
 */
async function deleteStorageObjectByUrl(url: string): Promise<boolean> {
  // Inline media (data: URIs) lives inside the Firestore document itself, so
  // there is no Storage object behind it — and ref() would throw.
  if (!url.startsWith('http')) return false;
  try {
    await deleteObject(ref(storage, url));
    return true;
  } catch {
    return false;
  }
}

/**
 * How long a deleted message stays recoverable.
 *
 * 24 hours covers the case this exists for — "I deleted that by accident" —
 * without turning an end-to-end encrypted app into a month-long archive of
 * content its users believe they destroyed. Change this one constant to
 * change the window everywhere.
 */
export const TRASH_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface TrashedMessage {
  id: string;
  deletedAt: number;
  deletedBy: string;
  /** The original message document, restored verbatim on recovery. */
  payload: Record<string, unknown>;
}

export function isTrashExpired(deletedAt: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(deletedAt)) return true; // unreadable timestamp → not recoverable
  return now - deletedAt >= TRASH_RETENTION_MS;
}

/** Milliseconds of recovery time left; 0 once the window has closed. */
export function msRemaining(deletedAt: number, now: number = Date.now()): number {
  if (!Number.isFinite(deletedAt)) return 0;
  return Math.max(0, deletedAt + TRASH_RETENTION_MS - now);
}

/** Coarse "23h left" / "45m left" / "30s left" label for the recovery list. */
export function formatRemaining(deletedAt: number, now: number = Date.now()): string {
  const ms = msRemaining(deletedAt, now);
  if (ms <= 0) return '0m';
  const mins = Math.floor(ms / 60_000);
  if (mins >= 60) return `${Math.floor(mins / 60)}h`;
  if (mins >= 1) return `${mins}m`;
  return `${Math.ceil(ms / 1000)}s`;
}

const db = getFirestore();
const chatDoc = (chatId: string) => doc(collection(db, 'chats'), chatId);
const trashRef = (chatId: string) => collection(chatDoc(chatId), 'trash');
const msgRef = (chatId: string, id: string) => doc(collection(chatDoc(chatId), 'messages'), id);

/**
 * Moves messages into the trash. Returns the ids that were actually moved —
 * a message already gone (deleted on another device) is skipped rather than
 * treated as an error.
 */
export async function trashMessages(
  chatId: string,
  messageIds: string[],
  uid: string,
): Promise<string[]> {
  const ids = [...new Set(messageIds)].filter(Boolean);
  const moved: string[] = [];
  const deletedAt = Date.now();

  for (const id of ids) {
    const snap = await getDoc(msgRef(chatId, id)).catch(() => null);
    if (!snap?.exists()) continue;
    // Copy first, delete second: if the copy fails the message is still in the
    // thread, which is a far better failure than losing it entirely.
    await setDoc(doc(trashRef(chatId), id), {
      payload: snap.data(),
      deletedBy: uid,
      deletedAt,
    });
    moved.push(id);
  }

  for (let i = 0; i < moved.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of moved.slice(i, i + 450)) batch.delete(msgRef(chatId, id));
    await batch.commit();
  }
  return moved;
}

/** Puts a trashed message back into the thread, unchanged. */
export async function recoverMessage(chatId: string, messageId: string): Promise<boolean> {
  const snap = await getDoc(doc(trashRef(chatId), messageId));
  if (!snap.exists()) return false;
  const data = snap.data() as {payload?: Record<string, unknown>; deletedAt?: number};
  if (!data.payload || isTrashExpired(Number(data.deletedAt))) return false;

  // Restore before removing the trash copy, so a failure here leaves the
  // message recoverable rather than destroying it.
  await setDoc(msgRef(chatId, messageId), data.payload);
  await deleteDoc(doc(trashRef(chatId), messageId)).catch(() => undefined);
  return true;
}

/** Live list of this user's recoverable messages, newest deletion first. */
export function listenTrash(chatId: string, uid: string, cb: (items: TrashedMessage[]) => void) {
  // Filter only, then sort in memory. Combining where + orderBy would demand a
  // composite index, and a user's trash is bounded by the retention window, so
  // sorting client-side costs nothing and keeps the feature deploy-free.
  const q = query(trashRef(chatId), where('deletedBy', '==', uid));
  return onSnapshot(
    q,
    snap =>
      cb(
        snap.docs
          .map(d => {
            const data = d.data() as {payload?: Record<string, unknown>; deletedAt?: number};
            return {
              id: d.id,
              deletedAt: Number(data.deletedAt) || 0,
              deletedBy: uid,
              payload: data.payload || {},
            };
          })
          .filter(item => !isTrashExpired(item.deletedAt))
          .sort((x, y) => y.deletedAt - x.deletedAt),
      ),
    err => {
      console.warn('listenTrash error:', err.message);
      cb([]);
    },
  );
}

/**
 * Permanently removes trash past its window, along with any Storage media it
 * still owns — the point where deletion actually becomes irreversible.
 *
 * Runs on the client because this project has no scheduled functions enabled
 * (see functions/index.js's SCHEDULED_ENABLED note). The consequence worth
 * knowing: expired trash lingers until some client of this user opens the
 * chat, rather than disappearing exactly on schedule.
 */
export async function purgeExpiredTrash(chatId: string, uid: string): Promise<number> {
  const snap = await getDocs(query(trashRef(chatId), where('deletedBy', '==', uid))).catch(
    () => null,
  );
  if (!snap) return 0;

  let secretKey: Uint8Array | null = null;
  try {
    // Non-enrolling. This runs on chat open, so the enrolling variant made
    // a housekeeping sweep — one whose whole failure mode is "expired trash
    // lingers a while" — capable of publishing a new key over the account's.
    const keypair = await getDeviceKeypairIfEnrolled(uid);
    secretKey = keypair?.secretKey ?? null;
    if (!keypair) {
      console.warn('purgeExpiredTrash: device not enrolled; sealed entries left in place');
    }
  } catch (error) {
    console.warn('purgeExpiredTrash: device key unavailable:', error);
  }

  let purged = 0;
  for (const d of snap.docs) {
    const data = d.data() as {payload?: Record<string, unknown>; deletedAt?: number};
    if (!isTrashExpired(Number(data.deletedAt))) continue;

    const urls = data.payload
      ? resolveMessageMediaUrls(data.payload, secretKey, chatId)
      : [];
    // Storage first: if the doc went first and this failed, the blob would be
    // orphaned with nothing left pointing at it.
    await Promise.all(urls.map(url => deleteStorageObjectByUrl(url).catch(() => false)));
    await deleteDoc(d.ref).catch(() => undefined);
    purged += 1;
  }
  return purged;
}
