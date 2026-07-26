import {getApp} from 'firebase/app';
import {getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject} from 'firebase/storage';
import {doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from '../firebase';

const storage = getStorage(getApp());

/**
 * Firebase Storage rules require the uploader's user doc to carry a non-null
 * `activeSessionId` (the app's single-session gate). We claim one only if none
 * exists, so a web-only user can upload media without stomping an active mobile
 * session. (If a device later claims the session, media still works here since
 * the field just needs to be non-null.)
 */
export async function ensureActiveSession(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const current = snap.exists() ? (snap.data().activeSessionId as string | null) : null;
  if (current) return;
  let sid = localStorage.getItem('cb_web_session');
  if (!sid) {
    sid = 'web-' + (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    localStorage.setItem('cb_web_session', sid);
  }
  await setDoc(userRef, {activeSessionId: sid, sessionUpdatedAt: serverTimestamp()}, {merge: true});
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
