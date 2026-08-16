/**
 * Encodes the E2EE device secret key (see e2eeKeys.ts) as a BIP39 mnemonic,
 * so it can be shown to the user once as a human-writable recovery phrase and
 * typed back in later to restore decryption in a fresh browser profile.
 *
 * The secret key is exactly 32 bytes of raw entropy — entropyToMnemonic /
 * mnemonicToEntropy round-trip those bytes exactly (the checksum word is
 * derived from the entropy, not mixed into it), so decoding a correctly
 * transcribed phrase always yields back the identical key.
 *
 * Byte-for-byte the same scheme as the mobile app's services/e2eeMnemonic.ts —
 * deliberately, so one phrase restores the same account on either client. Keep
 * the two in step: a divergence here would silently make phrases written down
 * on one platform useless on the other.
 */
import {entropyToMnemonic, mnemonicToEntropy, validateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english.js';

/** 32 bytes of entropy -> a 24-word mnemonic. */
export function secretKeyToMnemonic(secretKey: Uint8Array): string {
  return entropyToMnemonic(secretKey, wordlist);
}

/**
 * Reverses secretKeyToMnemonic. Throws if the phrase's words or checksum
 * don't check out — callers should validate with isValidMnemonic first to
 * surface a friendlier error than this throwing mid-restore.
 */
export function mnemonicToSecretKey(mnemonic: string): Uint8Array {
  return mnemonicToEntropy(normalizeMnemonic(mnemonic), wordlist);
}

export function isValidMnemonic(mnemonic: string): boolean {
  try {
    return validateMnemonic(normalizeMnemonic(mnemonic), wordlist);
  } catch {
    return false;
  }
}

// Users retyping a phrase will vary casing and whitespace (extra spaces,
// newlines from a pasted multi-line note); normalize before validating or
// decoding so those don't read as a wrong phrase.
function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
}
