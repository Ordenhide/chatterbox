/**
 * These run against an in-memory stand-in for react-native-blob-util. The
 * point is not to re-test the cryptography — mediaCrypto.test.ts does that —
 * but the things only this layer can get wrong: leaking scratch files,
 * treating an HTTP error page as ciphertext, and leaving a half-written
 * plaintext file behind when decryption fails.
 */
/**
 * State the mock reads. Only ever touched from inside the factory's method
 * bodies: `jest.mock` is hoisted above these declarations, so anything the
 * factory dereferences while *building* its return value is still in the
 * temporal dead zone. (That is what "Cannot read properties of undefined"
 * means when it comes from a hoisted jest mock.)
 */
const mockState = {
  files: new Map<string, Buffer>(),
  status: 200,
  body: Buffer.alloc(0),
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
        if (!mockState.files.delete(mockNormalize(path))) throw new Error(`ENOENT ${path}`);
      },
      async exists(path: string) {
        return mockState.files.has(mockNormalize(path));
      },
    },
    config: (options: {path: string}) => ({
      async fetch() {
        mockState.files.set(mockNormalize(options.path), Buffer.from(mockState.body));
        return {info: () => ({status: mockState.status})};
      },
    }),
  },
}));

import {MediaIntegrityError, bytesSource, collectingSink, encryptMedia} from '../mediaCrypto';
import {
  discard,
  downloadAndDecrypt,
  encryptToScratch,
  fileSink,
  fileSource,
  scratchPath,
  toPath,
} from '../mediaFiles';

function pattern(length: number): Buffer {
  const out = Buffer.alloc(length);
  for (let i = 0; i < length; i++) out[i] = (i * 31) & 0xff;
  return out;
}

/** Scratch files this layer created, i.e. everything but the named inputs. */
function leaked(...expected: string[]): string[] {
  return [...mockState.files.keys()].filter(k => !expected.includes(k));
}

beforeEach(() => {
  mockState.files.clear();
  mockState.status = 200;
  mockState.body = Buffer.alloc(0);
});

describe('toPath', () => {
  it.each([
    ['file:///a/b.jpg', '/a/b.jpg'],
    ['/a/b.jpg', '/a/b.jpg'],
    ['file:///a/my%20photo.jpg', '/a/my photo.jpg'],
  ])('maps %s to %s', (uri, expected) => {
    expect(toPath(uri)).toBe(expected);
  });
});

describe('scratchPath', () => {
  it('never returns the same path twice', () => {
    const seen = new Set(Array.from({length: 200}, () => scratchPath('x')));
    expect(seen.size).toBe(200);
  });
});

describe('fileSource / fileSink', () => {
  it('reads back exactly what was written', async () => {
    const data = pattern(5000);
    mockState.files.set('/in', data);
    const source = await fileSource('/in');
    expect(source.size).toBe(5000);
    expect(Buffer.from(await source.read(100, 250))).toEqual(data.subarray(100, 350));
  });

  it('leaves no slice files behind', async () => {
    mockState.files.set('/in', pattern(5000));
    const source = await fileSource('/in');
    await source.read(0, 100);
    await source.read(100, 100);
    expect(leaked('/in')).toEqual([]);
  });

  it('truncates an existing file rather than appending to it', async () => {
    mockState.files.set('/out', Buffer.from('stale data that must not survive'));
    const sink = await fileSink('/out');
    await sink.write(new Uint8Array([1, 2, 3]));
    expect(mockState.files.get('/out')).toEqual(Buffer.from([1, 2, 3]));
  });

  it('handles a zero-length read without touching the filesystem', async () => {
    mockState.files.set('/in', pattern(10));
    const source = await fileSource('/in');
    expect(await source.read(0, 0)).toEqual(new Uint8Array(0));
    expect(leaked('/in')).toEqual([]);
  });
});

describe('encryptToScratch', () => {
  it('produces a ciphertext file that decrypts back to the original', async () => {
    const data = pattern(3000);
    mockState.files.set('/in', data);
    const {path, info} = await encryptToScratch('/in', {mime: 'image/png'});

    expect(mockState.files.has(path)).toBe(true);
    expect(mockState.files.get(path)).not.toEqual(data);
    expect(info.mime).toBe('image/png');
    expect(info.plaintextBytes).toBe(3000);

    const sink = collectingSink();
    const {decryptMedia} = require('../mediaCrypto');
    await decryptMedia(await fileSource(path), sink, info);
    expect(Buffer.from(sink.result())).toEqual(data);
  });

  it('deletes its scratch file when encryption fails', async () => {
    // No such input file, so fileSource throws after the scratch path exists.
    await expect(encryptToScratch('/missing')).rejects.toThrow();
    expect(leaked()).toEqual([]);
  });
});

describe('downloadAndDecrypt', () => {
  async function publish(data: Buffer) {
    const sink = collectingSink();
    const info = await encryptMedia(bytesSource(new Uint8Array(data)), sink, {});
    mockState.body = Buffer.from(sink.result());
    return info;
  }

  it('downloads, decrypts, and cleans up the ciphertext', async () => {
    const data = pattern(4096);
    const info = await publish(data);
    const out = await downloadAndDecrypt('https://example/x', info, '/plain');
    expect(out).toBe('/plain');
    expect(mockState.files.get('/plain')).toEqual(data);
    expect(leaked('/plain')).toEqual([]);
  });

  it('reports an HTTP error as an error, not as tampering', async () => {
    // A 403 writes the error page into the destination file. Without the
    // status check that lands in the decryptor and is reported as a failed
    // authentication, sending everyone hunting for a crypto bug.
    const info = await publish(pattern(100));
    mockState.status = 403;
    mockState.body = Buffer.from('<html>Permission denied</html>');
    await expect(downloadAndDecrypt('https://example/x', info, '/plain')).rejects.toThrow(
      /HTTP 403/,
    );
  });

  it('leaves no plaintext file behind when the object fails to authenticate', async () => {
    const info = await publish(pattern(4096));
    mockState.body[10] ^= 0xff;
    await expect(downloadAndDecrypt('https://example/x', info, '/plain')).rejects.toThrow(
      MediaIntegrityError,
    );
    // A partially written file that a caller then renders is the failure this
    // cleanup exists to prevent.
    expect(mockState.files.has('/plain')).toBe(false);
    expect(leaked()).toEqual([]);
  });

  it('cleans up the downloaded ciphertext even on failure', async () => {
    const info = await publish(pattern(100));
    mockState.status = 500;
    await expect(downloadAndDecrypt('https://example/x', info, '/plain')).rejects.toThrow();
    expect(leaked()).toEqual([]);
  });
});

describe('discard', () => {
  it('does not throw on a missing file', async () => {
    await expect(discard('/nope')).resolves.toBeUndefined();
  });

  it('ignores null and undefined', async () => {
    await expect(discard(null)).resolves.toBeUndefined();
    await expect(discard(undefined)).resolves.toBeUndefined();
  });
});
