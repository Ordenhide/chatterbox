/**
 * End-to-end encryption for attachment *bytes*.
 *
 * ## What this changes
 *
 * Until now the app sealed the media *pointer* and left the object itself
 * readable: anyone holding the download URL — and the storage operator, who
 * holds every URL — could read the photo. The envelope around the URL made
 * that look like end-to-end encryption from the outside, which is the worst
 * property a security control can have. Sealing a pointer to a plaintext
 * object protects nothing but the pointer.
 *
 * Here the file is encrypted under a fresh random content key before it is
 * uploaded, and only the content key travels inside the message envelope. The
 * stored object is indistinguishable from random. The key never reaches the
 * server, so neither does the picture.
 *
 * ## Why chunked, and why that needs care
 *
 * A one-shot AEAD would mean holding the whole file, its ciphertext, and the
 * base64 of both in JS memory at once. At this app's own limits — 50MB video,
 * 25MB file — that is a few hundred megabytes of peak usage on a phone, i.e.
 * a crash on the devices that can least afford it. So the file is encrypted
 * in {@link CHUNK_BYTES} slices and streamed to disk.
 *
 * Chunking is where naive implementations lose the integrity they think they
 * have. Encrypting each chunk independently authenticates every chunk
 * *individually* while leaving the *sequence* unauthenticated, so an attacker
 * who cannot forge a single byte can still reorder chunks, drop the tail, or
 * splice in chunks from elsewhere — each producing a file that decrypts
 * without error.
 *
 * Two mechanisms close that, and it is worth being exact about which does
 * what, because they are easy to mix up:
 *
 *   - **The nonce carries the chunk index.** It is a random 16-byte per-file
 *     base concatenated with the 8-byte index, so every chunk of every file
 *     gets a unique nonce. This is what defeats reordering, duplication, and
 *     splicing: a chunk sealed at index i simply will not open at index j.
 *     It is also what keeps two identical plaintext chunks from being XORed
 *     with the same keystream, which is the confidentiality half of the same
 *     decision. XChaCha20's 24-byte nonce is what makes deriving the nonce
 *     this way safe rather than requiring a counter tracked across calls.
 *
 *   - **The header pins the length.** `plaintextBytes` and `chunkCount` arrive
 *     sealed inside the message, so the decryptor knows the exact size the
 *     object must be before it reads a byte of it, and cross-checks that the
 *     two agree with each other. This is what defeats truncation and
 *     extension. Deriving either from the object under attack would defeat
 *     nothing.
 *
 * The per-chunk associated data repeats the index and count on top of that.
 * Being honest about it: as the code stands today that is *redundant* —
 * mutation-testing every binding out of the AD individually leaves the test
 * suite green, because the nonce and the length checks already catch each
 * attack on their own. It is kept because it is free and because it makes a
 * chunk self-describing, so a future streaming reader that cannot check the
 * total length up front does not silently lose the anti-truncation property.
 * It is not, however, load-bearing now, and no comment here should imply it is.
 *
 * ## What is deliberately not bound
 *
 * The chat id is not in the associated data. It would look reassuring and buy
 * nothing: the content key is random per attachment and travels sealed inside
 * the message, so moving a ciphertext object into another conversation means
 * moving its key there too — which requires the ability to send a sealed
 * message in that conversation, i.e. being a member of it, in which case
 * re-uploading the file achieves the same thing. Binding it would defend a
 * step an attacker has no reason to take.
 */
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {base64ToBytes, bytesToBase64, secureRandomBytes, utf8ToBytes} from './crypto';

export const MEDIA_CRYPTO_ALG = 'chatterbox-media-v1';

/** Plaintext bytes per chunk. Ciphertext chunks are this plus {@link TAG_BYTES}. */
export const CHUNK_BYTES = 1024 * 1024;

/** Poly1305 authentication tag, appended to each chunk by the AEAD. */
export const TAG_BYTES = 16;

/** Random per-file nonce prefix; the remaining 8 bytes are the chunk index. */
const NONCE_BASE_BYTES = 16;

const KEY_BYTES = 32;

/**
 * Everything needed to decrypt one attachment, and nothing else.
 *
 * This is what gets sealed into the message. It carries the key, so it must
 * never be written anywhere the ciphertext is: see the callers, which put the
 * download URL in the clear only alongside a sealed copy of this.
 */
export type MediaKeyInfo = {
  alg: typeof MEDIA_CRYPTO_ALG;
  /** base64, 32 bytes. */
  key: string;
  /** base64, 16 bytes. */
  nonceBase: string;
  chunkBytes: number;
  chunkCount: number;
  /** Plaintext length, so the reader can show a size before decrypting. */
  plaintextBytes: number;
  /** Carried so the receiver can pick a player without trusting the filename. */
  mime?: string;
};

export function isMediaKeyInfo(value: unknown): value is MediaKeyInfo {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<MediaKeyInfo>;
  return (
    v.alg === MEDIA_CRYPTO_ALG &&
    typeof v.key === 'string' &&
    typeof v.nonceBase === 'string' &&
    typeof v.chunkBytes === 'number' &&
    v.chunkBytes > 0 &&
    typeof v.chunkCount === 'number' &&
    v.chunkCount >= 0 &&
    typeof v.plaintextBytes === 'number' &&
    v.plaintextBytes >= 0
  );
}

/** Raised when a ciphertext fails to authenticate. Never carries key material. */
export class MediaIntegrityError extends Error {
  constructor(message: string) {
    super(`media: ${message}`);
    this.name = 'MediaIntegrityError';
  }
}

/**
 * A readable byte range. Implemented over the filesystem in production and
 * over a plain array in tests, which is why nothing here imports a native
 * module — the crypto is testable in Node without a device.
 */
export type ByteSource = {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
};

/** A write-only sink, appended to in order. */
export type ByteSink = {
  write(bytes: Uint8Array): Promise<void>;
};

/** Progress in [0, 1]. Called at chunk boundaries, never more than once per chunk. */
export type ProgressFn = (fraction: number) => void;

function nonceFor(nonceBase: Uint8Array, index: number): Uint8Array {
  const nonce = new Uint8Array(NONCE_BASE_BYTES + 8);
  nonce.set(nonceBase, 0);
  // Big-endian index in the low 8 bytes. Written with arithmetic rather than
  // bitwise ops on purpose: `>>>` would silently wrap at 2^32, and while the
  // chunk count cannot get near that at this app's file-size limits, a nonce
  // that repeats is the one bug in this file that loses confidentiality
  // outright rather than raising an error.
  let remaining = index;
  for (let i = 7; i >= 0; i--) {
    nonce[NONCE_BASE_BYTES + i] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  return nonce;
}

/**
 * Associated data for one chunk: the algorithm, this chunk's position, and how
 * many chunks the whole file has.
 *
 * The count is the anti-truncation binding and the reason it is a parameter
 * rather than something read from the object. A decryptor that learned the
 * count from the file it is decrypting could be told any count the attacker
 * liked; this one learns it from the sealed header.
 */
function chunkAd(index: number, chunkCount: number): Uint8Array {
  return utf8ToBytes(`${MEDIA_CRYPTO_ALG}|${index}|${chunkCount}`);
}

export function chunkCountFor(plaintextBytes: number, chunkBytes: number = CHUNK_BYTES): number {
  return Math.ceil(plaintextBytes / chunkBytes);
}

/** Ciphertext length for a given plaintext length — one tag per chunk. */
export function ciphertextLength(plaintextBytes: number, chunkBytes: number = CHUNK_BYTES): number {
  return plaintextBytes + chunkCountFor(plaintextBytes, chunkBytes) * TAG_BYTES;
}

/**
 * Encrypts `source` into `sink` under a fresh content key.
 *
 * Returns the key material the receiver needs. The caller's job is to get that
 * back to the recipients sealed and to upload whatever landed in the sink; this
 * function deliberately knows about neither.
 */
export async function encryptMedia(
  source: ByteSource,
  sink: ByteSink,
  options: {mime?: string; onProgress?: ProgressFn} = {},
): Promise<MediaKeyInfo> {
  const key = secureRandomBytes(KEY_BYTES);
  const nonceBase = secureRandomBytes(NONCE_BASE_BYTES);
  const chunkCount = chunkCountFor(source.size, CHUNK_BYTES);

  for (let index = 0; index < chunkCount; index++) {
    const offset = index * CHUNK_BYTES;
    const length = Math.min(CHUNK_BYTES, source.size - offset);
    const plain = await source.read(offset, length);
    // A short read means the file changed under us — encrypting it anyway
    // would produce an object whose length disagrees with its header, which
    // the decryptor would report as tampering. Fail here, where the cause is
    // still visible.
    if (plain.length !== length) {
      throw new MediaIntegrityError(
        `source returned ${plain.length} bytes at offset ${offset}, expected ${length}`,
      );
    }
    const aead = xchacha20poly1305(key, nonceFor(nonceBase, index), chunkAd(index, chunkCount));
    await sink.write(aead.encrypt(plain));
    options.onProgress?.((index + 1) / chunkCount);
  }

  // A zero-length attachment has no chunks, so nothing above ran and no
  // progress was reported. Callers drive a progress bar off this.
  if (chunkCount === 0) options.onProgress?.(1);

  return {
    alg: MEDIA_CRYPTO_ALG,
    key: bytesToBase64(key),
    nonceBase: bytesToBase64(nonceBase),
    chunkBytes: CHUNK_BYTES,
    chunkCount,
    plaintextBytes: source.size,
    mime: options.mime,
  };
}

/**
 * Decrypts `source` into `sink` using `info`, or throws {@link MediaIntegrityError}.
 *
 * Throwing rather than returning partial output is the point: a caller that
 * got half a file back and no error would happily display it.
 */
export async function decryptMedia(
  source: ByteSource,
  sink: ByteSink,
  info: MediaKeyInfo,
  options: {onProgress?: ProgressFn} = {},
): Promise<void> {
  if (!isMediaKeyInfo(info)) {
    throw new MediaIntegrityError('key info is malformed or from another scheme');
  }

  const key = base64ToBytes(info.key);
  if (key.length !== KEY_BYTES) {
    throw new MediaIntegrityError(`content key is ${key.length} bytes, expected ${KEY_BYTES}`);
  }
  const nonceBase = base64ToBytes(info.nonceBase);
  if (nonceBase.length !== NONCE_BASE_BYTES) {
    throw new MediaIntegrityError(
      `nonce base is ${nonceBase.length} bytes, expected ${NONCE_BASE_BYTES}`,
    );
  }

  // Length is checked before any decryption. The per-chunk associated data
  // already binds the count, so a truncated object would fail to authenticate
  // anyway — but only after writing every chunk that came before the cut,
  // and a sink that has been written to is a temp file to clean up. Checking
  // first turns that into a clean rejection.
  const expected = info.plaintextBytes + info.chunkCount * TAG_BYTES;
  if (source.size !== expected) {
    throw new MediaIntegrityError(
      `ciphertext is ${source.size} bytes, expected ${expected} — truncated or altered`,
    );
  }
  if (chunkCountFor(info.plaintextBytes, info.chunkBytes) !== info.chunkCount) {
    throw new MediaIntegrityError('header chunk count disagrees with its own plaintext length');
  }

  const cipherChunk = info.chunkBytes + TAG_BYTES;
  for (let index = 0; index < info.chunkCount; index++) {
    const offset = index * cipherChunk;
    const length = Math.min(cipherChunk, source.size - offset);
    const blob = await source.read(offset, length);
    if (blob.length !== length) {
      throw new MediaIntegrityError(`short read at chunk ${index}`);
    }
    const aead = xchacha20poly1305(
      key,
      nonceFor(nonceBase, index),
      chunkAd(index, info.chunkCount),
    );
    let plain: Uint8Array;
    try {
      plain = aead.decrypt(blob);
    } catch {
      // Deliberately not forwarding the AEAD's message: it distinguishes
      // failure modes that are none of the caller's business, and this is on
      // the path that renders remote data.
      throw new MediaIntegrityError(`chunk ${index} failed to authenticate`);
    }
    await sink.write(plain);
    options.onProgress?.((index + 1) / info.chunkCount);
  }

  if (info.chunkCount === 0) options.onProgress?.(1);
}

/** An in-memory {@link ByteSource}. Used by the web client and by tests. */
export function bytesSource(bytes: Uint8Array): ByteSource {
  return {
    size: bytes.length,
    async read(offset, length) {
      return bytes.subarray(offset, offset + length);
    },
  };
}

/** An in-memory {@link ByteSink} that concatenates on {@link collectingSink.result}. */
export function collectingSink(): ByteSink & {result(): Uint8Array} {
  const parts: Uint8Array[] = [];
  let total = 0;
  return {
    async write(bytes) {
      parts.push(bytes);
      total += bytes.length;
    },
    result() {
      const out = new Uint8Array(total);
      let at = 0;
      for (const part of parts) {
        out.set(part, at);
        at += part.length;
      }
      return out;
    },
  };
}
