/**
 * Verbatim port of the mobile app's src/services/mediaCrypto.ts.
 *
 * It ports without changes because it was written to: everything here is
 * @noble plus ./crypto, and the file reads and writes through the ByteSource /
 * ByteSink pair below rather than touching a filesystem. The platform
 * difference lives in whoever supplies those.
 *
 * Must stay byte-identical below the header. This is the attachment wire
 * format — chunk size, nonce derivation, tag placement — and a divergence does
 * not fail loudly, it fails as an attachment one client can never open.
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
