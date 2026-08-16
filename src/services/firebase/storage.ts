/**
 * Cloud Storage, through the seam. See ./README.md.
 *
 * Unlike the other modules here this is not a pure re-export: `putFile` is the
 * one part of the storage API with no cross-platform equivalent, so it is
 * wrapped rather than forwarded.
 */
import {getDownloadURL, putFile, ref} from '@react-native-firebase/storage';

export * from '@react-native-firebase/storage';

/** A Storage reference, named without reaching for a vendor-specific type. */
export type StorageRef = ReturnType<typeof ref>;

/**
 * Uploads a local file and resolves to its download URL, reporting progress.
 *
 * The one genuinely non-portable call in the storage layer, isolated here.
 * `putFile` is React Native Firebase's own: it streams straight from a
 * filesystem path, which the Firebase JS SDK cannot do because it has no
 * filesystem to stream from. A HarmonyOS implementation reads the URI into
 * bytes and calls `uploadBytesResumable`, which exposes the same
 * `state_changed` observer — so this signature holds on both, and the two call
 * sites (chat attachments, moment media) never learn the difference.
 *
 * Returning the URL rather than the task is deliberate. Both callers did
 * exactly `putFile` → attach progress → await → `getDownloadURL`, and handing
 * back a task would re-export the platform-specific object this exists to
 * contain.
 */
export async function uploadFileFromUri(
  storageRef: StorageRef,
  uri: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const task = putFile(storageRef, uri);
  if (onProgress) {
    task.on('state_changed', snapshot => {
      const total = snapshot.totalBytes || 0;
      const transferred = snapshot.bytesTransferred || 0;
      // Guard the divide: a zero-byte total would make this NaN, and an
      // upload bar that reads NaN% is worse than one that never moves.
      if (total > 0) {
        onProgress(Math.min(100, Math.round((transferred / total) * 100)));
      }
    });
  }
  await task;
  return getDownloadURL(storageRef);
}
