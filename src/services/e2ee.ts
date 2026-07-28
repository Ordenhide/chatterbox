/**
 * End-to-end encryption for 1:1 text messages — PROTOTYPE.
 *
 * Design (deliberately the simplest thing that is actually end-to-end):
 *
 *   - Each device generates an X25519 keypair on first use. The secret key is
 *     written to the MMKV store (itself encrypted at rest with a CSPRNG key);
 *     the public key is published on the user's profile doc.
 *   - To send, the sender does X25519(theirSecret, recipientPublic) to get a
 *     shared secret, runs it through HKDF-SHA256 with a per-conversation salt,
 *     and seals the body with XChaCha20-Poly1305.
 *   - The server stores only {alg, nonce, ciphertext}. Firestore never sees the
 *     plaintext, so "the operator can read your messages" stops being true.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS PROTOTYPE DOES NOT DO — read before shipping:
 *
 *   1. NO FORWARD SECRECY. Keys are long-lived. Signal ratchets per message so
 *      that compromising a key doesn't expose history; this does not. That is
 *      the single biggest gap between this and a real secure messenger.
 *   2. TRUST ON FIRST USE, NOT VERIFICATION. Public keys are trusted the first
 *      time they're seen, and the server hands them out — so whoever controls
 *      Firestore can serve a key they hold on first contact and read
 *      everything (a classic MITM). e2eeKeys.ts's fetchPeerPublicKeyChecked
 *      does detect a key *changing* after that first trust and surfaces a
 *      warning (see the in-chat banner in ChatScreen.tsx) — that catches a
 *      substitution happening to an established conversation, and a genuine
 *      device change looks identical to it. It does not, and cannot, catch a
 *      substitution made before either side ever exchanged a message. Closing
 *      that gap needs the out-of-band verification ceremony
 *      (computeSafetyNumber below already provides the number; nothing forces
 *      a user to actually compare it).
 *   3. SINGLE DEVICE PER USER. A second device generates a new keypair and
 *      overwrites the published one, breaking decryption on the first.
 *   4. NO BACKFILL. Existing plaintext messages stay plaintext.
 *   5. METADATA IS STILL VISIBLE. Who talks to whom, when, and how often is
 *      all readable server-side, as are the `lastMessage` chat previews and
 *      push notification bodies. Media file name/type/size stay visible too —
 *      only the access pointer (image/video/audio/file.uri) is sealed, not
 *      those fields. GIFs, gestures, lottery, and shared-list content are not
 *      sealed at all: GIFs are public third-party content with nothing to
 *      protect, and the others live in their own subcollections regardless of
 *      what the message preview text says.
 *
 * It is a working demonstration of the shape, not a security guarantee.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {x25519} from '@noble/curves/ed25519.js';
import {hkdf} from '@noble/hashes/hkdf.js';
import {sha256} from '@noble/hashes/sha2.js';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  decryptWithKey,
  encryptWithKey,
  secureRandomBytes,
  utf8ToBytes,
} from './crypto';

export const E2EE_ALG = 'x25519-xchacha20poly1305-v1';

export type EncryptedPayload = {
  alg: typeof E2EE_ALG;
  /** nonce‖ciphertext, base64 */
  body: string;
  /** Sender's public key, base64. */
  senderKey: string;
  /**
   * Recipient's public key, base64.
   *
   * Both are recorded because the reader must derive from *the other party's*
   * key. Carrying only `senderKey` would leave the sender unable to read their
   * own sent messages: they would compute X25519(mySecret, myPublic), which is
   * not the pair's shared secret. Both keys are public, so publishing them
   * alongside the ciphertext costs nothing.
   */
  recipientKey: string;
};

export type Keypair = {secretKey: Uint8Array; publicKey: Uint8Array};

export function generateKeypair(): Keypair {
  // noble v2 renamed randomPrivateKey → randomSecretKey; support both so a
  // dependency bump in either direction doesn't silently break key generation.
  const utils = x25519.utils as {
    randomSecretKey?: () => Uint8Array;
    randomPrivateKey?: () => Uint8Array;
  };
  const secretKey = utils.randomSecretKey
    ? utils.randomSecretKey()
    : utils.randomPrivateKey
      ? utils.randomPrivateKey()
      : secureRandomBytes(32);
  return {secretKey, publicKey: x25519.getPublicKey(secretKey)};
}

/**
 * Derives the symmetric message key.
 *
 * The raw X25519 output is not used directly as a cipher key — it is not
 * uniformly distributed. HKDF fixes that. `chatId` goes in as the salt so the
 * same pair of users get distinct keys in different conversations, and a
 * fixed `info` string domain-separates this from any future use of the same
 * shared secret.
 */
function deriveMessageKey(
  secretKey: Uint8Array,
  peerPublicKey: Uint8Array,
  chatId: string,
): Uint8Array {
  const shared = x25519.getSharedSecret(secretKey, peerPublicKey);
  return hkdf(sha256, shared, utf8ToBytes(chatId), utf8ToBytes(E2EE_ALG), 32);
}

export function encryptMessage(
  plaintext: string,
  senderSecretKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  chatId: string,
): EncryptedPayload {
  const key = deriveMessageKey(senderSecretKey, recipientPublicKey, chatId);
  return {
    alg: E2EE_ALG,
    body: encryptWithKey(plaintext, key),
    senderKey: bytesToBase64(x25519.getPublicKey(senderSecretKey)),
    recipientKey: bytesToBase64(recipientPublicKey),
  };
}

/**
 * Decrypts a payload addressed to, or sent by, the holder of `mySecretKey`.
 *
 * X25519 is symmetric: X25519(a, B) == X25519(b, A). So both parties can
 * derive the same key — provided each derives against *the other's* public
 * key, which is why the envelope records both and this picks the one that
 * isn't mine.
 */
export function decryptMessage(
  payload: EncryptedPayload,
  mySecretKey: Uint8Array,
  chatId: string,
): string {
  if (payload.alg !== E2EE_ALG) {
    throw new Error(`unsupported e2ee algorithm: ${payload.alg}`);
  }
  const myPublicKey = bytesToBase64(x25519.getPublicKey(mySecretKey));
  const peerKey = payload.senderKey === myPublicKey ? payload.recipientKey : payload.senderKey;
  if (!peerKey) {
    throw new Error('payload is missing the counterparty public key');
  }
  const key = deriveMessageKey(mySecretKey, base64ToBytes(peerKey), chatId);
  return decryptWithKey(payload.body, key);
}

/**
 * A human-comparable fingerprint of a key pair, for out-of-band verification
 * ("read this number to your contact / compare screens in person").
 *
 * Both participants must get the *same* number from their own device, so the
 * two public keys are sorted canonically before hashing — otherwise "my key
 * then theirs" and "their key then mine" would hash to different values.
 *
 * This is the actual point of safety-number verification: it depends on the
 * real key material, so if a compromised server substituted either party's
 * public key (the MITM this prototype cannot otherwise prevent — see the
 * module doc above), the two sides' numbers would visibly disagree. A prior
 * version of this feature hashed the two users' UIDs instead, which are
 * public and unrelated to the actual encryption keys — it displayed a
 * "verification code" that could never detect a substituted key, because it
 * didn't depend on the keys at all.
 */
export function computeSafetyNumber(myPublicKey: Uint8Array, peerPublicKey: Uint8Array): string {
  const [a, b] = [bytesToHex(myPublicKey), bytesToHex(peerPublicKey)].sort();
  const digest = sha256(utf8ToBytes(a + b));
  const groups: string[] = [];
  for (let i = 0; i < 5; i++) {
    const chunk = digest.slice(i * 4, i * 4 + 4);
    const n = ((chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]) >>> 0;
    groups.push(String(n % 100000).padStart(5, '0'));
  }
  return groups.join(' ');
}

/** True if a stored message looks like an E2EE envelope rather than plaintext. */
export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<EncryptedPayload>;
  return (
    p.alg === E2EE_ALG &&
    typeof p.body === 'string' &&
    typeof p.senderKey === 'string' &&
    typeof p.recipientKey === 'string'
  );
}
