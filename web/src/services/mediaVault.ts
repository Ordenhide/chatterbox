/**
 * Fetching and decrypting an attachment whose bytes are encrypted.
 *
 * The browser counterpart of the mobile app's services/mediaVault.ts, and
 * deliberately not a port: that one streams to a file on disk and hands back a
 * path, which a browser has no equivalent of. What it shares is the contract —
 * keyed by message and slot, one fetch per key however many callers ask, and
 * never a fallback to rendering `url` on failure, because `url` points at
 * ciphertext and showing it produces a broken-image icon standing in for what
 * may be an integrity failure.
 */
import {decryptMedia, type ByteSink, type ByteSource, type MediaKeyInfo} from './mediaCrypto';
import type {MediaSlot} from './messageBody';

/**
 * Decrypted attachments are held as blob URLs, and a blob URL pins its bytes
 * until it is revoked. A long thread of photos would otherwise grow the tab's
 * memory without bound, so the cache is bounded and evicts oldest-first,
 * revoking as it goes. A Map preserves insertion order, which is what makes
 * that a one-liner.
 *
 * Sized for a few screens of scrollback: comfortably more than the window a
 * reader looks at, far short of a whole conversation's media.
 */
const MAX_CACHED = 48;

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function remember(key: string, objectUrl: string): void {
  cache.set(key, objectUrl);
  while (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    const stale = cache.get(oldest.value);
    cache.delete(oldest.value);
    if (stale) URL.revokeObjectURL(stale);
  }
}

function blobSource(blob: Blob): ByteSource {
  return {
    size: blob.size,
    async read(offset, length) {
      return new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer());
    },
  };
}

function blobSink(mime: string | undefined): ByteSink & {blob(): Blob} {
  const parts: BlobPart[] = [];
  return {
    async write(bytes) {
      // Copied: the decryptor may hand back a view over a buffer it reuses.
      parts.push(new Uint8Array(bytes));
    },
    blob() {
      return new Blob(parts, mime ? {type: mime} : undefined);
    },
  };
}

/**
 * A blob URL for the plaintext of a sealed attachment.
 *
 * Throws if the object cannot be fetched or fails to authenticate. Callers
 * must not fall back to `url`.
 */
export async function resolveSealedMedia(
  messageId: string,
  slot: MediaSlot,
  url: string,
  info: MediaKeyInfo,
): Promise<string> {
  const key = `${messageId}:${slot}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`attachment fetch failed: ${response.status}`);
    const sink = blobSink(info.mime);
    await decryptMedia(blobSource(await response.blob()), sink, info);
    const objectUrl = URL.createObjectURL(sink.blob());
    remember(key, objectUrl);
    return objectUrl;
  })();

  inFlight.set(key, job);
  try {
    return await job;
  } finally {
    inFlight.delete(key);
  }
}

/** Drops every decrypted attachment. Called on sign-out. */
export function clearMediaCache(): void {
  for (const objectUrl of cache.values()) URL.revokeObjectURL(objectUrl);
  cache.clear();
}

/** Exported for tests, which need a cold cache per case. */
export function _cacheSize(): number {
  return cache.size;
}
