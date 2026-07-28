import {getApp} from 'firebase/app';
import {getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject} from 'firebase/storage';

// Exported so account.ts can delete objects through the same instance rather
// than standing up a second one.
export const storage = getStorage(getApp());

/**
 * Maps a failed upload to a specific i18n key. Every media failure used to
 * collapse into one generic "needs Storage and a session" toast, which hid the
 * actual cause — a denied rule, a signed-out session, and a dropped connection
 * all looked identical. The raw code is logged alongside so the console shows
 * exactly which Storage error fired.
 */
export function describeUploadError(err: unknown): string {
  const code = (err as {code?: string} | null)?.code ?? '';
  switch (code) {
    case 'storage/unauthorized':
      return 'chat.uploadDenied';
    case 'storage/unauthenticated':
      return 'chat.uploadSignedOut';
    case 'storage/retry-limit-exceeded':
    case 'storage/canceled':
      return 'chat.uploadNetwork';
    case 'storage/quota-exceeded':
      return 'chat.uploadQuota';
    case 'permission-denied':
      // The file reached Storage but the Firestore message write was rejected.
      return 'chat.uploadSentButNotSaved';
    default:
      return 'chat.uploadFailed';
  }
}

/** Logs the underlying Storage/Firestore error code so failures are diagnosable. */
export function logUploadError(context: string, err: unknown): void {
  const code = (err as {code?: string} | null)?.code ?? '(no code)';
  console.warn(`${context} failed [${code}]:`, err);
}

/**
 * Ceiling on a base64 data URI stored directly in a Firestore message document.
 * Firestore caps a document at 1 MiB and base64 inflates bytes by 4/3, so this
 * leaves comfortable headroom for the rest of the message (reply preview, user,
 * mentions). Mirrors the mobile app's inline-audio budget.
 */
export const MAX_INLINE_DATA_URI_CHARS = 700_000;

/**
 * Room reserved for the `data:<mime>;base64,` prefix. The longest type we
 * record is `audio/webm;codecs=opus` (~22 chars), so 128 is generous.
 */
const DATA_URI_PREFIX_BUDGET = 128;

/**
 * Raw byte budget that stays under MAX_INLINE_DATA_URI_CHARS once base64-encoded
 * *including* the prefix — base64 emits 4 characters per 3 bytes. Without the
 * prefix allowance a clip at exactly the budget encoded to 700,023 chars and was
 * silently rejected.
 */
export const MAX_INLINE_BYTES = Math.floor(
  ((MAX_INLINE_DATA_URI_CHARS - DATA_URI_PREFIX_BUDGET) * 3) / 4,
);

/** Reads a Blob into a `data:<mime>;base64,…` URI. */
export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('could not read blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Encodes a recording for storage *inside* the Firestore message, avoiding
 * Cloud Storage entirely. Returns null when the clip is too large to inline,
 * so the caller can fall back to a Storage upload.
 */
export async function encodeInlineMedia(blob: Blob): Promise<string | null> {
  if (blob.size > MAX_INLINE_BYTES) return null;
  const uri = await blobToDataUri(blob);
  return uri.length > MAX_INLINE_DATA_URI_CHARS ? null : uri;
}

/** Maps a recorder MIME type (which may carry `;codecs=…`) to a file extension. */
export function extensionForMime(mime: string): string {
  const base = mime.split(';')[0].trim();
  if (base === 'audio/mp4' || base === 'audio/aac') return 'm4a';
  if (base === 'audio/mpeg') return 'mp3';
  if (base === 'audio/ogg') return 'ogg';
  return 'webm';
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
function extFor(blob: Blob, fallbackName: string): string {
  return EXT_BY_TYPE[blob.type] || (fallbackName.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
}

/**
 * Downscales/re-encodes an image in the browser before upload so a full-size
 * phone photo (5–12 MB) doesn't waste bandwidth and Storage. Returns the
 * original file untouched for non-images, GIFs, already-small images, or if
 * anything goes wrong (canvas unavailable, decode failure, no size win).
 */
export async function downscaleImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const largest = Math.max(bitmap.width, bitmap.height);
    if (largest <= maxDim) {
      bitmap.close?.();
      return file;
    }
    const scale = maxDim / largest;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function uploadWithProgress(
  path: string,
  blob: Blob,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob);
    task.on(
      'state_changed',
      s => onProgress?.(s.totalBytes ? Math.round((s.bytesTransferred / s.totalBytes) * 100) : 0),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });
}

export function uploadChatFile(
  chatId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return uploadWithProgress(`chats/${chatId}/${Date.now()}-${sanitize(file.name)}`, file, onProgress);
}

/** Uploads a photo to a chat, downscaling it in the browser first. */
export async function uploadChatImage(
  chatId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const blob = await downscaleImage(file);
  return uploadWithProgress(`chats/${chatId}/${Date.now()}.${extFor(blob, file.name)}`, blob, onProgress);
}

export function uploadChatBlob(
  chatId: string,
  blob: Blob,
  ext: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return uploadWithProgress(`chats/${chatId}/${Date.now()}.${ext}`, blob, onProgress);
}

export async function uploadMomentImage(
  uid: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const blob = await downscaleImage(file);
  return uploadWithProgress(`moments/${uid}/${Date.now()}.${extFor(blob, file.name)}`, blob, onProgress);
}

/** Best-effort delete of a moment's media file, given its download URL. */
export async function deleteMomentImage(url: string): Promise<void> {
  try {
    await deleteObject(ref(storage, url));
  } catch {
    // file may already be gone, or the URL doesn't map to a storage object
  }
}
