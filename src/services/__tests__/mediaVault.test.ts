const mockState = {
  files: new Map<string, Buffer>(),
  status: 200,
  body: Buffer.alloc(0),
  /** Counts downloads so the caching and dedup claims can be checked. */
  fetches: 0,
  /** Forces the move-into-place to fail, e.g. a full disk. */
  failMv: false,
};

function mockNormalize(path: string): string {
  return path.startsWith('file://') ? decodeURIComponent(path.replace('file://', '')) : path;
}

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: {CacheDir: '/cache'},
      async stat(path: string) {
        const file = mockState.files.get(mockNormalize(path));
        if (!file) throw new Error(`ENOENT ${path}`);
        return {size: file.length};
      },
      async slice(src: string, dest: string, start: number, end: number) {
        const file = mockState.files.get(mockNormalize(src));
        if (!file) throw new Error(`ENOENT ${src}`);
        mockState.files.set(mockNormalize(dest), Buffer.from(file.subarray(start, end)));
      },
      async readFile(path: string) {
        const file = mockState.files.get(mockNormalize(path));
        if (!file) throw new Error(`ENOENT ${path}`);
        return file.toString('base64');
      },
      async writeFile(path: string, data: string) {
        mockState.files.set(mockNormalize(path), Buffer.from(data, 'base64'));
      },
      async appendFile(path: string, data: string) {
        const existing = mockState.files.get(mockNormalize(path)) ?? Buffer.alloc(0);
        mockState.files.set(
          mockNormalize(path),
          Buffer.concat([existing, Buffer.from(data, 'base64')]),
        );
      },
      async unlink(path: string) {
        // blob-util's unlink takes a directory as well as a file, removing
        // everything beneath it — which is how clearMediaCache disposes of the
        // image loader's cache. Modelling it as an exact-key delete would let
        // a test that seeds a directory pass without anything being removed.
        const target = mockNormalize(path);
        const doomed = [...mockState.files.keys()].filter(
          key => key === target || key.startsWith(`${target}/`),
        );
        if (!doomed.length) throw new Error(`ENOENT ${path}`);
        doomed.forEach(key => mockState.files.delete(key));
      },
      async exists(path: string) {
        return mockState.files.has(mockNormalize(path));
      },
      async mv(from: string, to: string) {
        if (mockState.failMv) throw new Error('ENOSPC');
        const file = mockState.files.get(mockNormalize(from));
        if (!file) throw new Error(`ENOENT ${from}`);
        mockState.files.set(mockNormalize(to), file);
        mockState.files.delete(mockNormalize(from));
      },
      async ls(dir: string) {
        const prefix = `${mockNormalize(dir)}/`;
        return [...mockState.files.keys()]
          .filter(k => k.startsWith(prefix))
          .map(k => k.slice(prefix.length));
      },
    },
    config: (options: {path: string}) => ({
      async fetch() {
        mockState.fetches += 1;
        mockState.files.set(mockNormalize(options.path), Buffer.from(mockState.body));
        return {info: () => ({status: mockState.status})};
      },
    }),
  },
}));

import {MediaIntegrityError, bytesSource, collectingSink, encryptMedia} from '../mediaCrypto';
import {cachePathFor, clearMediaCache, extensionForMime, resolveSealedMedia} from '../mediaVault';

function pattern(length: number): Buffer {
  const out = Buffer.alloc(length);
  for (let i = 0; i < length; i++) out[i] = (i * 17) & 0xff;
  return out;
}

async function publish(data: Buffer, mime = 'image/jpeg') {
  const sink = collectingSink();
  const info = await encryptMedia(bytesSource(new Uint8Array(data)), sink, {mime});
  mockState.body = Buffer.from(sink.result());
  return info;
}

beforeEach(() => {
  mockState.files.clear();
  mockState.status = 200;
  mockState.body = Buffer.alloc(0);
  mockState.fetches = 0;
  mockState.failMv = false;
});

describe('extensionForMime', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['video/quicktime', 'mov'],
    ['audio/mp4', 'm4a'],
    ['application/pdf', 'pdf'],
    ['image/png; charset=binary', 'png'],
    ['IMAGE/PNG', 'png'],
  ])('maps %s to .%s', (mime, expected) => {
    expect(extensionForMime(mime)).toBe(expected);
  });

  it('falls back to .bin for unknown or missing types', () => {
    expect(extensionForMime(undefined)).toBe('bin');
    expect(extensionForMime('application/x-unknown')).toBe('bin');
  });
});

describe('cachePathFor', () => {
  it('keeps different slots of one message apart', async () => {
    const info = await publish(pattern(10));
    expect(cachePathFor('m1', 'image', info)).not.toBe(cachePathFor('m1', 'video', info));
  });

  it('keeps different messages apart', async () => {
    const info = await publish(pattern(10));
    expect(cachePathFor('m1', 'image', info)).not.toBe(cachePathFor('m2', 'image', info));
  });

  it('sanitises ids that would escape the cache directory', async () => {
    const info = await publish(pattern(10));
    const path = cachePathFor('../../etc/passwd', 'image', info);
    expect(path.includes('..')).toBe(false);
    expect(path.startsWith('/cache/cbxmedia_')).toBe(true);
  });
});

describe('resolveSealedMedia', () => {
  it('returns a path to the decrypted bytes', async () => {
    const data = pattern(3000);
    const info = await publish(data);
    const path = await resolveSealedMedia('m1', 'image', 'https://example/x', info);
    expect(mockState.files.get(path)).toEqual(data);
  });

  it('serves the second request from cache without downloading again', async () => {
    const info = await publish(pattern(3000));
    await resolveSealedMedia('m1', 'image', 'https://example/x', info);
    expect(mockState.fetches).toBe(1);
    await resolveSealedMedia('m1', 'image', 'https://example/x', info);
    expect(mockState.fetches).toBe(1);
  });

  it('shares one download between concurrent callers', async () => {
    const info = await publish(pattern(3000));
    const [a, b, c] = await Promise.all([
      resolveSealedMedia('m2', 'image', 'https://example/x', info),
      resolveSealedMedia('m2', 'image', 'https://example/x', info),
      resolveSealedMedia('m2', 'image', 'https://example/x', info),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(mockState.fetches).toBe(1);
  });

  it('re-downloads when the cached file has the wrong length', async () => {
    const data = pattern(3000);
    const info = await publish(data);
    const path = await resolveSealedMedia('m3', 'image', 'https://example/x', info);
    // Simulate a write cut short by the app being killed.
    mockState.files.set(path, Buffer.from(data.subarray(0, 100)));
    const again = await resolveSealedMedia('m3', 'image', 'https://example/x', info);
    expect(mockState.fetches).toBe(2);
    expect(mockState.files.get(again)).toEqual(data);
  });

  it('leaves nothing at the cache path when decryption fails', async () => {
    // The important half: a partial file left at the cache path would be
    // accepted by a later length check only if it happened to match, but a
    // file that is simply *wrong* must not be served at all.
    const info = await publish(pattern(3000));
    mockState.body[5] ^= 0xff;
    const path = cachePathFor('m4', 'image', info);
    await expect(resolveSealedMedia('m4', 'image', 'https://example/x', info)).rejects.toThrow(
      MediaIntegrityError,
    );
    expect(mockState.files.has(path)).toBe(false);
  });

  it('retries after a failure rather than caching the failure', async () => {
    const data = pattern(3000);
    const info = await publish(data);
    const good = Buffer.from(mockState.body);
    mockState.body = Buffer.from('not the file');
    await expect(resolveSealedMedia('m5', 'image', 'https://example/x', info)).rejects.toThrow();

    mockState.body = good;
    const path = await resolveSealedMedia('m5', 'image', 'https://example/x', info);
    expect(mockState.files.get(path)).toEqual(data);
  });

  it('cleans up the staging file when the move into place fails', async () => {
    // The one failure downloadAndDecrypt cannot clean up after: it succeeded,
    // so it left the decrypted file exactly where it was asked to. Only this
    // layer knows that file is now orphaned.
    const info = await publish(pattern(3000));
    mockState.failMv = true;
    await expect(resolveSealedMedia('m9', 'image', 'https://example/x', info)).rejects.toThrow(
      /ENOSPC/,
    );
    expect([...mockState.files.keys()]).toEqual([]);
  });

  it('leaves no scratch files behind on success or failure', async () => {
    const info = await publish(pattern(3000));
    const path = await resolveSealedMedia('m6', 'image', 'https://example/x', info);
    expect([...mockState.files.keys()]).toEqual([path]);

    // Full length, but tampered — a genuine authentication failure, not an
    // incomplete download. Those two now leave the world in deliberately
    // different states (see mediaFiles.test.ts's "downloadAndDecrypt
    // resuming" suite): a short response is kept as a resumable partial,
    // but a fully-assembled object that fails to authenticate never is —
    // resuming onto something already known to be corrupt could not help.
    const tamperedInfo = await publish(pattern(3000));
    mockState.body[10] ^= 0xff;
    await expect(
      resolveSealedMedia('m7', 'image', 'https://example/x', tamperedInfo),
    ).rejects.toThrow(MediaIntegrityError);
    expect([...mockState.files.keys()]).toEqual([path]);
  });
});

describe('clearMediaCache', () => {
  it('removes decrypted attachments and nothing else', async () => {
    const info = await publish(pattern(1000));
    await resolveSealedMedia('m8', 'image', 'https://example/x', info);
    mockState.files.set('/cache/unrelated.txt', Buffer.from('keep me'));

    await clearMediaCache();

    expect([...mockState.files.keys()]).toEqual(['/cache/unrelated.txt']);
  });

  it('does not throw when there is nothing cached', async () => {
    await expect(clearMediaCache()).resolves.toBeUndefined();
  });

  // The cbxmedia_ files were never the only decrypted copy: anything handed to
  // <Image> is kept by the platform image loader too, and a photo was recovered
  // from there after sign-out.
  it('also clears the image loader cache, which holds decrypted copies too', async () => {
    mockState.files.set('/cache/image_cache/v2.ols100.1/65/abc.cnt', Buffer.from('a photo'));
    mockState.files.set('/cache/image_cache/v2.ols100.1/60/def.cnt', Buffer.from('a frame'));
    mockState.files.set('/cache/unrelated.txt', Buffer.from('keep me'));

    await clearMediaCache();

    expect([...mockState.files.keys()]).toEqual(['/cache/unrelated.txt']);
  });
});
