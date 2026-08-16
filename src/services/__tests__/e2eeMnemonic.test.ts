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
