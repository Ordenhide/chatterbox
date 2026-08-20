/**
 * Cloud Storage for HarmonyOS, via the pure-JS Firebase SDK. See ./README.md.
 *
 * The one module where the seam earns more than an import swap: `putFile` has
 * no JS SDK equivalent, so `uploadFileFromUri` is implemented differently here
 * while presenting the identical signature to its two callers.
 */
import {
  getStorage as getStorageJS,
  ref,
  getDownloadURL,
  uploadBytesResumable,
  type FirebaseStorage,
} from 'firebase/storage';
import {app} from './app.harmony';

export * from 'firebase/storage';

export type StorageRef = ReturnType<typeof ref>;

export function getStorage(_app?: unknown, bucketUrl?: string): FirebaseStorage {
  return getStorageJS(app, bucketUrl);
}

/**
 * Uploads a local file and resolves to its download URL, reporting progress.
 *
 * React Native Firebase's `putFile` streams straight from a filesystem path.
 * The JS SDK has no filesystem to stream from, so the file is read into memory
 * first — `fetch()` on a `file://` URI is the portable way to do that in a
 * React Native runtime, and RNOH implements it.
 *
 * The whole file is buffered before the upload starts, which is the real cost
 * of this approach: a large video briefly occupies its own size in memory,
 * where putFile streamed it. The app's existing limits keep that bounded
 * (50MB video, 25MB file — see ChatScreen), and staying inside them matters
 * more on this platform than on the others.
 *
 * Progress reporting is genuine, not synthesised: `uploadBytesResumable`
 * exposes the same `state_changed` observer putFile does, so the callback
 * fires with real byte counts through the upload.
 */
export async function uploadFileFromUri(
  storageRef: StorageRef,
  uri: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`uploadFileFromUri: could not read ${uri} (${response.status})`);
  }
  const blob = await response.blob();

  const task = uploadBytesResumable(storageRef, blob);
  if (onProgress) {
    task.on('state_changed', snapshot => {
      const total = snapshot.totalBytes || 0;
      const transferred = snapshot.bytesTransferred || 0;
      // Guard the divide: a zero-byte total would make this NaN, and an upload
      // bar that reads NaN% is worse than one that never moves.
      if (total > 0) {
        onProgress(Math.min(100, Math.round((transferred / total) * 100)));
      }
    });
  }
  await task;
  return getDownloadURL(storageRef);
}
