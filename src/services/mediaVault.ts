/**
 * Turning an encrypted attachment into something a player can open.
 *
 * The chat screen needs a local file path; what a message actually carries is
 * a URL pointing at ciphertext plus a content key sealed inside its body. This
 * module is the step between, and it exists as its own module mainly so that
 * step is testable — ChatScreen is not.
 *
 * ## Caching, and why it is keyed the way it is
 *
 * Decryption is expensive enough that doing it per render would be visible, so
 * results are cached on disk under the message id and slot. That key is
 * deliberate: message ids are unique and stable, so a cached file can never be
 * served for a different message, and re-opening a chat re-uses what is
 * already there instead of re-downloading it.
 *
 * The cache lives in the caches directory, which the OS may reclaim at any
 * time. That is the right place for it — the ciphertext in Storage remains the
 * source of truth, and a reclaimed file simply decrypts again on next view.
 *
 * ## Concurrent requests
 *
 * A chat that scrolls past ten encrypted photos asks for all of them at once,
 * and React may ask for the same one several times before the first answer
 * lands. In-flight work is therefore shared by key: the second caller waits on
 * the first request rather than starting a duplicate download and racing it to
 * write the same path.
 */
import {type MediaKeyInfo} from './mediaCrypto';
import {discard, downloadAndDecrypt, scratchPath} from './mediaFiles';
import type {MediaSlot} from './messageBody';
import ReactNativeBlobUtil from 'react-native-blob-util';

const fs = ReactNativeBlobUtil.fs;

/** Requests in flight, keyed as `${messageId}:${slot}`. */
const inFlight = new Map<string, Promise<string>>();

/**
 * File extension for a MIME type. Native players pick a decoder partly from
 * the extension, so an honest one matters more than a tidy one.
 */
export function extensionForMime(mime: string | undefined): string {
  const base = (mime ?? '').split(';')[0].trim().toLowerCase();
  const table: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/aac': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'application/pdf': 'pdf',
  };
  return table[base] ?? 'bin';
}

/**
 * Filesystem-safe form of a message id.
 *
 * Dots are excluded along with separators. Stripping separators alone already
 * confines the result to the cache directory, but it lets an id like
 * `../../x` through as `.._.._x` — a filename that looks like traversal to
 * anyone reading a log or a crash report even though it isn't one. Real
 * message ids are `msg_<time>_<random>`, so nothing is lost by dropping them.
 */
function safeId(messageId: string): string {
  return messageId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function cachePathFor(messageId: string, slot: MediaSlot, info: MediaKeyInfo): string {
  return `${fs.dirs.CacheDir}/cbxmedia_${safeId(messageId)}_${slot}.${extensionForMime(info.mime)}`;
}

/**
 * Resolves an encrypted attachment to a local file path.
 *
 * Throws if the object cannot be fetched or fails to authenticate. Callers
 * must not fall back to rendering `url` on failure — it points at ciphertext,
 * and showing it produces a broken-image icon that looks like a network
 * problem rather than the integrity failure it may actually be.
 */
export async function resolveSealedMedia(
  messageId: string,
  slot: MediaSlot,
  url: string,
  info: MediaKeyInfo,
): Promise<string> {
  const key = `${messageId}:${slot}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const work = (async () => {
    const destination = cachePathFor(messageId, slot, info);
    // Only trust a cached file whose length matches the header. A truncated
    // one — the app killed mid-write, or the OS reclaiming the directory
    // underneath us — would otherwise be served forever.
    try {
      const stat = await fs.stat(destination);
      if (Number(stat.size) === info.plaintextBytes) return destination;
      await discard(destination);
    } catch {
      // Not cached yet, which is the normal path.
    }

    // Decrypt to a scratch path and move into place only on success, so a
    // failure part-way through cannot leave a partial file at the cache path
    // where the check above would later accept it.
    const staging = scratchPath('media');
    try {
      await downloadAndDecrypt(url, info, staging, {resumeKey: key});
      await fs.mv(staging, destination);
      return destination;
    } catch (error) {
      await discard(staging);
      throw error;
    }
  })();

  inFlight.set(key, work);
  // Clear the slot whether it resolved or rejected: a failed download should
  // be retryable on the next scroll, not cached as permanently broken.
  work.catch(() => undefined).then(() => {
    if (inFlight.get(key) === work) inFlight.delete(key);
  });
  return work;
}

/**
 * Deletes every decrypted attachment this device has cached.
 *
 * Called from the same places that clear other local plaintext — sign-out and
 * account deletion. Without it, decrypted copies of every photo the user ever
 * viewed would outlive the account that could read them.
 */
export async function clearMediaCache(): Promise<void> {
  try {
    const names: string[] = await fs.ls(fs.dirs.CacheDir);
    await Promise.all(
      names
        .filter(name => name.startsWith('cbxmedia_'))
        .map(name => discard(`${fs.dirs.CacheDir}/${name}`)),
    );
  } catch {
    // The caches directory may not exist yet, which is not a failure.
  }
  // Our own cbxmedia_ files are not the only decrypted copy. Once a plaintext
  // path or a data: URI reaches <Image>, the platform image loader keeps its
  // own on-disk copy (Fresco's image_cache on Android), and a photo recovered
  // from there after sign-out is what proved this cleanup was incomplete.
  // There is no JS API to flush that cache, so the directory is deleted
  // outright; the loader recreates it, at the cost of re-fetching whatever was
  // still warm.
  await discard(`${fs.dirs.CacheDir}/image_cache`);
}
