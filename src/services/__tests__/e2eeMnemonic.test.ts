import {generateKeypair} from '../e2ee';
import {isValidMnemonic, mnemonicToSecretKey, secretKeyToMnemonic} from '../e2eeMnemonic';

describe('secretKeyToMnemonic / mnemonicToSecretKey', () => {
  it('round-trips a real X25519 secret key exactly', () => {
    const {secretKey} = generateKeypair();
    const phrase = secretKeyToMnemonic(secretKey);
    expect(mnemonicToSecretKey(phrase)).toEqual(secretKey);
  });

  it('produces a 24-word phrase for a 32-byte key', () => {
    const {secretKey} = generateKeypair();
    const phrase = secretKeyToMnemonic(secretKey);
    expect(phrase.split(' ')).toHaveLength(24);
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
    const phrase = secretKeyToMnemonic(generateKeypair().secretKey);
    expect(isValidMnemonic(phrase)).toBe(true);
  });

  /**
   * A fixed phrase, not a freshly generated one.
   *
   * This used to swap the first two words of a random mnemonic and expect the
   * checksum to reject it, which is true only most of the time. A 24-word
   * phrase carries 256 entropy bits and 8 checksum bits; swapping two words
   * changes only entropy, so the new entropy's correct checksum coincides with
   * the unchanged 8 bits about once in 256 — and when the two words happen to
   * be the same word, the swap changes nothing at all.
   *
   * Measured over 200,000 phrases: 0.427% still validated. It failed a real CI
   * run, on a commit that had not touched this file. The vector below is
   * checked to be a swap that genuinely breaks the checksum.
   */
  const VALID =
    'abandon amount liar amount expire adjust cage candy arch gather drum bullet ' +
    'absurd math era live bid rhythm alien crouch range attend journey unaware';
  const SWAPPED =
    'amount abandon liar amount expire adjust cage candy arch gather drum bullet ' +
    'absurd math era live bid rhythm alien crouch range attend journey unaware';

  it('accepts the fixed vector, so the rejection below means something', () => {
    expect(isValidMnemonic(VALID)).toBe(true);
  });

  it('rejects a phrase with a bad checksum (swapped words)', () => {
    expect(isValidMnemonic(SWAPPED)).toBe(false);
  });

  it('rejects unrelated text', () => {
    expect(isValidMnemonic('this is not a recovery phrase at all')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidMnemonic('')).toBe(false);
  });
});

describe('cross-platform phrase compatibility', () => {
  // Paired with the identical block in web/src/services/e2eeMnemonic.test.ts.
  // The point of the feature is that a phrase written down on a phone restores
  // the same account in a browser; both clients round-trip their own output, so
  // a divergence in wordlist or entropy handling would pass both suites
  // individually and only surface as "my phrase doesn't work" in the user's
  // hands. Pinning the encoding to a fixed vector on both sides means whichever
  // platform drifts is the one that fails.
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
