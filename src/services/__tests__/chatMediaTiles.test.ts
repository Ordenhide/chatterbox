/**
 * The media grid's branching, which is where it was broken.
 *
 * It used to filter `image || video` off the raw snapshot. Encrypted media
 * defeats that in two opposite directions at once — sealed bytes keep a
 * plaintext URL that must not be rendered, and a sealed pointer blanks the
 * field the filter reads — so the grid was permanently empty while looking
 * like a render fault. These cases say which branch each shape takes.
 */
import {generateKeypair, sealForRecipients} from '../e2ee';
import {MEDIA_CRYPTO_ALG} from '../mediaCrypto';
import {planMediaTiles} from '../chatMediaTiles';

const CHAT = 'chat-media-tiles';
const UID = 'alice';

const KEY = {
  alg: MEDIA_CRYPTO_ALG,
  key: 'a'.repeat(43) + '=',
  nonceBase: 'b'.repeat(22) + '==',
  chunkBytes: 1024,
  chunkCount: 2,
  plaintextBytes: 2048,
} as const;

function plan(
  messages: Record<string, unknown>[],
  over: Partial<Parameters<typeof planMediaTiles>[1]> = {},
) {
  return planMediaTiles(messages, {
    uid: UID,
    chatId: CHAT,
    secretKey: null,
    keysFor: () => ({}),
    resolved: new Map(),
    ...over,
  });
}

describe('planMediaTiles', () => {
  it('produces a tile for each visual attachment and none for a plain message', () => {
    // Pinned first: every case below asserts something about tiles, and all of
    // them would pass vacuously against a planner that returned nothing.
    const {tiles} = plan([
      {_id: 'text-only', text: 'hello'},
      {_id: 'photo', image: 'https://example.test/a.jpg'},
      {_id: 'clip', video: 'https://example.test/b.mp4', videoDuration: 12},
    ]);
    expect(tiles.map(x => x.key)).toEqual(['photo:image', 'clip:video']);
  });

  it('turns sealed bytes into a job rather than rendering the ciphertext URL', () => {
    const {tiles, jobs} = plan(
      [{_id: 'm1', image: 'https://example.test/cipher.bin', mediaSealed: true}],
      {keysFor: () => ({image: KEY})},
    );
    // The tile exists but carries no uri: the URL it has points at ciphertext,
    // and showing that is a broken-image icon standing in for an integrity
    // failure.
    expect(tiles[0].uri).toBeNull();
    expect(jobs).toEqual([
      {key: 'm1:image', id: 'm1', slot: 'image', url: 'https://example.test/cipher.bin', info: KEY},
    ]);
  });

  it('gives up on sealed bytes whose key this device never stored', () => {
    // The key lived inside a ratchet envelope that has already been spent, so
    // no amount of retrying will produce it.
    const resolved = new Map<string, string | null>();
    const {tiles, jobs} = plan(
      [{_id: 'm1', image: 'https://example.test/cipher.bin', mediaSealed: true}],
      {keysFor: () => ({}), resolved},
    );
    expect(tiles[0].uri).toBeNull();
    expect(jobs).toEqual([]);
    // Recorded as decided, so the next snapshot does not queue it again.
    expect(resolved.get('m1:image')).toBeNull();
  });

  it('opens a sealed pointer immediately — the case that used to vanish', () => {
    const reader = generateKeypair();
    const sender = generateKeypair();
    const url = 'https://example.test/readable.jpg';
    const encryptedImage = sealForRecipients(
      url,
      sender.secretKey,
      [{uid: UID, publicKey: reader.publicKey}],
      CHAT,
    );

    const {tiles, jobs} = plan([{_id: 'm1', encryptedImage}], {secretKey: reader.secretKey});
    expect(tiles[0].uri).toBe(url);
    expect(jobs).toEqual([]);
  });

  it('does not crash, and does not claim a tile, without a device key', () => {
    const sender = generateKeypair();
    const reader = generateKeypair();
    const encryptedImage = sealForRecipients(
      'https://example.test/x.jpg',
      sender.secretKey,
      [{uid: UID, publicKey: reader.publicKey}],
      CHAT,
    );
    const {tiles, jobs} = plan([{_id: 'm1', encryptedImage}], {secretKey: null});
    expect(tiles).toHaveLength(1);
    expect(tiles[0].uri).toBeNull();
    expect(jobs).toEqual([]);
  });

  it('passes an unsealed attachment straight through', () => {
    const {tiles, jobs} = plan([{_id: 'm1', image: 'https://example.test/old.jpg'}]);
    expect(tiles[0].uri).toBe('https://example.test/old.jpg');
    expect(jobs).toEqual([]);
  });

  it('reuses what an earlier snapshot resolved instead of re-queuing it', () => {
    const resolved = new Map<string, string | null>([['m1:image', 'file:///tmp/a.jpg']]);
    const {tiles, jobs} = plan(
      [{_id: 'm1', image: 'https://example.test/cipher.bin', mediaSealed: true}],
      {keysFor: () => ({image: KEY}), resolved},
    );
    expect(tiles[0].uri).toBe('file:///tmp/a.jpg');
    expect(jobs).toEqual([]);
  });

  it('keeps a duration on the video slot only', () => {
    const {tiles} = plan([
      {_id: 'm1', image: 'https://example.test/a.jpg', videoDuration: 9},
      {_id: 'm2', video: 'https://example.test/b.mp4', videoDuration: 9},
    ]);
    expect(tiles[0].durationSeconds).toBeUndefined();
    expect(tiles[1].durationSeconds).toBe(9);
  });
});
