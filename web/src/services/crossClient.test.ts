/**
 * Does a message sealed by one client actually open on the other?
 *
 * `web/src/services/e2ee.ts` is a hand-kept port of `src/services/e2ee.ts`,
 * and nothing until now has ever run the two against each other — every test
 * on both sides seals and opens with its own copy, which passes just as
 * happily if the two copies have drifted apart. A real Android phone talking
 * to a real browser is the first thing that ever exercised the pair, and it
 * came back with garbled text.
 *
 * Both modules import only @noble/* and ./crypto, so they load side by side in
 * one process with nothing stubbed.
 */
import {describe, expect, it} from 'vitest';
import * as mobile from '../../../src/services/e2ee';
import * as web from './e2ee';
import * as mobileMedia from '../../../src/services/mediaCrypto';
import * as webMedia from './mediaCrypto';
import * as mobileBody from '../../../src/services/messageBody';
import * as webBody from './messageBody';

const CHAT = 'chat-cross-client';

// Chinese is the case that matters: every byte of it is multi-byte, so an
// encoder that works a character at a time passes on ASCII and mangles this.
const SAMPLES = [
  'hello',
  '你好,今天怎么样?',
  '这是一条很长的中文消息,用来确认多字节字符在两端之间不会被截断或错位。',
  '混合 mixed 内容 123 !@#',
  '🔒 emoji 和中文 🎉',
  'Ω≈ç√∫˜µ≤≥÷',
];

describe('a message sealed on one client opens on the other', () => {
  it('mobile -> web', () => {
    const sender = mobile.generateKeypair();
    const reader = web.generateKeypair();
    for (const text of SAMPLES) {
      const envelope = mobile.sealForRecipients(
        text,
        sender.secretKey,
        [{uid: 'reader', publicKey: reader.publicKey}],
        CHAT,
      );
      expect(web.openSealed(envelope, reader.secretKey, 'reader', CHAT)).toBe(text);
    }
  });

  it('web -> mobile', () => {
    const sender = web.generateKeypair();
    const reader = mobile.generateKeypair();
    for (const text of SAMPLES) {
      const envelope = web.sealForRecipients(
        text,
        sender.secretKey,
        [{uid: 'reader', publicKey: reader.publicKey}],
        CHAT,
      );
      expect(mobile.openSealed(envelope, reader.secretKey, 'reader', CHAT)).toBe(text);
    }
  });

  it('each client can still read its own', () => {
    // The control. If this fails too, the fault is not cross-client.
    const s = mobile.generateKeypair();
    const r = mobile.generateKeypair();
    const e = mobile.sealForRecipients('你好', s.secretKey, [{uid: 'r', publicKey: r.publicKey}], CHAT);
    expect(mobile.openSealed(e, r.secretKey, 'r', CHAT)).toBe('你好');

    const s2 = web.generateKeypair();
    const r2 = web.generateKeypair();
    const e2 = web.sealForRecipients('你好', s2.secretKey, [{uid: 'r', publicKey: r2.publicKey}], CHAT);
    expect(web.openSealed(e2, r2.secretKey, 'r', CHAT)).toBe('你好');
  });
});


/**
 * An attachment encrypted by one client has to open on the other.
 *
 * This is the wire format of a file — chunk size, nonce derivation, tag
 * placement — and a divergence here does not fail loudly. It fails as a photo
 * the other side can never open, which is indistinguishable from a network
 * problem. Both files are byte-identical below their headers on purpose; this
 * is what makes that claim checkable rather than a comment.
 */
describe('an attachment sealed on one client opens on the other', () => {
  /**
   * One full chunk plus a partial: enough to cross a chunk boundary and to
   * have a short final chunk, which are the two things the format can get
   * wrong. It was two full chunks plus a partial, and that took 7.1s and 8.4s
   * on a CI runner against vitest's 5s default — a real failure, not a flake,
   * and the extra chunk proved nothing the first boundary had not.
   *
   * The explicit timeouts stay anyway. A megabyte of chunked AEAD each way is
   * genuinely slow work, and a test that passes or fails with the load on the
   * machine is worse than one that is simply slow.
   */
  const payload = new Uint8Array(mobileMedia.CHUNK_BYTES + 1234);
  for (let i = 0; i < payload.length; i++) payload[i] = (i * 31 + 7) % 256;

  it('mobile -> web', {timeout: 30_000}, async () => {
    const sink = mobileMedia.collectingSink();
    const info = await mobileMedia.encryptMedia(mobileMedia.bytesSource(payload), sink, {
      mime: 'image/jpeg',
    });
    const out = webMedia.collectingSink();
    await webMedia.decryptMedia(webMedia.bytesSource(sink.result()), out, info);
    expect(out.result()).toEqual(payload);
  });

  it('web -> mobile', {timeout: 30_000}, async () => {
    const sink = webMedia.collectingSink();
    const info = await webMedia.encryptMedia(webMedia.bytesSource(payload), sink, {
      mime: 'image/jpeg',
    });
    const out = mobileMedia.collectingSink();
    await mobileMedia.decryptMedia(mobileMedia.bytesSource(sink.result()), out, info);
    expect(out.result()).toEqual(payload);
  });

  it('refuses a ciphertext whose bytes were altered', {timeout: 30_000}, async () => {
    // The property the previous scheme lacked: a wrong key or a tampered
    // object raises rather than returning garbage.
    const sink = webMedia.collectingSink();
    const info = await webMedia.encryptMedia(webMedia.bytesSource(payload), sink, {});
    const tampered = sink.result();
    tampered[100] ^= 0xff;
    await expect(
      mobileMedia.decryptMedia(mobileMedia.bytesSource(tampered), mobileMedia.collectingSink(), info),
    ).rejects.toThrow();
  });
});

/**
 * And the body that carries the attachment's key has to round-trip too.
 *
 * The key travels inside the sealed body, so if one client encodes a body the
 * other decodes as plain text, the reader sees a NUL marker and a JSON header
 * where their message should be — and the key inside it is lost, which loses
 * the attachment.
 */
describe('a message body encoded on one client decodes on the other', () => {
  const KEY = {
    alg: mobileMedia.MEDIA_CRYPTO_ALG,
    key: 'a'.repeat(43) + '=',
    nonceBase: 'b'.repeat(22) + '==',
    chunkBytes: 1024,
    chunkCount: 2,
    plaintextBytes: 2048,
    mime: 'image/jpeg',
  } as const;

  it('text-only stays byte-identical, so an older reader is unaffected', () => {
    expect(webBody.encodeBody({text: '你好'})).toBe('你好');
    expect(mobileBody.encodeBody({text: '你好'})).toBe('你好');
  });

  it('web -> mobile, with a media key', () => {
    const encoded = webBody.encodeBody({text: 'look', media: {image: KEY}});
    const back = mobileBody.decodeBody(encoded);
    expect(back.text).toBe('look');
    expect(back.media?.image).toEqual(KEY);
  });

  it('mobile -> web, with a media key', () => {
    const encoded = mobileBody.encodeBody({text: 'look', media: {image: KEY}});
    const back = webBody.decodeBody(encoded);
    expect(back.text).toBe('look');
    expect(back.media?.image).toEqual(KEY);
  });
});
