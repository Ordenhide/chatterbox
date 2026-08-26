/**
 * End-to-end encryption for message bodies and chat artifacts — PROTOTYPE.
 *
 * Design (deliberately the simplest thing that is actually end-to-end):
 *
 *   - Each device generates an X25519 keypair on first use. The secret key is
 *     written to the MMKV store (itself encrypted at rest with a CSPRNG key,
 *     which is held in an *unencrypted* bootstrap store — see storageMMKV.ts;
 *     moving it into the Keychain/Keystore is tracked separately);
 *     the public key is published on the user's profile doc.
 *   - To send, the sender does X25519(theirSecret, recipientPublic) to get a
 *     shared secret, runs it through HKDF-SHA256 with a per-conversation salt,
 *     and seals the body with XChaCha20-Poly1305.
 *   - Sealing here is always fan-out (sealForRecipients): one independently
 *     decryptable copy per recipient, so a 1:1 chat is just the
 *     single-recipient case and there is no separate group path *in this
 *     module*. The forward-secret paths added since do have separate 1:1 and
 *     group implementations, and neither goes through here — see
 *     services/ratchetMessages.ts and services/groupRatchetMessages.ts.
 *   - The server stores only {alg, nonce, ciphertext}. Firestore never sees the
 *     plaintext, so "the operator can read your messages" stops being true.
 *   - The same primitives cover chat artifacts — playlists, shared lists,
 *     countdowns — via e2eeArtifacts.ts, rather than a second crypto path,
 *     and still cover media access pointers (encryptedImage and friends) for
 *     recipients too old to decrypt attachment bytes. Where all recipients
 *     can, the object itself is encrypted instead and its key travels inside
 *     the body — see services/mediaCrypto.ts; those messages carry no
 *     encryptedImage at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS PROTOTYPE DOES NOT DO — read before shipping:
 *
 *   1. NO FORWARD SECRECY *ON THIS PATH*. Everything sealed by this module uses
 *      a long-lived key, so compromising it exposes every message it ever
 *      protected. That is still true here and always will be — but it is no
 *      longer true of the app as a whole: 1:1 messages between two upgraded
 *      clients go through services/ratchetMessages.ts instead, which ratchets
 *      per message, and group messages go through
 *      services/groupRatchetMessages.ts, which ratchets a per-sender chain.
 *      What still lands here is any chat where some member has not published
 *      a prekey bundle, plus chat artifacts and the media pointers sent to
 *      recipients on older clients. Attachments to *upgraded* recipients
 *      carry their content key inside the body, so they take whichever
 *      forward-secret path the body takes. Read messageProtection()
 *      in e2eeMessages.ts for which path a given message actually took —
 *      guessing from the presence of encryption is exactly the mistake this
 *      distinction exists to prevent.
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
 *
 *      Worth being precise about who can exploit this, because it was
 *      understated here until a profile-email spoof was found: the attacker
 *      does not need to control the server. Contact discovery searches on a
 *      profile field, so anyone who can make a victim start a conversation
 *      with *them* — rather than substituting a key mid-conversation — lands
 *      in the same place, and first contact is never flagged. The rules now
 *      pin the email and uid on a profile to the auth token
 *      (firestore.rules, identityFieldsHonest), which closes that particular
 *      route in; it does not make first contact verified, and nothing here
 *      does.
 *   3. SINGLE DEVICE PER USER. A second device generates a new keypair and
 *      overwrites the published one, breaking decryption on the first.
 *   4. NO BACKFILL. Existing plaintext messages stay plaintext.
 *   5. METADATA IS STILL VISIBLE. Who talks to whom, when, and how often is
 *      all readable server-side. For an attachment the *bytes* are encrypted
 *      (services/mediaCrypto.ts) but its declared name, type and size are
 *      stored in the message document in the clear, as is the fact that a
 *      message has one at all; the ciphertext's length also bounds the
 *      original's. Only the upload's object name is randomised, so the
 *      filename does not additionally leak to anyone listing the bucket.
 *      GIFs, gestures and lottery content are not sealed: GIFs are public
 *      third-party content with nothing to protect, and the others carry no
 *      text of their own.
 *
 * Keep this list honest. Everything above is checked against the code as of
 * the last edit, because a caveat that has quietly become false is worse than
 * no caveat — it is read as a live warning and reasoned from. Two entries here
 * had gone stale exactly that way and were removed: `lastMessage` previews
 * (firebaseChat.ts stores "🔒 Encrypted message" for a sealed message, not the
 * body) and push notification bodies (functions/index.js notifyNewMessage
 * sends data-only with a generic APNs line, precisely so there is no plaintext
 * to leak; Android reconstructs the text on-device). A third claimed shared
 * lists were unsealed, which e2eeArtifacts.ts has since made untrue.
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
 * Derived message keys, keyed by the secret they came from and then by
 * peer+chat.
 *
 * The derivation is a pure function of (secretKey, peerPublicKey, chatId), and
 * every message in a conversation shares all three — so opening a 50-message
 * chat ran the same X25519 scalar multiplication 50 times over. That is the
 * dominant cost of reading a thread: measured against @noble's pure-JS curve
 * code, the derivation is ~20x the XChaCha20-Poly1305 decryption it feeds, and
 * Hermes has no JIT to soften it.
 *
 * Caching costs no confidentiality. A derived key is recomputable from
 * `secretKey`, which the caller already holds in memory for as long as this
 * entry lives; keying the outer map weakly means both become collectable
 * together. It is deliberately not persisted — that would be a different
 * claim entirely.
 *
 * Mirrors `publicKeyCache` below, which already does this for the other X25519
 * call on this same path.
 */
const messageKeyCache = new WeakMap<Uint8Array, Map<string, Uint8Array>>();

/**
 * Per-secret cap. One conversation contributes one entry, so this is generous
 * for any real account; the bound exists so that a client which somehow cycles
 * through peers cannot grow the map without limit. Oldest-first eviction,
 * matching the skipped-key store in ratchet/doubleRatchet.ts.
 */
const MAX_CACHED_MESSAGE_KEYS = 256;

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
  let perSecret = messageKeyCache.get(secretKey);
  if (!perSecret) {
    perSecret = new Map();
    messageKeyCache.set(secretKey, perSecret);
  }
  // chatId is caller-supplied and could itself contain the separator; the peer
  // key is fixed-length base64, so putting it first keeps the pair unambiguous.
  const cacheKey = `${bytesToBase64(peerPublicKey)}|${chatId}`;
  const hit = perSecret.get(cacheKey);
  if (hit) return hit;

  const shared = x25519.getSharedSecret(secretKey, peerPublicKey);
  const derived = hkdf(sha256, shared, utf8ToBytes(chatId), utf8ToBytes(E2EE_ALG), 32);

  perSecret.set(cacheKey, derived);
  while (perSecret.size > MAX_CACHED_MESSAGE_KEYS) {
    const oldest = perSecret.keys().next();
    if (oldest.done) break;
    perSecret.delete(oldest.value);
  }
  return derived;
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
    senderKey: myPublicKeyFor(senderSecretKey),
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
/**
 * `x25519.getPublicKey(secretKey)` by reference to the secret key it was
 * derived from.
 *
 * Every decrypt call was doing this scalar multiplication from scratch just
 * to answer "is the sender or the recipient field mine?" — a question with
 * the same answer for as long as the device keypair does not change.
 * e2eeKeys.ts already memoizes that keypair in-process (see `cached` there),
 * so every decrypt in a session, and every message in a batch, was passing
 * the *same* secretKey reference and redoing this anyway: one full EC scalar
 * multiplication per message purely to re-derive a value already known,
 * roughly doubling the real cryptographic cost (the actual ECDH in
 * deriveMessageKey below is the other, unavoidable one). Opening a chat with
 * many newly-arrived sealed messages decrypts the whole batch synchronously
 * in one JS-thread tick (see the decrypt loop in ChatScreen.tsx) — this is
 * why that could visibly stall, and only for chats with enough undecrypted
 * messages to make the redundancy add up.
 *
 * A WeakMap keyed on the secretKey object needs no call-site changes: every
 * caller already reuses the same in-memory keypair, so the identity check a
 * WeakMap does for free is exactly the reuse that already happens. It also
 * releases itself — nothing pins a Uint8Array here past the keypair's own
 * lifetime, which matters for a key material cache.
 */
const publicKeyCache = new WeakMap<Uint8Array, string>();

function myPublicKeyFor(secretKey: Uint8Array): string {
  const cached = publicKeyCache.get(secretKey);
  if (cached) return cached;
  const derived = bytesToBase64(x25519.getPublicKey(secretKey));
  publicKeyCache.set(secretKey, derived);
  return derived;
}

export function decryptMessage(
  payload: EncryptedPayload,
  mySecretKey: Uint8Array,
  chatId: string,
): string {
  if (payload.alg !== E2EE_ALG) {
    throw new Error(`unsupported e2ee algorithm: ${payload.alg}`);
  }
  const myPublicKey = myPublicKeyFor(mySecretKey);
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
 * without changing the format. See sealForRecipients for why fan-out was
 * chosen over sender keys.
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
 * other as an empty message.
 */
/**
 * True for any shape whose body is encrypted — including the forward-secret
 * ratchet envelope, which `openSealed` deliberately cannot open.
 *
 * That split is the point. Callers use isSealed to decide "is `text` empty
 * because the body lives elsewhere?", and a ratchet message answers yes: if it
 * were excluded, the UI would fall through to rendering the (blank) plaintext
 * field and show an empty bubble. Opening it needs stored session state and is
 * asynchronous, so it is routed through services/ratchetMessages.ts instead —
 * hence `isRatchetSealed`, so callers can tell which opener to use.
 */
export function isSealed(value: unknown): value is EncryptedPayload | SealedEnvelope {
  return (
    isSealedEnvelope(value) ||
    isEncryptedPayload(value) ||
    isRatchetSealed(value) ||
    isGroupSealed(value)
  );
}

/**
 * True for a forward-secret *group* envelope (sender keys).
 *
 * Same reasoning as isRatchetSealed, and the same routing consequence: it is
 * opened from stored chain state, asynchronously, by
 * services/groupRatchetMessages.ts — not from a key pair.
 */
export function isGroupSealed(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const e = value as {alg?: unknown; from?: unknown; message?: unknown};
  return (
    e.alg === 'chatterbox-group-envelope-v1' &&
    typeof e.from === 'string' &&
    !!e.message &&
    typeof e.message === 'object'
  );
}

/**
 * True for a forward-secret envelope. Kept here, rather than imported from
 * ratchetMessages, so this module stays free of that dependency: e2ee.ts is
 * imported by nearly everything, and ratchetMessages imports Firestore.
 */
export function isRatchetSealed(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const e = value as {alg?: unknown; from?: unknown; message?: unknown};
  return (
    e.alg === 'chatterbox-ratchet-envelope-v1' &&
    typeof e.from === 'string' &&
    !!e.message &&
    typeof e.message === 'object'
  );
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
  // A ratchet envelope is sealed but not openable from a key pair alone — it
  // needs stored session state and an await. Named explicitly so this reads as
  // a routing error rather than a corrupt payload.
  if (isRatchetSealed(value)) {
    throw new Error('ratchet envelope: open with services/ratchetMessages.ts, not openSealed');
  }
  if (isGroupSealed(value)) {
    throw new Error('group envelope: open with services/groupRatchetMessages.ts, not openSealed');
  }
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
 * module doc above), the two sides' numbers would visibly disagree. A prior
 * version of this feature hashed the two users' UIDs instead, which are
 * public and unrelated to the actual encryption keys — it displayed a
 * "verification code" that could never detect a substituted key, because it
 * didn't depend on the keys at all.
 */
/**
 * The keys a safety number covers for one party.
 *
 * Two, because there are now two independent identities: the long-lived X25519
 * key this module seals with, and the Ed25519 ratchet identity that
 * authenticates the forward-secret path (services/ratchet/x3dh.ts). Verifying
 * only the first would leave the newer path — the one users are told to trust
 * more — covered by nothing.
 */
export type VerificationKeys = {
  /** X25519 message-encryption key. Present for any enrolled device. */
  encryptionKey: Uint8Array;
  /** Ed25519 ratchet identity, absent on clients that do not implement it. */
  ratchetIdentity?: Uint8Array;
};

/**
 * A number both parties can compare out of band to detect a substituted key.
 *
 * The ratchet identities are folded in only when *both* sides have one. That
 * condition is not a convenience: if one side included a key the other could
 * not see, the two devices would compute different numbers and every
 * comparison would fail, teaching users that a mismatch is normal — which is
 * the one lesson that would make the whole ceremony worthless. Both sides can
 * evaluate the condition identically, because both hold both parties' keys.
 *
 * A consequence worth stating: when a peer upgrades and publishes a ratchet
 * identity, the number changes. That is correct — there is genuinely new key
 * material to verify — and the UI says so rather than leaving the user to
 * conclude they have been attacked.
 */
export function computeSafetyNumber(mine: VerificationKeys, theirs: VerificationKeys): string {
  const both = !!mine.ratchetIdentity && !!theirs.ratchetIdentity;
  const encode = (k: VerificationKeys) =>
    both ? `${bytesToHex(k.encryptionKey)}:${bytesToHex(k.ratchetIdentity!)}` : bytesToHex(k.encryptionKey);

  const [a, b] = [encode(mine), encode(theirs)].sort();
  const digest = sha256(utf8ToBytes(a + b));
  const groups: string[] = [];
  for (let i = 0; i < 5; i++) {
    const chunk = digest.slice(i * 4, i * 4 + 4);
    const n = ((chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]) >>> 0;
    groups.push(String(n % 100000).padStart(5, '0'));
  }
  return groups.join(' ');
}

export type SealedFailure =
  /**
   * Sealed to a public key this device does not hold the secret half of —
   * another device of the same account, or this device before a reinstall.
   * Recoverable: importing the recovery phrase for that key fixes it.
   */
  | 'wrong-key'
  /**
   * This device's key *is* one of the two the payload was sealed between, so
   * the key is right and the ciphertext is what's wrong — truncated, tampered
   * with, or corrupted in storage. Not recoverable by the user.
   */
  | 'corrupt'
  /** Sealed by a newer client than this one. Recoverable by updating. */
  | 'unsupported-algorithm'
  | 'not-sealed';

/**
 * Why `openSealed` failed — the difference between "you need your recovery
 * phrase" and "this message is damaged".
 *
 * Worth distinguishing because only one of them is the user's to fix, and
 * because they are the same event from the outside: an exception out of
 * XChaCha20-Poly1305's authentication tag, which rejects a wrong key and a
 * corrupted ciphertext identically. What separates them is not the failure but
 * the *addressing*: every payload records both public keys it was sealed
 * between (see EncryptedPayload), so if this device's public key is one of them
 * the key was right and the body is at fault, and if it is neither the message
 * was never addressed to this key at all.
 *
 * This is the single-device caveat (#3 in the module doc) finally becoming
 * legible rather than silent. It does not fix multi-device — that needs a
 * per-device key list — but it does stop the failure being indistinguishable
 * from data loss.
 *
 * Takes the *public* key: diagnosis needs no secret, and passing one here would
 * mean handing a secret to a function that has no business holding it.
 */
export function diagnoseSealed(
  value: unknown,
  myPublicKey: Uint8Array,
  myUid: string,
): SealedFailure {
  const mine = bytesToBase64(myPublicKey);
  const addressedToMe = (p: EncryptedPayload) =>
    p.senderKey === mine || p.recipientKey === mine;

  // Shape is tested without regard to `alg`, unlike isSealed/isSealedEnvelope,
  // which both require the exact algorithm string. Those are right to: a reader
  // must not try to open something it doesn't understand. But refusing to
  // *recognise* it would collapse "sealed by a newer client" into 'not-sealed',
  // which is the one answer guaranteed to be wrong here.
  const payloadShaped = (v: unknown): v is EncryptedPayload => {
    if (!v || typeof v !== 'object') return false;
    const p = v as Partial<EncryptedPayload>;
    return (
      typeof p.alg === 'string' &&
      typeof p.body === 'string' &&
      typeof p.senderKey === 'string' &&
      typeof p.recipientKey === 'string'
    );
  };

  if (value && typeof value === 'object') {
    const e = value as Partial<SealedEnvelope>;
    if (typeof e.alg === 'string' && e.copies && typeof e.copies === 'object') {
      const copies = Object.values(e.copies);
      if (copies.length > 0 && copies.every(payloadShaped)) {
        if (e.alg !== E2EE_ALG) return 'unsupported-algorithm';
        // The copy addressed to this reader is authoritative when it exists.
        // Falling through to "any copy" would misreport a genuinely corrupt
        // copy of mine as wrong-key just because some *other* member's copy —
        // which I could never open anyway — doesn't name my key.
        const ownCopy = e.copies[myUid];
        if (ownCopy) return addressedToMe(ownCopy) ? 'corrupt' : 'wrong-key';
        // No copy for my uid: either I'm the sender (every copy names my key
        // as senderKey) or I was never a recipient at all.
        return copies.some(addressedToMe) ? 'corrupt' : 'wrong-key';
      }
    }
  }

  if (payloadShaped(value)) {
    if (value.alg !== E2EE_ALG) return 'unsupported-algorithm';
    return addressedToMe(value) ? 'corrupt' : 'wrong-key';
  }

  return 'not-sealed';
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
