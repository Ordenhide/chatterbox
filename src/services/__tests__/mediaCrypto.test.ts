/**
 * The interesting tests here are the ones that attack the *structure* of the
 * ciphertext rather than its bytes. A chunked AEAD authenticates each chunk on
 * its own for free; keeping the sequence honest is the part that has to be
 * designed, so that is what most of this file checks.
 */
import {
  CHUNK_BYTES,
  MEDIA_CRYPTO_ALG,
  MediaIntegrityError,
  TAG_BYTES,
  bytesSource,
  chunkCountFor,
  ciphertextLength,
  collectingSink,
  decryptMedia,
  encryptMedia,
  isMediaKeyInfo,
  type MediaKeyInfo,
} from '../mediaCrypto';

/** Deterministic filler — random data would make failures hard to reproduce. */
function pattern(length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = (i * 31 + (i >> 8)) & 0xff;
  return out;
}

async function roundTrip(plain: Uint8Array): Promise<{cipher: Uint8Array; info: MediaKeyInfo}> {
  const sink = collectingSink();
  const info = await encryptMedia(bytesSource(plain), sink, {mime: 'image/jpeg'});
  return {cipher: sink.result(), info};
}

async function decryptToBytes(cipher: Uint8Array, info: MediaKeyInfo): Promise<Uint8Array> {
  const sink = collectingSink();
  await decryptMedia(bytesSource(cipher), sink, info);
  return sink.result();
}

describe('encryptMedia / decryptMedia', () => {
  it('round-trips a file smaller than one chunk', async () => {
    const plain = pattern(1000);
    const {cipher, info} = await roundTrip(plain);
    expect(info.chunkCount).toBe(1);
    expect(await decryptToBytes(cipher, info)).toEqual(plain);
  });

  it('round-trips a file spanning several chunks, including a partial last one', async () => {
    const plain = pattern(CHUNK_BYTES * 2 + 12345);
    const {cipher, info} = await roundTrip(plain);
    expect(info.chunkCount).toBe(3);
    expect(await decryptToBytes(cipher, info)).toEqual(plain);
  });

  it('round-trips a file that is an exact multiple of the chunk size', async () => {
    // The off-by-one that produces a spurious empty trailing chunk lives here.
    const plain = pattern(CHUNK_BYTES * 2);
    const {cipher, info} = await roundTrip(plain);
    expect(info.chunkCount).toBe(2);
    expect(await decryptToBytes(cipher, info)).toEqual(plain);
  });

  it('round-trips an empty file', async () => {
    const {cipher, info} = await roundTrip(new Uint8Array(0));
    expect(info.chunkCount).toBe(0);
    expect(cipher.length).toBe(0);
    expect(await decryptToBytes(cipher, info)).toEqual(new Uint8Array(0));
  });

  it('produces ciphertext of exactly the predicted length', async () => {
    const plain = pattern(CHUNK_BYTES + 7);
    const {cipher} = await roundTrip(plain);
    expect(cipher.length).toBe(ciphertextLength(plain.length));
    expect(cipher.length).toBe(plain.length + 2 * TAG_BYTES);
  });

  it('does not leave the plaintext recognisable in the ciphertext', async () => {
    // A zero-filled file is the case where a broken keystream shows up as
    // plainly as it ever will: any long run of identical bytes in the output
    // means the data was not really encrypted.
    const plain = new Uint8Array(4096);
    const {cipher} = await roundTrip(plain);
    let longestRun = 1;
    let run = 1;
    for (let i = 1; i < cipher.length; i++) {
      run = cipher[i] === cipher[i - 1] ? run + 1 : 1;
      if (run > longestRun) longestRun = run;
    }
    expect(longestRun).toBeLessThan(8);
  });

  it('encrypts identical chunks to different ciphertext', async () => {
    // The chunk index goes into the nonce, so two identical plaintext chunks
    // must not produce identical ciphertext. If they did, the two chunks would
    // have been XORed with the same keystream and either one would leak the
    // other — a confidentiality break that every integrity test above would
    // still pass, which is why it needs its own check.
    const half = pattern(CHUNK_BYTES);
    const doubled = new Uint8Array(CHUNK_BYTES * 2);
    doubled.set(half, 0);
    doubled.set(half, CHUNK_BYTES);

    const {cipher} = await roundTrip(doubled);
    const size = CHUNK_BYTES + TAG_BYTES;
    // Compare the ciphertext bodies only. Including the tags would make this
    // pass even with a repeated keystream, because the tags also cover the
    // associated data, which differs by index — the check would then be
    // measuring the AD rather than the nonce it is here to pin down.
    expect(cipher.subarray(0, CHUNK_BYTES)).not.toEqual(
      cipher.subarray(size, size + CHUNK_BYTES),
    );
  });

  it('uses a different key and nonce base for every file', async () => {
    const plain = pattern(500);
    const a = await roundTrip(plain);
    const b = await roundTrip(plain);
    expect(a.info.key).not.toBe(b.info.key);
    expect(a.info.nonceBase).not.toBe(b.info.nonceBase);
    // Same plaintext, different ciphertext — no deterministic encryption.
    expect(a.cipher).not.toEqual(b.cipher);
  });

  it('reports progress once per chunk, ending at 1', async () => {
    const seen: number[] = [];
    const sink = collectingSink();
    await encryptMedia(bytesSource(pattern(CHUNK_BYTES * 3)), sink, {
      onProgress: f => seen.push(f),
    });
    expect(seen).toHaveLength(3);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('reports completion for an empty file, which has no chunks', async () => {
    const seen: number[] = [];
    await encryptMedia(bytesSource(new Uint8Array(0)), collectingSink(), {
      onProgress: f => seen.push(f),
    });
    expect(seen).toEqual([1]);
  });
});

describe('integrity', () => {
  it('rejects a flipped bit anywhere in the ciphertext', async () => {
    const {cipher, info} = await roundTrip(pattern(CHUNK_BYTES + 100));
    for (const at of [0, CHUNK_BYTES - 1, CHUNK_BYTES + TAG_BYTES + 50, cipher.length - 1]) {
      const tampered = Uint8Array.from(cipher);
      tampered[at] ^= 0x01;
      await expect(decryptToBytes(tampered, info)).rejects.toThrow(MediaIntegrityError);
    }
  });

  it('rejects a truncated file', async () => {
    const {cipher, info} = await roundTrip(pattern(CHUNK_BYTES * 2 + 50));
    // Drop the final chunk entirely — every remaining chunk is individually
    // authentic, so only the count binding catches this.
    const cut = cipher.subarray(0, (CHUNK_BYTES + TAG_BYTES) * 2);
    await expect(decryptToBytes(cut, info)).rejects.toThrow(/truncated or altered/);
  });

  it('rejects a file with chunks appended', async () => {
    const {cipher, info} = await roundTrip(pattern(1000));
    const extended = new Uint8Array(cipher.length + 1000 + TAG_BYTES);
    extended.set(cipher, 0);
    await expect(decryptToBytes(extended, info)).rejects.toThrow(/truncated or altered/);
  });

  it('rejects reordered chunks', async () => {
    const size = CHUNK_BYTES + TAG_BYTES;
    const {cipher, info} = await roundTrip(pattern(CHUNK_BYTES * 2));
    const swapped = new Uint8Array(cipher.length);
    swapped.set(cipher.subarray(size, size * 2), 0);
    swapped.set(cipher.subarray(0, size), size);
    // Same bytes, same length, every chunk individually authentic. Only the
    // index in the associated data distinguishes this from the real file.
    expect(swapped.length).toBe(cipher.length);
    await expect(decryptToBytes(swapped, info)).rejects.toThrow(/chunk 0 failed to authenticate/);
  });

  it('rejects a duplicated chunk', async () => {
    const size = CHUNK_BYTES + TAG_BYTES;
    const {cipher, info} = await roundTrip(pattern(CHUNK_BYTES * 2));
    const doubled = Uint8Array.from(cipher);
    doubled.set(cipher.subarray(0, size), size);
    await expect(decryptToBytes(doubled, info)).rejects.toThrow(/chunk 1 failed to authenticate/);
  });

  it('rejects a chunk spliced in from another file of the same shape', async () => {
    // Both chunks are genuine and sit at the same index, so the associated
    // data matches — what stops this is that every file draws its own key and
    // nonce base, so chunk 0 of one file is not a valid chunk 0 of another.
    // Worth stating plainly: the AD is not the defence here, per-file
    // randomness is.
    const a = await roundTrip(pattern(CHUNK_BYTES * 2));
    const b = await roundTrip(pattern(CHUNK_BYTES * 2).reverse());
    expect(a.info.key).not.toBe(b.info.key);
    expect(a.cipher.length).toBe(b.cipher.length);

    const size = CHUNK_BYTES + TAG_BYTES;
    const spliced = Uint8Array.from(a.cipher);
    spliced.set(b.cipher.subarray(0, size), 0);
    await expect(decryptToBytes(spliced, a.info)).rejects.toThrow(
      /chunk 0 failed to authenticate/,
    );
  });

  it('rejects a correct ciphertext under the wrong key', async () => {
    const {cipher} = await roundTrip(pattern(1000));
    const other = await roundTrip(pattern(1000));
    await expect(decryptToBytes(cipher, other.info)).rejects.toThrow(MediaIntegrityError);
  });

  it('rejects a header whose chunk count disagrees with its plaintext length', async () => {
    const {cipher, info} = await roundTrip(pattern(CHUNK_BYTES * 2));
    // The header is chosen so the *length* check passes: a real 2-chunk file
    // is 2C+32 bytes, and claiming (2C+16 plaintext, 1 chunk) predicts exactly
    // that. Only the second check — that the count follows from the length —
    // catches it, which is why both are needed rather than either alone.
    const lying = {...info, chunkCount: 1, plaintextBytes: CHUNK_BYTES * 2 + TAG_BYTES};
    expect(lying.plaintextBytes + lying.chunkCount * TAG_BYTES).toBe(cipher.length);
    await expect(decryptToBytes(cipher, lying)).rejects.toThrow(/disagrees/);
  });

  it('rejects key info from another scheme', async () => {
    const {cipher, info} = await roundTrip(pattern(100));
    const foreign = {...info, alg: 'something-else'} as unknown as MediaKeyInfo;
    await expect(decryptToBytes(cipher, foreign)).rejects.toThrow(/another scheme/);
  });

  it('rejects a key of the wrong length', async () => {
    const {cipher, info} = await roundTrip(pattern(100));
    await expect(decryptToBytes(cipher, {...info, key: 'AAAA'})).rejects.toThrow(/content key is/);
  });

  it('rejects a nonce base of the wrong length', async () => {
    const {cipher, info} = await roundTrip(pattern(100));
    await expect(decryptToBytes(cipher, {...info, nonceBase: 'AAAA'})).rejects.toThrow(
      /nonce base is/,
    );
  });

  it('writes nothing to the sink when the length check fails', async () => {
    // A partially written temp file that the caller then treats as media is
    // the failure this ordering exists to prevent.
    const {cipher, info} = await roundTrip(pattern(CHUNK_BYTES * 2));
    const sink = collectingSink();
    await expect(
      decryptMedia(bytesSource(cipher.subarray(0, CHUNK_BYTES)), sink, info),
    ).rejects.toThrow(MediaIntegrityError);
    expect(sink.result().length).toBe(0);
  });

  it('fails loudly when the source shrinks mid-encryption', async () => {
    const bytes = pattern(CHUNK_BYTES * 2);
    const flaky = {
      size: bytes.length,
      async read(offset: number, length: number) {
        // Second chunk comes back short, as if the file were replaced.
        if (offset > 0) return bytes.subarray(offset, offset + length - 10);
        return bytes.subarray(offset, offset + length);
      },
    };
    await expect(encryptMedia(flaky, collectingSink())).rejects.toThrow(/expected/);
  });
});

describe('isMediaKeyInfo', () => {
  it('accepts what encryptMedia produces', async () => {
    const {info} = await roundTrip(pattern(10));
    expect(isMediaKeyInfo(info)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['a plain URL-bearing object', {url: 'https://example.com/x.jpg'}],
    ['missing alg', {key: 'a', nonceBase: 'b', chunkBytes: 1, chunkCount: 1, plaintextBytes: 1}],
  ])('rejects %s', (_label, value) => {
    expect(isMediaKeyInfo(value)).toBe(false);
  });

  it('rejects a zero chunk size, which would divide by zero', () => {
    expect(
      isMediaKeyInfo({
        alg: MEDIA_CRYPTO_ALG,
        key: 'a',
        nonceBase: 'b',
        chunkBytes: 0,
        chunkCount: 1,
        plaintextBytes: 1,
      }),
    ).toBe(false);
  });
});

describe('chunkCountFor', () => {
  it.each([
    [0, 0],
    [1, 1],
    [CHUNK_BYTES, 1],
    [CHUNK_BYTES + 1, 2],
    [CHUNK_BYTES * 5, 5],
  ])('maps %i bytes to %i chunks', (bytes, expected) => {
    expect(chunkCountFor(bytes)).toBe(expected);
  });
});
