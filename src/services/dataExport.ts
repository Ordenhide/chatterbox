/**
 * Builds a downloadable copy of everything Firestore holds for one user —
 * the "download my data" counterpart to purgeUserData's delete-everything
 * walk (see account.ts): same collection traversal, but reading and
 * decrypting instead of deleting. Runs entirely client-side for the same
 * reason purgeUserData does — see account.ts's module doc.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from './firebase/firestore';
import {decryptMessage, isEncryptedPayload, type EncryptedPayload} from './e2ee';
import {getDeviceKeypairIfEnrolled} from './e2eeKeys';
import {USER_SUBCOLLECTIONS} from './userSubcollections';

const db = getFirestore();

export interface DataExportReport {
  chatsProcessed: number;
  messagesProcessed: number;
  messagesDecryptFailed: number;
  momentsProcessed: number;
  errors: string[];
}

export type DecryptionStatus = 'plaintext' | 'decrypted' | 'partial' | 'failed';

export interface UserDataExport {
  exportFormatVersion: 1;
  exportedAt: string;
  uid: string;
  profile: Record<string, unknown> | null;
  private: Record<string, unknown>[];
  publicKeys: Record<string, unknown>[];
  oneTimePreKeys: Record<string, unknown>[];
  bookmarks: Record<string, unknown>[];
  reminders: Record<string, unknown>[];
  chats: Record<string, unknown>[];
  moments: Record<string, unknown>[];
  friends: Record<string, unknown>[];
  friendRequests: Record<string, unknown>[];
  blocks: Record<string, unknown>[];
  notes: string[];
  report: DataExportReport;
}

const EXPORT_NOTES = [
  'Larger photos, videos, and voice messages are included as links to Firebase Storage rather than embedded files; smaller ones are stored inline and appear here as their actual data.',
  "Comments and likes you left on other people's moments are not included (only those on your own moments).",
  'Feedback you submitted through the app is not included in this export.',
  'This export never includes your end-to-end encryption secret key.',
  'Drafts and other device-only settings are not included, since they never leave this device.',
];

/**
 * Recursively converts Firestore Timestamp-shaped values (duck-typed via
 * `.toDate()`) to ISO 8601 strings so the result is plain-JSON-serializable.
 * Arrays and plain objects are walked; everything else passes through as-is.
 */
export function sanitizeForExport(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  const maybeTimestamp = value as {toDate?: unknown};
  if (typeof maybeTimestamp.toDate === 'function') {
    try {
      return (maybeTimestamp.toDate as () => Date)().toISOString();
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) return value.map(sanitizeForExport);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = sanitizeForExport(v);
  }
  return out;
}

/** Which plain field an encrypted envelope field decrypts into. */
const ENCRYPTED_FIELD_MAP: ReadonlyArray<readonly [string, string]> = [
  ['encrypted', 'text'],
  ['encryptedImage', 'image'],
  ['encryptedVideo', 'video'],
  ['encryptedAudio', 'audio'],
  ['encryptedFileUri', 'file'],
];

/**
 * Decrypts one message document's encrypted fields for export, stripping the
 * raw ciphertext envelopes from the output. Never throws: a field that fails
 * to decrypt (wrong/rotated key, or a message from before this device
 * enrolled — see e2ee.ts's module doc) is simply left unset, and the
 * message's `decryptionStatus` reflects how much of it came through, mirroring
 * ChatScreen.tsx's own decrypt loop (placeholder text there, a status flag
 * here since this output is meant to be machine-readable).
 */
export function sanitizeMessageForExport(
  raw: Record<string, unknown>,
  secretKey: Uint8Array | null,
  chatId: string,
): Record<string, unknown> {
  const clean = sanitizeForExport(raw) as Record<string, unknown>;
  let sawEncrypted = false;
  let anyFailed = false;
  let anySucceeded = false;

  for (const [encField, plainField] of ENCRYPTED_FIELD_MAP) {
    const payload = raw[encField];
    delete clean[encField];
    if (!isEncryptedPayload(payload)) continue;
    sawEncrypted = true;
    if (!secretKey) {
      anyFailed = true;
      continue;
    }
    try {
      const text = decryptMessage(payload as EncryptedPayload, secretKey, chatId);
      if (plainField === 'file') {
        clean.file = {...(clean.file as Record<string, unknown> | undefined), uri: text};
      } else {
        clean[plainField] = text;
      }
      anySucceeded = true;
    } catch {
      anyFailed = true;
    }
  }

  const decryptionStatus: DecryptionStatus = !sawEncrypted
    ? 'plaintext'
    : anyFailed
      ? anySucceeded
        ? 'partial'
        : 'failed'
      : 'decrypted';
  clean.decryptionStatus = decryptionStatus;
  if (decryptionStatus === 'failed' || decryptionStatus === 'partial') {
    clean.decryptionError = "could not decrypt with this device's key";
  }
  return clean;
}

/** doc.id + sanitized field data, for every doc a query/collection ref returns. */
async function dumpDocs(q: any): Promise<Record<string, unknown>[]> {
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => ({id: d.id, ...(sanitizeForExport(d.data()) as object)}));
}

/** Runs several queries and merges their results, de-duplicated by doc id. */
async function dumpDocsUnion(queries: any[]): Promise<Record<string, unknown>[]> {
  const byId = new Map<string, Record<string, unknown>>();
  for (const q of queries) {
    for (const d of await dumpDocs(q)) {
      byId.set(d.id as string, d);
    }
  }
  return Array.from(byId.values());
}

async function fetchChatExport(
  chatId: string,
  chatData: Record<string, unknown>,
  secretKey: Uint8Array | null,
  report: DataExportReport,
): Promise<Record<string, unknown>> {
  const messagesSnap = await getDocs(collection(db, 'chats', chatId, 'messages'));
  const messages = messagesSnap.docs.map((d: any) => {
    report.messagesProcessed++;
    const exported = sanitizeMessageForExport(d.data(), secretKey, chatId);
    if (exported.decryptionStatus === 'failed' || exported.decryptionStatus === 'partial') {
      report.messagesDecryptFailed++;
    }
    return {id: d.id, ...exported};
  });
  messages.sort((a: any, b: any) => {
    const at = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : Number(a.createdAt) || 0;
    const bt = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : Number(b.createdAt) || 0;
    return at - bt;
  });

  const chat: Record<string, unknown> = {
    id: chatId,
    ...(sanitizeForExport(chatData) as object),
    messages,
  };
  for (const sub of [
    'calls',
    'scheduledMessages',
    'sharedLists',
    'quoteWall',
    'playlist',
    'countdowns',
  ]) {
    try {
      chat[sub] = await dumpDocs(collection(db, 'chats', chatId, sub));
    } catch (error) {
      report.errors.push(`chat ${chatId}/${sub} failed: ${String(error)}`);
      chat[sub] = [];
    }
  }
  return chat;
}

async function fetchMomentExport(
  momentId: string,
  momentData: Record<string, unknown>,
  report: DataExportReport,
): Promise<Record<string, unknown>> {
  const moment: Record<string, unknown> = {id: momentId, ...(sanitizeForExport(momentData) as object)};
  for (const sub of ['likes', 'comments']) {
    try {
      moment[sub] = await dumpDocs(collection(db, 'moments', momentId, sub));
    } catch (error) {
      report.errors.push(`moment ${momentId}/${sub} failed: ${String(error)}`);
      moment[sub] = [];
    }
  }
  return moment;
}

/**
 * Gathers and decrypts everything Firestore holds for `uid` into one
 * JSON-serializable object, for the "download my data" feature. Mirrors
 * purgeUserData's traversal (account.ts) collection-for-collection; see its
 * docstring for the same rules-imposed limits (likes/comments left on
 * *other* people's moments aren't reachable, etc.) — restated in `notes` so
 * they're visible in the exported file itself, not just this source.
 *
 * Never includes the E2EE secret key: `secretKey` is only ever passed as an
 * argument to `decryptMessage`, which returns plaintext, not key material —
 * nothing in this module writes it into the output tree.
 */
export async function exportUserData(uid: string): Promise<UserDataExport> {
  const report: DataExportReport = {
    chatsProcessed: 0,
    messagesProcessed: 0,
    messagesDecryptFailed: 0,
    momentsProcessed: 0,
    errors: [],
  };

  let secretKey: Uint8Array | null = null;
  try {
    // Non-enrolling: an export reads, and the report already has a place to
    // say the key was unavailable. Minting one here would produce an export
    // that could decrypt nothing *and* strand the history it failed to read.
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

  let profile: Record<string, unknown> | null = null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    profile = snap.exists() ? (sanitizeForExport(snap.data()) as Record<string, unknown>) : null;
  } catch (error) {
    report.errors.push(`profile failed: ${String(error)}`);
  }

  const chats: Record<string, unknown>[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'chats'), where('participants', 'array-contains', uid)),
    );
    for (const c of snap.docs) {
      try {
        chats.push(await fetchChatExport(c.id, c.data(), secretKey, report));
        report.chatsProcessed++;
      } catch (error) {
        report.errors.push(`chat ${c.id} failed: ${String(error)}`);
      }
    }
  } catch (error) {
    report.errors.push(`chats failed: ${String(error)}`);
  }

  const moments: Record<string, unknown>[] = [];
  try {
    const snap = await getDocs(query(collection(db, 'moments'), where('authorId', '==', uid)));
    for (const m of snap.docs) {
      try {
        moments.push(await fetchMomentExport(m.id, m.data(), report));
        report.momentsProcessed++;
      } catch (error) {
        report.errors.push(`moment ${m.id} failed: ${String(error)}`);
      }
    }
  } catch (error) {
    report.errors.push(`moments failed: ${String(error)}`);
  }

  let friends: Record<string, unknown>[] = [];
  try {
    friends = await dumpDocs(query(collection(db, 'friends'), where('userIds', 'array-contains', uid)));
  } catch (error) {
    report.errors.push(`friends failed: ${String(error)}`);
  }

  let friendRequests: Record<string, unknown>[] = [];
  try {
    friendRequests = await dumpDocsUnion([
      query(collection(db, 'friendRequests'), where('fromId', '==', uid)),
      query(collection(db, 'friendRequests'), where('toId', '==', uid)),
    ]);
  } catch (error) {
    report.errors.push(`friendRequests failed: ${String(error)}`);
  }

  let blocks: Record<string, unknown>[] = [];
  try {
    blocks = await dumpDocsUnion([
      query(collection(db, 'blocks'), where('blockerId', '==', uid)),
      query(collection(db, 'blocks'), where('blockedId', '==', uid)),
    ]);
  } catch (error) {
    report.errors.push(`blocks failed: ${String(error)}`);
  }

  const owned: Record<string, Record<string, unknown>[]> = Object.fromEntries(
    USER_SUBCOLLECTIONS.map(sub => [sub, [] as Record<string, unknown>[]]),
  );
  for (const sub of USER_SUBCOLLECTIONS) {
    try {
      owned[sub] = await dumpDocs(collection(db, 'users', uid, sub));
    } catch (error) {
      report.errors.push(`users/${uid}/${sub} failed: ${String(error)}`);
    }
  }

  return {
    exportFormatVersion: 1,
    exportedAt: new Date().toISOString(),
    uid,
    profile,
    private: owned.private,
    publicKeys: owned.publicKeys,
    oneTimePreKeys: owned.oneTimePreKeys,
    bookmarks: owned.bookmarks,
    reminders: owned.reminders,
    chats,
    moments,
    friends,
    friendRequests,
    blocks,
    notes: EXPORT_NOTES,
    report,
  };
}
