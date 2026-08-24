/**
 * End-to-end encryption for 1:1 text messages — PROTOTYPE.
 *
 * Verbatim port of the mobile app's src/services/e2ee.ts: this file has no
 * platform dependencies (pure @noble/* math over the crypto.ts primitives), so
 * it is copied rather than reimplemented to guarantee mobile and web derive
 * identical ciphertext from identical inputs. Keep the two in sync — device key
 * *storage* differs by platform (MMKV vs localStorage) and lives in
 * e2eeKeys.ts, not here.
 *
 * Design (deliberately the simplest thing that is actually end-to-end):
 *
 *   - Each device generates an X25519 keypair on first use. The secret key
 *     never leaves the device (see e2eeKeys.ts for where it's stored); the
 *     public key is published on the user's profile doc.
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
 *      warning (see the in-chat banner in ChatScreen.tsx on mobile / ChatPane.tsx
 *      on web) — that catches a substitution happening to an established
 *      conversation, and a genuine device change looks identical to it. It does
 *      not, and cannot, catch a substitution made before either side ever
 *      exchanged a message. Closing that gap needs the out-of-band verification
 *      ceremony (computeSafetyNumber below already provides the number; nothing
 *      forces a user to actually compare it).
 *   3. ONE KEYPAIR PER ACCOUNT, NOT PER DEVICE. Signing in on a new device —
 *      including web, which is just another device under this model — generates
 *      a new keypair and overwrites the one published for this account,
 *      stranding anything encrypted to the old key and surfacing a `changed`
 *      warning to every contact who had already trusted it. Real multi-device
 *      support needs a per-device key list (fan-out encryption) or a secure
 *      device-linking ceremony (QR-code key transfer, à la WhatsApp Web); both
 *      are out of scope for this prototype.
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
 * The largest group this seals for.
 *
 * A product cap, not a technical ceiling: each member adds one more ciphertext
 * copy (~2.7KB for a 2,000-character message), so 32 members is roughly 8% of
 * Firestore's 1MB document limit — comfortable, with room to raise it later
 * without changing the format.
 *
 * Must stay identical to MAX_GROUP_MEMBERS in the mobile app's e2ee.ts: the two
 * clients seal into the same Firestore documents, so a client with a higher cap
 * would produce envelopes the other refuses to send but must still be able to read.
 */
export const MAX_GROUP_MEMBERS = 32;

export type EnvelopeRecipient = {uid: string; publicKey: Uint8Array};

export type SealedEnvelope = {
  alg: typeof E2EE_ALG;
  /**
   * One independently-decryptable copy per recipient uid.
   *
   * Each entry is a complete EncryptedPayload, so it opens with the same
   * `decryptMessage` a 1:1 message uses — group support adds a distribution
   * layer, not a second cipher.
   */
  copies: Record<string, EncryptedPayload>;
};

/**
 * Seals `plaintext` once per recipient — the group encryption model.
 *
 * Chosen over sender keys deliberately. Sender keys encrypt once regardless of
 * group size, but removing a member then requires every remaining member to
 * rotate and redistribute their sending key; miss any step — including a client
 * that was offline — and the removed member keeps decrypting new messages with
 * the key they still hold, with nothing surfaced to anyone. Fan-out has no such
 * step: removal means the sender stops including that member's copy, so there
 * is no key to rotate and no silent-failure window. The cost is linear payload
 * growth, which MAX_GROUP_MEMBERS keeps bounded.
 *
 * The sender is not included in `recipients` and does not need to be: X25519 is
 * symmetric, so they can open any copy by deriving against that copy's
 * `recipientKey` — which is exactly what decryptMessage already does when it
 * recognises the sender key as its own.
 */
export function sealForRecipients(
  plaintext: string,
  senderSecretKey: Uint8Array,
  recipients: EnvelopeRecipient[],
  chatId: string,
): SealedEnvelope {
  if (recipients.length === 0) {
    throw new Error('sealForRecipients: no recipients');
  }
  if (recipients.length > MAX_GROUP_MEMBERS) {
    throw new Error(
      `sealForRecipients: ${recipients.length} recipients exceeds the ${MAX_GROUP_MEMBERS} cap`,
    );
  }
  const copies: Record<string, EncryptedPayload> = {};
  for (const {uid, publicKey} of recipients) {
    copies[uid] = encryptMessage(plaintext, senderSecretKey, publicKey, chatId);
  }
  return {alg: E2EE_ALG, copies};
}

/**
 * Opens the copy addressed to `myUid`, or — when this reader is the sender,
 * who has no copy of their own — any copy at all.
 *
 * That fallback is safe rather than permissive: a reader who is neither the
 * sender nor an addressed recipient derives the wrong key for every copy, and
 * XChaCha20-Poly1305's authentication tag rejects each one. Being able to open
 * a copy *is* the authorisation check; there is no separate one to bypass.
 */
export function openEnvelope(
  envelope: SealedEnvelope,
  mySecretKey: Uint8Array,
  myUid: string,
  chatId: string,
): string {
  if (envelope.alg !== E2EE_ALG) {
    throw new Error(`unsupported e2ee algorithm: ${envelope.alg}`);
  }
  const mine = envelope.copies[myUid];
  if (mine) return decryptMessage(mine, mySecretKey, chatId);

  for (const copy of Object.values(envelope.copies)) {
    try {
      return decryptMessage(copy, mySecretKey, chatId);
    } catch {
      // Not addressed to us and not ours to read — try the next.
    }
  }
  throw new Error('no readable copy in envelope');
}

/**
 * True if a stored value is sealed at all, in either shape.
 *
 * Readers should reach for this rather than isEncryptedPayload: both shapes are
 * in the wild permanently (fan-out envelopes since group support, bare payloads
 * from before it), and a reader that only recognises one silently renders the
 * other as an empty message. That failure is cross-platform — a mobile client
 * sealing envelopes would go blank in a browser still checking only the old shape.
 */
export function isSealed(value: unknown): value is EncryptedPayload | SealedEnvelope {
  return isSealedEnvelope(value) || isEncryptedPayload(value);
}

/**
 * Opens either shape — the reader half of isSealed.
 *
 * `myUid` is only consulted for envelopes, to pick this reader's copy; single
 * payloads carry both public keys and need no uid at all.
 */
export function openSealed(
  value: unknown,
  mySecretKey: Uint8Array,
  myUid: string,
  chatId: string,
): string {
  if (isSealedEnvelope(value)) return openEnvelope(value, mySecretKey, myUid, chatId);
  if (isEncryptedPayload(value)) return decryptMessage(value, mySecretKey, chatId);
  throw new Error('value is not sealed');
}

/** True if a stored value is a fan-out envelope rather than a single payload. */
export function isSealedEnvelope(value: unknown): value is SealedEnvelope {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<SealedEnvelope>;
  if (e.alg !== E2EE_ALG || !e.copies || typeof e.copies !== 'object') return false;
  return Object.values(e.copies).every(isEncryptedPayload);
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
 * module doc above), the two sides' numbers would visibly disagree.
 */
/**
 * Deliberately still takes bare encryption keys, unlike the mobile version.
 *
 * Mobile now folds an Ed25519 ratchet identity into the number as well — but
 * only when *both* parties have one. This client does not implement the
 * ratchet and retracts any published bundle when it enrolls (see
 * publishPublicKey in e2eeKeys.ts), so a pair involving this client never
 * satisfies that condition and mobile falls back to exactly the computation
 * below. The two clients therefore agree without this file changing.
 *
 * That agreement is load-bearing and invisible from here, so it is pinned by a
 * shared test vector present in both test suites. If you change this
 * computation, that vector fails on this side and mobile's fails on the other
 * — which is the intended way to find out.
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
