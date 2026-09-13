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
