/**
 * The account *is* the recovery phrase.
 *
 * Chatterbox has no email address, no phone number and no password. Signing
 * up generates 32 random bytes; those bytes are shown to the user once as the
 * 24-word phrase this app already had (e2eeMnemonic.ts), and everything else —
 * the credential that opens the account, and the X25519 key that decrypts its
 * messages — is derived from them. Nothing that identifies a person is ever
 * collected, so there is nothing to hand over, leak, or subpoena.
 *
 * ## What is derived from what
 *
 *   seed (32 bytes, = the 24 words)
 *     ├── HKDF(info="chatterbox/anon-account-id/v1")     -> login address
 *     ├── HKDF(info="chatterbox/anon-account-secret/v1") -> login secret
 *     └── used verbatim as the E2EE device secret key    -> see e2eeKeys.ts
 *
 * The third line is deliberate rather than lazy. The phrase has always been
 * the E2EE key itself, and changing that would have invalidated every phrase
 * already written down and every test that round-trips one. Deriving the two
 * credentials *beside* it instead means one phrase restores both halves of an
 * account — the identity and the ability to read it — in a single step, which
 * is why signing in and restoring keys are now the same action.
 *
 * Reusing the seed this way is safe because the two HKDF outputs are used
 * only as opaque bearer strings and never in a Diffie-Hellman: the published
 * X25519 public key reveals nothing about them (recovering the seed from it is
 * the discrete-log problem), and neither of them reveals anything about the
 * seed (recovering it from an HKDF output is a preimage on HMAC-SHA256).
 * Distinct `info` labels keep the two credentials independent of each other.
 *
 * ## What Google can see, stated plainly
 *
 * Firebase Authentication is still the thing checking the credential, so the
 * derived secret does reach Google on each sign-in (over TLS) and is stored
 * there as a password hash. That is the whole extent of it: the secret is a
 * leaf of the derivation, so it cannot be run backwards to the seed and cannot
 * decrypt a single message. What Google no longer holds is an address, a
 * number, or any other identifier that points at a person — the account is a
 * random 128-bit label and nothing else.
 *
 * It does not, and cannot, hide the network layer: Google still sees the IP
 * and timing of every connection this app makes. Anonymity from the *service*
 * is what this buys. Anonymity from the *network* needs Tor or a VPN and is
 * not something an app can provide on its own. See e2ee.ts's caveat list.
 *
 * ## There is no recovery
 *
 * A lost phrase is a lost account, permanently — no reset email exists to
 * send, which is the point. Callers must not create an account before the
 * user has been shown the phrase and confirmed they have it; see
 * SignUpScreen.
 */
import {hkdf} from '@noble/hashes/hkdf.js';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToBase64, bytesToHex, secureRandomBytes, utf8ToBytes} from './crypto';
import {isValidMnemonic, mnemonicToSecretKey, secretKeyToMnemonic} from './e2eeMnemonic';

/** Matches the BIP39 entropy length the 24-word phrase encodes. */
export const SEED_BYTES = 32;

/**
 * Reserved by RFC 2606 precisely so it can never be registered or resolved.
 * Firebase Auth wants something email-shaped as the account handle; this is
 * the shape without the substance. Using a domain that *could* exist would
 * leave open the possibility of someone standing up a catch-all mailbox for
 * it and receiving whatever Firebase might one day decide to send there.
 */
export const ANON_ADDRESS_DOMAIN = 'anon.chatterbox.invalid';

// HKDF's salt is a domain separator here, not a secret: there is nothing
// per-account to put in it, since the seed is already 32 bytes of uniform
// randomness. Fixed and versioned so a future scheme can change it without
// colliding with an account minted under this one.
const HKDF_SALT = utf8ToBytes('chatterbox/anon-identity/v1');
const ACCOUNT_ID_INFO = utf8ToBytes('chatterbox/anon-account-id/v1');
const ACCOUNT_SECRET_INFO = utf8ToBytes('chatterbox/anon-account-secret/v1');

/**
 * 16 bytes, not 32. This is a lookup handle, not a secret: it is stored in
 * plaintext by Firebase and visible to anyone with project access. 128 bits
 * is far past the point where guessing an existing account is feasible, and
 * keeping it short keeps the address readable in a console.
 */
const ACCOUNT_ID_BYTES = 16;
const ACCOUNT_SECRET_BYTES = 32;

export type AnonymousCredentials = {
  /** Stands in for an email address at Firebase Auth. Not a mailbox. */
  address: string;
  /** Stands in for a password. Never typed by, or shown to, a human. */
  secret: string;
};

/** A fresh account's seed. The caller turns it into a phrase to display. */
export function newAccountSeed(): Uint8Array {
  return secureRandomBytes(SEED_BYTES);
}

/** The 24 words for a seed — what the user writes down, and their only key. */
export function seedToPhrase(seed: Uint8Array): string {
  return secretKeyToMnemonic(seed);
}

export function credentialsFromSeed(seed: Uint8Array): AnonymousCredentials {
  if (seed.length !== SEED_BYTES) {
    throw new Error(`anonymous identity seed must be ${SEED_BYTES} bytes`);
  }
  const id = hkdf(sha256, seed, HKDF_SALT, ACCOUNT_ID_INFO, ACCOUNT_ID_BYTES);
  const secret = hkdf(sha256, seed, HKDF_SALT, ACCOUNT_SECRET_INFO, ACCOUNT_SECRET_BYTES);
  return {
    address: `${bytesToHex(id)}@${ANON_ADDRESS_DOMAIN}`,
    secret: bytesToBase64(secret),
  };
}

/**
 * The seed a phrase encodes, or null if the phrase isn't one of ours.
 *
 * Null rather than a throw because every caller is a sign-in screen handing
 * over whatever the user typed, and a mistyped word is an ordinary outcome
 * there, not an exceptional one.
 */
export function seedFromPhrase(phrase: string): Uint8Array | null {
  if (!isValidMnemonic(phrase)) return null;
  try {
    const seed = mnemonicToSecretKey(phrase);
    return seed.length === SEED_BYTES ? seed : null;
  } catch {
    // isValidMnemonic already rejects bad words and bad checksums, so this is
    // unreachable in practice — but decoding is the step that would strand a
    // user on the sign-in screen with a crash rather than an error message.
    return null;
  }
}

/** Convenience for the sign-in path: phrase straight to credentials. */
export function credentialsFromPhrase(phrase: string): AnonymousCredentials | null {
  const seed = seedFromPhrase(phrase);
  return seed ? credentialsFromSeed(seed) : null;
}
