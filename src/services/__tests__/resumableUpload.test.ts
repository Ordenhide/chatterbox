jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {dirs: {CacheDir: '/cache'}, stat: jest.fn(), slice: jest.fn(), unlink: jest.fn()},
    fetch: jest.fn(),
    wrap: (p: string) => `wrap:${p}`,
  },
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  CHUNK_BYTES,
  headerValue,
  planChunk,
  receivedOffset,
  startUrl,
  uploadResumable,
  uploadStatus,
} from '../resumableUpload';

const blobUtil = ReactNativeBlobUtil as unknown as {
  fs: {stat: jest.Mock; slice: jest.Mock; unlink: jest.Mock};
  fetch: jest.Mock;
};

/** One request the fake server received. */
type Sent = {url: string; headers: Record<string, string>; body?: unknown};

/**
 * A Storage that speaks the protocol, holding bytes in a counter.
 *
 * Deliberately answers from its own count rather than echoing what it was
 * told, so a caller that cuts a chunk from the wrong offset produces a
 * disagreement here instead of a passing test.
 */
function fakeStorage(options: {total: number; already?: number}) {
  const sent: Sent[] = [];
  const slices: {start: number; end: number}[] = [];
  let held = options.already ?? 0;
  let finalized = false;

  blobUtil.fs.stat.mockResolvedValue({size: options.total});
  blobUtil.fs.unlink.mockResolvedValue(undefined);
  blobUtil.fs.slice.mockImplementation(
    async (_src: string, _dest: string, start: number, end: number) => {
      slices.push({start, end});
    },
  );

  const reply = (headers: Record<string, string>) => ({info: () => ({status: 200, headers})});

  blobUtil.fetch.mockImplementation(
    async (_method: string, url: string, headers: Record<string, string>, body?: unknown) => {
      sent.push({url, headers, body});
      const command = headers['X-Goog-Upload-Command'];

      if (command === 'start') {
        return reply({'X-Goog-Upload-Status': 'active', 'X-Goog-Upload-URL': 'https://session/1'});
      }
      if (command === 'query') {
        return reply({
          'X-Goog-Upload-Status': finalized ? 'final' : 'active',
          'X-Goog-Upload-Size-Received': String(held),
        });
      }

      // The offset the caller claims has to match what this server actually
      // holds, or the object would be committed with a hole in it. Asserted
      // here so a miscalculated offset fails the test rather than passing it.
      expect(Number(headers['X-Goog-Upload-Offset'])).toBe(held);
      if (command !== 'finalize') {
        held = slices[slices.length - 1].end;
      }
      if (command.includes('finalize')) {
        finalized = true;
        return reply({'X-Goog-Upload-Status': 'final'});
      }
      return reply({
        'X-Goog-Upload-Status': 'active',
        'X-Goog-Upload-Size-Received': String(held),
      });
    },
  );

  return {
    sent,
    slices,
    get held() {
      return held;
    },
    get finalized() {
      return finalized;
    },
    commands: () => sent.map(s => s.headers['X-Goog-Upload-Command']),
  };
}

const base = {
  bucket: 'b',
  objectPath: 'chats/c1/enc_1',
  path: '/tmp/cipher.bin',
  mime: 'video/mp4',
  idToken: 'tok',
};

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * react-native-blob-util hands back whatever casing the platform's HTTP stack
 * used, and the two platforms do not agree. A verbatim lookup finds nothing on
 * the one that lowercased the name, and the symptom is not an error — it is a
 * resumable upload quietly behaving like a one-shot one, opening a fresh
 * session on every attempt and re-sending the whole file.
 */
describe('headerValue', () => {
  it('finds a header whatever its casing', () => {
    expect(headerValue({'X-Goog-Upload-URL': 'u'}, 'X-Goog-Upload-URL')).toBe('u');
    expect(headerValue({'x-goog-upload-url': 'u'}, 'X-Goog-Upload-URL')).toBe('u');
    expect(headerValue({'X-GOOG-UPLOAD-URL': 'u'}, 'x-goog-upload-url')).toBe('u');
  });

  it('is null for a header that is not there, and for no headers at all', () => {
    expect(headerValue({}, 'X-Goog-Upload-URL')).toBeNull();
    expect(headerValue(undefined, 'X-Goog-Upload-URL')).toBeNull();
  });
});

/**
 * Only 'active' and 'final' mean the session can still be used. Treating
 * anything else as usable would send the rest of a large file into a session
 * the server has discarded, and then report success for an object that does
 * not exist.
 */
describe('uploadStatus', () => {
  it('accepts the two usable states', () => {
    expect(uploadStatus({'X-Goog-Upload-Status': 'active'})).toBe('active');
    expect(uploadStatus({'x-goog-upload-status': 'final'})).toBe('final');
  });

  it('throws on a cancelled session, a missing header, and anything unknown', () => {
    expect(() => uploadStatus({'X-Goog-Upload-Status': 'cancelled'})).toThrow();
    expect(() => uploadStatus({})).toThrow();
    expect(() => uploadStatus(undefined)).toThrow();
    expect(() => uploadStatus({'X-Goog-Upload-Status': 'ACTIVE'})).toThrow();
  });
});

/**
 * This number decides where the next chunk is cut from, so a bad one is not a
 * failed upload — it is a committed object with a hole in it, or one truncated
 * and finalized as though complete.
 */
describe('receivedOffset', () => {
  it('reads the byte count the server reports', () => {
    expect(receivedOffset({'X-Goog-Upload-Size-Received': '0'}, 100)).toBe(0);
    expect(receivedOffset({'x-goog-upload-size-received': '100'}, 100)).toBe(100);
  });

  it('refuses a missing or empty count rather than assuming zero', () => {
    expect(() => receivedOffset({}, 100)).toThrow();
    expect(() => receivedOffset({'X-Goog-Upload-Size-Received': ''}, 100)).toThrow();
  });

  it('refuses a count that is not a whole number in range', () => {
    expect(() => receivedOffset({'X-Goog-Upload-Size-Received': 'lots'}, 100)).toThrow();
    expect(() => receivedOffset({'X-Goog-Upload-Size-Received': '-1'}, 100)).toThrow();
    expect(() => receivedOffset({'X-Goog-Upload-Size-Received': '101'}, 100)).toThrow();
    expect(() => receivedOffset({'X-Goog-Upload-Size-Received': '1.5'}, 100)).toThrow();
  });
});

describe('planChunk', () => {
  it('sends a whole chunk and keeps going while there is more', () => {
    expect(planChunk(10_000_000, 0, 4_000_000)).toEqual({
      start: 0,
      end: 4_000_000,
      command: 'upload',
    });
    expect(planChunk(10_000_000, 4_000_000, 4_000_000)).toEqual({
      start: 4_000_000,
      end: 8_000_000,
      command: 'upload',
    });
  });

  /**
   * The case worth pinning. A chunk that reaches the last byte has to say so
   * in the same request; sending a plain 'upload' leaves the object in an
   * unfinished session that nothing ever commits, so the upload "succeeds"
   * and the file is not there.
   */
  it('finalizes in the same request as the last bytes', () => {
    expect(planChunk(10_000_000, 8_000_000, 4_000_000)).toEqual({
      start: 8_000_000,
      end: 10_000_000,
      command: 'upload, finalize',
    });
    // Exactly one chunk long: the first request is also the last.
    expect(planChunk(4_000_000, 0, 4_000_000)).toEqual({
      start: 0,
      end: 4_000_000,
      command: 'upload, finalize',
    });
  });

  // An upload the server already holds in full still needs committing, which
  // is a request with no body at all.
  it('finalizes with no bytes when the server already has them all', () => {
    expect(planChunk(4_000_000, 4_000_000, 4_000_000)).toEqual({
      start: 4_000_000,
      end: 4_000_000,
      command: 'finalize',
    });
  });

  it('handles a zero-byte object', () => {
    expect(planChunk(0, 0, 4_000_000)).toEqual({start: 0, end: 0, command: 'finalize'});
  });

  it('defaults to a chunk size the protocol allows', () => {
    // Every chunk but the last must be a multiple of 256 KiB.
    expect(CHUNK_BYTES % (256 * 1024)).toBe(0);
    expect(planChunk(CHUNK_BYTES * 3, 0)).toEqual({
      start: 0,
      end: CHUNK_BYTES,
      command: 'upload',
    });
  });
});

describe('startUrl', () => {
  it('encodes the bucket and the object path', () => {
    expect(startUrl('b.appspot.com', 'chats/c1/enc_1')).toBe(
      'https://firebasestorage.googleapis.com/v0/b/b.appspot.com/o?name=chats%2Fc1%2Fenc_1',
    );
  });

  // The slashes in an object path are part of its name, not URL structure —
  // left unencoded the server reads a different object.
  it('escapes a path separator rather than leaving it as structure', () => {
    expect(startUrl('b', 'a/b')).toContain('name=a%2Fb');
  });
});

describe('uploadResumable', () => {
  it('opens a session, sends every chunk in order, and finalizes', async () => {
    const server = fakeStorage({total: 2500});
    await uploadResumable({...base, chunkBytes: 1000});

    expect(server.commands()).toEqual(['start', 'upload', 'upload', 'upload, finalize']);
    expect(server.slices).toEqual([
      {start: 0, end: 1000},
      {start: 1000, end: 2000},
      {start: 2000, end: 2500},
    ]);
    expect(server.finalized).toBe(true);
  });

  /**
   * The point of the whole module. Given a session from a run of the app that
   * no longer exists, the bytes already on the server must not be sent again.
   */
  it('resumes an existing session and sends only what is missing', async () => {
    const server = fakeStorage({total: 2500, already: 2000});
    await uploadResumable({...base, chunkBytes: 1000, sessionUrl: 'https://session/1'});

    expect(server.commands()).toEqual(['query', 'upload, finalize']);
    // Only the tail — not one byte from before the server's own offset.
    expect(server.slices).toEqual([{start: 2000, end: 2500}]);
    expect(server.sent[0].url).toBe('https://session/1');
  });

  // A session the server already holds in full still needs committing, and
  // that request carries no bytes at all.
  it('commits a session whose bytes all arrived before the app died', async () => {
    const server = fakeStorage({total: 2500, already: 2500});
    await uploadResumable({...base, chunkBytes: 1000, sessionUrl: 'https://session/1'});

    expect(server.commands()).toEqual(['query', 'finalize']);
    expect(server.slices).toEqual([]);
    expect(server.finalized).toBe(true);
  });

  it('does nothing more when the server reports the object already final', async () => {
    const server = fakeStorage({total: 2500, already: 2500});
    // Drive it to 'final' first, then resume the same session again.
    await uploadResumable({...base, chunkBytes: 1000, sessionUrl: 'https://session/1'});
    const after = server.sent.length;
    await uploadResumable({...base, chunkBytes: 1000, sessionUrl: 'https://session/1'});
    expect(server.commands().slice(after)).toEqual(['query']);
  });

  /**
   * The session URL has to reach the caller before any bytes move. One learned
   * but not yet written down is a URL the next crash loses, which is the exact
   * failure this module exists to remove.
   */
  it('hands over the session URL before sending anything', async () => {
    const server = fakeStorage({total: 2500});
    const seen: {url: string; requestsSoFar: number}[] = [];
    await uploadResumable({
      ...base,
      chunkBytes: 1000,
      onSession: url => {
        seen.push({url, requestsSoFar: server.sent.length});
      },
    });
    expect(seen).toEqual([{url: 'https://session/1', requestsSoFar: 1}]);
  });

  it('reports progress from the server offset, ending at 100', async () => {
    fakeStorage({total: 2000});
    const percents: number[] = [];
    await uploadResumable({...base, chunkBytes: 1000, onProgress: p => percents.push(p)});
    expect(percents[0]).toBe(0);
    expect(percents[percents.length - 1]).toBe(100);
    expect([...percents].sort((a, b) => a - b)).toEqual(percents);
  });

  /**
   * Without this the loop would re-send the same bytes forever against a
   * server that accepts a chunk and reports no progress — a hang rather than a
   * failure, and the hardest kind to diagnose from a bug report.
   */
  it('gives up rather than looping when a chunk makes no progress', async () => {
    fakeStorage({total: 2500});
    blobUtil.fs.slice.mockImplementation(async () => undefined);
    blobUtil.fetch.mockImplementation(async (_m: string, _u: string, headers: Record<string, string>) => ({
      info: () =>
        headers['X-Goog-Upload-Command'] === 'start'
          ? {status: 200, headers: {'X-Goog-Upload-Status': 'active', 'X-Goog-Upload-URL': 's'}}
          : {
              status: 200,
              headers: {'X-Goog-Upload-Status': 'active', 'X-Goog-Upload-Size-Received': '0'},
            },
    }));
    await expect(uploadResumable({...base, chunkBytes: 1000})).rejects.toThrow('no progress');
  });

  it('reports a non-2xx as a failure rather than carrying on', async () => {
    fakeStorage({total: 2500});
    blobUtil.fetch.mockResolvedValue({info: () => ({status: 403, headers: {}})});
    await expect(uploadResumable({...base, chunkBytes: 1000})).rejects.toThrow('HTTP 403');
  });
});
