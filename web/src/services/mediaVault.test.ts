/**
 * Fetching and decrypting a sealed attachment in a browser.
 *
 * The contract that matters here is not "it decrypts" — mediaCrypto is tested,
 * and crossClient.test.ts proves the two clients agree on the format. It is
 * the three things a browser adds: one fetch per attachment however many
 * callers ask, a bound on how many decrypted blobs stay resident, and never a
 * fallback to the ciphertext URL on failure.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {bytesSource, collectingSink, encryptMedia, type MediaKeyInfo} from './mediaCrypto';
import {_cacheSize, clearMediaCache, resolveSealedMedia} from './mediaVault';

const payload = new Uint8Array(4096);
for (let i = 0; i < payload.length; i++) payload[i] = (i * 17 + 3) % 256;

let ciphertext: Uint8Array;
let info: MediaKeyInfo;
let created: string[];
let revoked: string[];

beforeEach(async () => {
  clearMediaCache();
  const sink = collectingSink();
  info = await encryptMedia(bytesSource(payload), sink, {mime: 'image/jpeg'});
  ciphertext = sink.result();

  created = [];
  revoked = [];
  let n = 0;
  // jsdom has no object-URL implementation; these also let the test see the
  // revocations, which is the only observable proof the bound is enforced.
  vi.stubGlobal('URL', {
    createObjectURL: () => {
      const url = `blob:stub/${n++}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => {
      revoked.push(url);
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * jsdom's Blob.slice() returns something with no arrayBuffer(), so a real Blob
 * cannot be read here the way a browser reads one. `Blob.arrayBuffer` is
 * standard and universally supported, so the production code is right and the
 * environment is short — the test supplies the platform object rather than the
 * vault reading the whole file into memory to accommodate a test runner.
 */
function fakeBlob(bytes: Uint8Array): Blob {
  return {
    size: bytes.length,
    slice: (start: number, end: number) => ({
      arrayBuffer: async () => bytes.slice(start, end).buffer,
    }),
  } as unknown as Blob;
}

function serve(bytes: Uint8Array, ok = true) {
  return vi.fn(async () => ({
    ok,
    status: ok ? 200 : 404,
    blob: async () => fakeBlob(bytes),
  })) as unknown as typeof fetch;
}

describe('resolveSealedMedia', () => {
  it('decrypts the object behind the URL and hands back a blob URL', async () => {
    vi.stubGlobal('fetch', serve(ciphertext));
    const url = await resolveSealedMedia('m1', 'image', 'https://example.test/c.bin', info);
    expect(url).toBe('blob:stub/0');
    expect(created).toHaveLength(1);
  });

  it('fetches once for concurrent callers, and once more never', async () => {
    const f = serve(ciphertext);
    vi.stubGlobal('fetch', f);
    const [a, b] = await Promise.all([
      resolveSealedMedia('m1', 'image', 'https://example.test/c.bin', info),
      resolveSealedMedia('m1', 'image', 'https://example.test/c.bin', info),
    ]);
    expect(a).toBe(b);
    const c = await resolveSealedMedia('m1', 'image', 'https://example.test/c.bin', info);
    expect(c).toBe(a);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('raises rather than returning anything when the fetch fails', async () => {
    vi.stubGlobal('fetch', serve(ciphertext, false));
    await expect(
      resolveSealedMedia('m1', 'image', 'https://example.test/c.bin', info),
    ).rejects.toThrow();
    // Nothing cached, so a later attempt can still succeed, and nothing was
    // handed back for a caller to render.
    expect(created).toHaveLength(0);
  });

  it('raises on a ciphertext that fails to authenticate', async () => {
    const tampered = Uint8Array.from(ciphertext);
    tampered[64] ^= 0xff;
    vi.stubGlobal('fetch', serve(tampered));
    await expect(
      resolveSealedMedia('m1', 'image', 'https://example.test/c.bin', info),
    ).rejects.toThrow();
    expect(created).toHaveLength(0);
  });

  it('bounds what stays resident, revoking the oldest as it goes', async () => {
    vi.stubGlobal('fetch', serve(ciphertext));
    // One past the cap, so exactly one eviction is expected.
    for (let i = 0; i < 49; i++) {
      await resolveSealedMedia(`m${i}`, 'image', 'https://example.test/c.bin', info);
    }
    expect(_cacheSize()).toBe(48);
    // A blob URL pins its bytes until revoked; a cache that only forgot would
    // leak every photo a long thread scrolled past.
    expect(revoked).toEqual(['blob:stub/0']);
  });

  it('revokes everything on sign-out', async () => {
    vi.stubGlobal('fetch', serve(ciphertext));
    await resolveSealedMedia('m1', 'image', 'https://example.test/c.bin', info);
    await resolveSealedMedia('m2', 'image', 'https://example.test/c.bin', info);
    clearMediaCache();
    expect(_cacheSize()).toBe(0);
    expect(revoked).toEqual(['blob:stub/0', 'blob:stub/1']);
  });
});
