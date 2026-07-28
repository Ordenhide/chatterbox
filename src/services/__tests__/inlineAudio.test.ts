// The FS module is native; stub it so these tests exercise our own encoding,
// budget, and data-URI parsing rather than the bridge.
const mockFs = {
  files: new Map<string, string>(),
  readFileImpl: jest.fn(),
};

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: {CacheDir: '/caches'},
      readFile: (path: string) => mockFs.readFileImpl(path),
      writeFile: jest.fn(async (path: string, content: string) => {
        mockFs.files.set(path, content);
      }),
      exists: jest.fn(async (path: string) => mockFs.files.has(path)),
      unlink: jest.fn(async (path: string) => {
        mockFs.files.delete(path);
      }),
    },
  },
}));

import {
  encodeAudioForInline,
  extensionForAudioMime,
  isDataUri,
  materializeInlineAudio,
  MAX_INLINE_BYTES,
  MAX_INLINE_DATA_URI_CHARS,
} from '../inlineAudio';

/** base64 for a payload of exactly `bytes` raw bytes. */
const base64OfBytes = (bytes: number) => Buffer.alloc(bytes).toString('base64');

beforeEach(() => {
  mockFs.files.clear();
  mockFs.readFileImpl.mockReset();
  // Clears call counts while keeping the factory implementations, so
  // per-test assertions on writeFile don't inherit earlier tests' calls.
  jest.clearAllMocks();
});

describe('isDataUri', () => {
  it('separates an embedded clip from a Storage URL', () => {
    expect(isDataUri('data:audio/mp4;base64,AAAA')).toBe(true);
    expect(isDataUri('https://firebasestorage.googleapis.com/x.m4a')).toBe(false);
    expect(isDataUri('file:///var/tmp/sound.m4a')).toBe(false);
    expect(isDataUri(null)).toBe(false);
    expect(isDataUri(undefined)).toBe(false);
  });
});

describe('encodeAudioForInline', () => {
  it('returns a data URI carrying the audio mime type', async () => {
    mockFs.readFileImpl.mockResolvedValue(base64OfBytes(1024));
    const uri = await encodeAudioForInline('file:///tmp/a.m4a');
    expect(uri).toMatch(/^data:audio\/mp4;base64,/);
  });

  it('strips the file:// scheme before touching the filesystem', async () => {
    mockFs.readFileImpl.mockResolvedValue(base64OfBytes(16));
    await encodeAudioForInline('file:///var/tmp/my%20clip.m4a');
    // Native FS wants a bare, decoded path — not a URL.
    expect(mockFs.readFileImpl).toHaveBeenCalledWith('/var/tmp/my clip.m4a');
  });

  it('accepts a clip at exactly the byte budget', async () => {
    mockFs.readFileImpl.mockResolvedValue(base64OfBytes(MAX_INLINE_BYTES));
    const uri = await encodeAudioForInline('file:///tmp/a.m4a');
    expect(uri).not.toBeNull();
    // The prefix must be accounted for, or a clip at the budget overflows.
    expect(uri!.length).toBeLessThanOrEqual(MAX_INLINE_DATA_URI_CHARS);
  });

  it('refuses a clip past the budget so the caller can fall back to Storage', async () => {
    mockFs.readFileImpl.mockResolvedValue(base64OfBytes(MAX_INLINE_BYTES * 2));
    expect(await encodeAudioForInline('file:///tmp/big.m4a')).toBeNull();
  });

  it('never yields a URI that would overflow a Firestore document', async () => {
    mockFs.readFileImpl.mockResolvedValue(base64OfBytes(MAX_INLINE_BYTES));
    const uri = await encodeAudioForInline('file:///tmp/a.m4a');
    expect(uri!.length).toBeLessThan(1024 * 1024);
  });
});

describe('extensionForAudioMime', () => {
  it('names a web-recorded Opus clip honestly rather than assuming AAC', () => {
    // A clip from Chrome/Firefox arrives as WebM; calling it .m4a misleads the
    // native decoder about the container.
    expect(extensionForAudioMime('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionForAudioMime('audio/webm')).toBe('webm');
  });

  it('maps the AAC/MP4 we record to m4a', () => {
    expect(extensionForAudioMime('audio/mp4')).toBe('m4a');
    expect(extensionForAudioMime('audio/aac')).toBe('m4a');
  });

  it('falls back to m4a for anything unrecognised', () => {
    expect(extensionForAudioMime('')).toBe('m4a');
    expect(extensionForAudioMime('audio/flac')).toBe('m4a');
  });
});

describe('materializeInlineAudio', () => {
  it('writes the decoded clip to a stable per-message path', async () => {
    const path = await materializeInlineAudio('data:audio/mp4;base64,QUJD', 'msg_1');
    expect(path).toBe('/caches/voice_msg_1.m4a');
    expect(mockFs.files.get(path)).toBe('QUJD');
  });

  it('gives a web-recorded WebM clip a .webm path, not .m4a', async () => {
    const path = await materializeInlineAudio('data:audio/webm;base64,QUJD', 'msg_web');
    expect(path).toBe('/caches/voice_msg_web.webm');
  });

  it('decodes only once — replaying reuses the existing file', async () => {
    const {fs} = require('react-native-blob-util').default;
    await materializeInlineAudio('data:audio/mp4;base64,QUJD', 'msg_2');
    await materializeInlineAudio('data:audio/mp4;base64,QUJD', 'msg_2');
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });

  it('sanitises ids that would otherwise escape the cache directory', async () => {
    const path = await materializeInlineAudio('data:audio/mp4;base64,QUJD', '../../etc/passwd');
    expect(path).toBe('/caches/voice_.._.._etc_passwd.m4a');
  });

  it('rejects a malformed data URI rather than writing garbage', async () => {
    await expect(materializeInlineAudio('data:audio/mp4;base64', 'msg_3')).rejects.toThrow(
      /malformed/,
    );
  });
});
