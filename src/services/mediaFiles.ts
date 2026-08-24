/**
 * The filesystem and network half of encrypted attachments.
 *
 * {@link ./mediaCrypto} is pure and knows nothing about devices; this module
 * binds it to react-native-blob-util and to Cloud Storage. The split is what
 * lets the cryptography be tested in Node without a simulator, which matters
 * because the cryptography is the part that has to be right.
 *
 * Everything here streams through files rather than JS memory. At this app's
 * own limits — 50MB video, 25MB attachment — reading a whole file into a
 * string, base64-encoding it, and holding the ciphertext alongside would peak
 * at several hundred megabytes, which on a mid-range phone is a crash rather
 * than a slowdown. So: encrypt file→file, hand the *path* to Storage's
 * `putFile` (which streams), and on the way back download straight to a file
 * and decrypt file→file.
 *
 * The one deliberate inefficiency is how a byte range is read. blob-util has
 * no seeking reader, so {@link fileSource} slices the range into a temp file
 * and reads that back — three native calls and a temporary per chunk. The
 * alternative, its sequential `readStream`, cannot serve the random access the
 * ByteSource contract offers and would need a second, subtly different code
 * path. Correctness at one temp file per megabyte is the better trade here.
 */
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  type ByteSink,
  type ByteSource,
  type MediaKeyInfo,
  type ProgressFn,
  decryptMedia,
  encryptMedia,
} from './mediaCrypto';
import {base64ToBytes, bytesToBase64} from './crypto';

const fs = ReactNativeBlobUtil.fs;

/** Strips the `file://` scheme — the native FS module expects a bare path. */
export function toPath(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.replace('file://', '')) : uri;
}

function uniqueSuffix(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** A scratch path in the caches directory, which the OS is free to reclaim. */
export function scratchPath(label: string, extension = 'bin'): string {
  return `${fs.dirs.CacheDir}/${label}_${uniqueSuffix()}.${extension}`;
}

/** Best-effort delete. Never throws — callers use it in `finally`. */
export async function discard(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await fs.unlink(toPath(path));
  } catch {
    // Already gone, or the caches directory was reclaimed underneath us.
  }
}

/** Random-access reader over a file on disk. See the module note on slicing. */
export async function fileSource(uri: string): Promise<ByteSource> {
  const path = toPath(uri);
  const stat = await fs.stat(path);
  const size = Number(stat.size);
  if (!Number.isFinite(size) || size < 0) {
    throw new Error(`mediaFiles: cannot size ${path}`);
  }
  return {
    size,
    async read(offset, length) {
      if (length === 0) return new Uint8Array(0);
      const slice = scratchPath('slice');
      try {
        await fs.slice(path, slice, offset, offset + length);
        return base64ToBytes(await fs.readFile(slice, 'base64'));
      } finally {
        await discard(slice);
      }
    },
  };
}

/**
 * Appending writer. Truncates any existing file on first write so a reused
 * scratch path cannot leave a previous run's tail glued to this one's output.
 */
export async function fileSink(path: string): Promise<ByteSink> {
  const target = toPath(path);
  await fs.writeFile(target, '', 'base64');
  return {
    async write(bytes) {
      if (bytes.length === 0) return;
      await fs.appendFile(target, bytesToBase64(bytes), 'base64');
    },
  };
}

export type EncryptedUpload = {
  /** Path to the ciphertext, ready to hand to Storage. Caller deletes it. */
  path: string;
  info: MediaKeyInfo;
};

/**
 * Encrypts a local file to a scratch path and returns it with its key.
 *
 * The caller owns the returned path and must delete it once uploaded —
 * {@link uploadEncrypted} does exactly that and is what call sites should use.
 */
export async function encryptToScratch(
  uri: string,
  options: {mime?: string; onProgress?: ProgressFn} = {},
): Promise<EncryptedUpload> {
  const path = scratchPath('enc');
  try {
    const source = await fileSource(uri);
    const sink = await fileSink(path);
    const info = await encryptMedia(source, sink, options);
    return {path, info};
  } catch (error) {
    await discard(path);
    throw error;
  }
}

/**
 * Downloads a ciphertext object and decrypts it to a local file.
 *
 * Returns the plaintext path. Throws {@link MediaIntegrityError} if the object
 * does not authenticate under `info` — callers must treat that as "do not
 * display this", not as a transient failure to retry.
 */
export async function downloadAndDecrypt(
  url: string,
  info: MediaKeyInfo,
  destination: string,
  onProgress?: ProgressFn,
): Promise<string> {
  const cipherPath = scratchPath('dl');
  try {
    const response = await ReactNativeBlobUtil.config({
      path: cipherPath,
      // Without this an HTTP error page is written to the file and then fails
      // to decrypt, reporting tampering for what is really a 403.
      followRedirect: true,
    }).fetch('GET', url);

    const status = response.info().status;
    if (status < 200 || status >= 300) {
      throw new Error(`mediaFiles: download failed with HTTP ${status}`);
    }

    const source = await fileSource(cipherPath);
    const sink = await fileSink(destination);
    await decryptMedia(source, sink, info, {onProgress});
    return destination;
  } catch (error) {
    await discard(destination);
    throw error;
  } finally {
    await discard(cipherPath);
  }
}
