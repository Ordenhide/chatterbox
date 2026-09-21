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
  ciphertextLength,
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

/**
 * Whether a local file is still there.
 *
 * Exists to tell a retryable failure from a permanent one. A queued upload
 * whose bytes have been reclaimed can never succeed, so retrying it on every
 * chat open would flash an upload it cannot finish, forever — see
 * services/mediaUploads.ts.
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    return await fs.exists(toPath(path));
  } catch {
    return false;
  }
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

/** Appends a whole file's contents onto another, in one base64 round trip. */
async function appendFileTo(target: string, sourcePath: string): Promise<void> {
  const base64 = await fs.readFile(toPath(sourcePath), 'base64');
  await fs.appendFile(toPath(target), base64, 'base64');
}

/**
 * Where a resumable download's ciphertext is cached between attempts.
 *
 * Independent of {@link ./mediaVault}'s own cache-path naming rather than
 * imported from it — that module imports from this one, not the other way.
 * Exported so a future cache sweep (e.g. on sign-out, alongside
 * `clearMediaCache`) has something to enumerate; nothing calls it yet.
 */
export function resumeCachePath(key: string): string {
  return `${fs.dirs.CacheDir}/cbxdl_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.bin`;
}

async function fetchToFile(
  url: string,
  path: string,
  headers?: Record<string, string>,
): Promise<number> {
  const response = await ReactNativeBlobUtil.config({
    path: toPath(path),
    // Without this an HTTP error page is written to the file and then fails
    // to decrypt, reporting tampering for what is really a 403.
    followRedirect: true,
  }).fetch('GET', url, headers);
  return response.info().status;
}

/**
 * Fetches the ciphertext bytes from `haveBytes` onward into `cipherPath`.
 *
 * For a fresh download (`haveBytes === 0`) this streams straight into
 * `cipherPath`, same as before resumability existed: if the connection drops
 * mid-stream, whatever already reached disk simply stays there, and it's the
 * caller's job to decide whether that's worth keeping.
 *
 * For a resume, blob-util has no append mode — a response always overwrites
 * whatever is at its `path` — so the new range is fetched to a temp file
 * first and appended onto `cipherPath` with {@link appendFileTo}. If *that*
 * request fails outright, whatever streamed to the temp file before it did
 * is still salvaged onto `cipherPath` rather than thrown away: this is never
 * a correctness risk, since `decryptMedia` refuses to run until the total
 * length matches exactly and every chunk authenticates independently, so a
 * bad or short salvage only ever costs a wasted round trip on the next
 * attempt, never a wrong result.
 */
async function fetchInto(url: string, cipherPath: string, haveBytes: number): Promise<void> {
  if (haveBytes === 0) {
    const status = await fetchToFile(url, cipherPath);
    if (status !== 200) {
      // Whatever a non-2xx status wrote is an error page, not ciphertext —
      // must not be mistaken for resumable progress by the caller.
      await discard(cipherPath);
      throw new Error(`mediaFiles: download failed with HTTP ${status}`);
    }
    return;
  }

  const partial = scratchPath('dlpart');
  let status: number;
  try {
    status = await fetchToFile(url, partial, {Range: `bytes=${haveBytes}-`});
  } catch (error) {
    // The request rejected outright (a dropped connection, not a resolved
    // response) — but the native side may still have streamed some bytes to
    // `partial` first. Salvage them onto cipherPath before giving up this
    // attempt: still not ciphertext we've validated, but a strictly better
    // starting point for the next one than what we had before.
    await appendFileTo(cipherPath, partial).catch(() => undefined);
    await discard(partial);
    throw error;
  }

  try {
    if (status === 206) {
      await appendFileTo(cipherPath, partial);
    } else if (status === 200) {
      // The server ignored the Range header and sent the whole object again
      // — this is the complete object, not a suffix to append onto whatever
      // was already cached.
      await fs.writeFile(toPath(cipherPath), '', 'base64');
      await appendFileTo(cipherPath, partial);
    } else {
      // A resolved but non-2xx response is an error page, not ciphertext —
      // it lives only in `partial`, so cipherPath (still just `haveBytes`
      // worth of previously-confirmed bytes) is untouched and safe to keep.
      throw new Error(`mediaFiles: download failed with HTTP ${status}`);
    }
  } finally {
    await discard(partial);
  }
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
 *
 * With `resumeKey`, a network failure mid-download (not a bad HTTP status,
 * not a failed decrypt — those still always clean up, exactly as before)
 * leaves the ciphertext fetched so far cached under that key, and the next
 * call with the same key resumes from there via an HTTP Range request
 * instead of starting over. The key should identify the specific attachment
 * (message id + slot, not the download URL — the URL carries a bearer token
 * and is itself sealed inside the message, so it makes a poor and sensitive
 * cache key). Only the network transfer is resumable; decryption still
 * refuses to run until the full expected ciphertext length is on disk, so
 * this changes nothing about the integrity guarantee below.
 */
export async function downloadAndDecrypt(
  url: string,
  info: MediaKeyInfo,
  destination: string,
  options: {onProgress?: ProgressFn; resumeKey?: string} = {},
): Promise<string> {
  const expected = ciphertextLength(info.plaintextBytes, info.chunkBytes);
  const cipherPath = options.resumeKey ? resumeCachePath(options.resumeKey) : scratchPath('dl');
  let keepCipherCache = false;

  try {
    let haveBytes = 0;
    const existing = await fs.stat(toPath(cipherPath)).catch(() => null);
    if (existing) {
      const size = Number(existing.size);
      if (Number.isFinite(size) && size > 0 && size <= expected) {
        haveBytes = size;
      } else {
        // Bigger than the object could ever be, or unreadable — not a valid
        // prefix of anything. Don't trust it.
        await discard(cipherPath);
      }
    }

    if (haveBytes < expected) {
      await fetchInto(url, cipherPath, haveBytes);
    }

    const source = await fileSource(cipherPath);
    if (source.size !== expected) {
      throw new Error(`mediaFiles: download incomplete (${source.size}/${expected} bytes)`);
    }

    const sink = await fileSink(destination);
    await decryptMedia(source, sink, info, {onProgress: options.onProgress});
    return destination;
  } catch (error) {
    await discard(destination);
    if (options.resumeKey) {
      // Whatever is on disk right now — untouched previous bytes, newly
      // appended ones, or bytes a dropped connection streamed before
      // rejecting — is worth keeping for the next attempt as long as it's a
      // plausible partial object. This one check is enough to tell that
      // apart from the other ways this can fail: a bad HTTP status never
      // writes to cipherPath (fetchInto only touches its own temp file, or
      // discards cipherPath outright on a fresh attempt), and a failed
      // decrypt only ever happens once cipherPath already holds exactly
      // `expected` bytes — neither leaves it at a partial size.
      const stat = await fs.stat(toPath(cipherPath)).catch(() => null);
      const size = stat ? Number(stat.size) : 0;
      keepCipherCache = Number.isFinite(size) && size > 0 && size < expected;
    }
    throw error;
  } finally {
    if (!keepCipherCache) await discard(cipherPath);
  }
}
