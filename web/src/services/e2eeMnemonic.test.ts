import {describe, expect, it} from 'vitest';
import {generateKeypair} from './e2ee';
import {isValidMnemonic, mnemonicToSecretKey, secretKeyToMnemonic} from './e2eeMnemonic';

/**
 * Mirrors src/services/__tests__/e2eeMnemonic.test.ts in the mobile app, plus
 * the cross-platform vector below — the one thing a per-platform test suite
 * can't catch on its own.
 */

describe('secretKeyToMnemonic / mnemonicToSecretKey', () => {
  it('round-trips a real X25519 secret key exactly', () => {
    const {secretKey} = generateKeypair();
    const phrase = secretKeyToMnemonic(secretKey);
    expect(mnemonicToSecretKey(phrase)).toEqual(secretKey);
  });

  it('produces a 24-word phrase for a 32-byte key', () => {
    const {secretKey} = generateKeypair();
    expect(secretKeyToMnemonic(secretKey).split(' ')).toHaveLength(24);
  });

  it('tolerates extra whitespace and mixed case on decode', () => {
    const {secretKey} = generateKeypair();
    const phrase = secretKeyToMnemonic(secretKey);
    const messy = `  ${phrase.toUpperCase().replace(/ /g, '   ')}  `;
    expect(mnemonicToSecretKey(messy)).toEqual(secretKey);
    expect(isValidMnemonic(messy)).toBe(true);
  });
});

describe('isValidMnemonic', () => {
  it('accepts a freshly generated phrase', () => {
    expect(isValidMnemonic(secretKeyToMnemonic(generateKeypair().secretKey))).toBe(true);
  });

  it('rejects a phrase with a bad checksum (swapped words)', () => {
    const words = secretKeyToMnemonic(generateKeypair().secretKey).split(' ');
    [words[0], words[1]] = [words[1], words[0]];
    expect(isValidMnemonic(words.join(' '))).toBe(false);
  });

  it('rejects unrelated text', () => {
    expect(isValidMnemonic('this is not a recovery phrase at all')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidMnemonic('')).toBe(false);
  });
});

describe('cross-platform phrase compatibility', () => {
  // The point of the whole feature is that a phrase written down on a phone
  // restores the same account in a browser. Both clients round-trip their own
  // output, so a divergence in wordlist or entropy handling would pass both
  // suites individually and only surface as "my phrase doesn't work" in the
  // user's hands. This pins the actual encoding to a fixed vector: if either
  // platform's implementation drifts, this fails on that platform.
  const KNOWN_KEY = new Uint8Array(32).fill(0);
  const KNOWN_PHRASE =
    'abandon abandon abandon abandon abandon abandon abandon abandon ' +
    'abandon abandon abandon abandon abandon abandon abandon abandon ' +
    'abandon abandon abandon abandon abandon abandon abandon art';

  it('encodes a known 32-byte key to the canonical BIP39 phrase', () => {
    expect(secretKeyToMnemonic(KNOWN_KEY)).toBe(KNOWN_PHRASE);
  });

  it('decodes that canonical phrase back to the same key', () => {
    expect(mnemonicToSecretKey(KNOWN_PHRASE)).toEqual(KNOWN_KEY);
  });
});
