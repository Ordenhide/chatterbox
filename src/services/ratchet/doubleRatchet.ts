/**
 * The Double Ratchet — forward secrecy and post-compromise security for 1:1
 * messages. Faithful to the Signal specification; the variable names below
 * deliberately track the spec's (RK, CKs, CKr, Ns, Nr, PN, DHs, DHr) so the
 * two can be read side by side.
 *
 * ## What this buys, stated precisely
 *
 * Today `deriveMessageKey` does a static X25519 between two long-lived
 * identity keys, so every message in a conversation is encrypted under the
 * *same* key forever. Compromising a device key therefore decrypts the entire
 * history, including ciphertext already sitting on the server. That is the one
 * property no amount of key-storage hardening can fix — the Keychain migration
 * raises the cost of stealing the key, this changes what stealing it is worth.
 *
 * Two distinct properties come out of the two ratchets:
 *
 *   - **Forward secrecy** (symmetric ratchet): each message key is derived
 *     from a chain key and the chain key is immediately replaced by its own
 *     successor. The KDF is one-way, so an attacker holding the current chain
 *     key cannot walk backwards to any earlier message key.
 *   - **Post-compromise security** (DH ratchet): each time the conversation
 *     turns around, both sides mix a *fresh* DH output into the root key. An
 *     attacker who stole the entire session state is locked out again after
 *     one full round trip, provided they stay passive.
 *
 * Neither property helps against an attacker who keeps reading the device.
 *
 * ## Why the state is plain data and the operations are pure
 *
 * Every function here takes a session and returns a *new* session rather than
 * mutating one. That is not a style preference: ratchet state is the one thing
 * in this codebase where a partial update is unrecoverable. If a decrypt
 * advanced the receiving chain and then threw — bad ciphertext, a truncated
 * body, a bug — a mutating implementation would leave the chain advanced past
 * a message it never delivered, and every subsequent message would fail to
 * decrypt with no way back. Returning a new session means a throw leaves the
 * caller's session exactly as it was.
 *
 * The state is also deliberately serializable (see serializeSession), because
 * it has to survive an app restart. A session that only lives in memory would
 * silently reset the ratchet on every cold start.
 */
import {x25519} from '@noble/curves/ed25519.js';
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {hkdf} from '@noble/hashes/hkdf.js';
import {hmac} from '@noble/hashes/hmac.js';
import {sha256} from '@noble/hashes/sha2.js';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  secureRandomBytes,
  utf8ToBytes,
} from '../crypto';

export const RATCHET_ALG = 'chatterbox-double-ratchet-v1';

const KEY_BYTES = 32;
const NONCE_BYTES = 24;

/**
 * How far ahead of the expected message number a single message may jump.
 *
 * Messages legitimately arrive out of order, so the receiver derives and
 * stores the keys it skipped over. Without a bound, one forged header
 * claiming n = 2^31 would ask us to run the KDF two billion times — a trivial
 * remote denial of service against the recipient's device. 1000 is far beyond
 * any real reordering or offline backlog within a single chain.
 */
export const MAX_SKIP = 1000;

/**
 * Total skipped keys retained across all chains.
 *
 * Each one is a message that may still arrive, so they cannot be dropped
 * eagerly — but they also cannot accumulate forever, because a peer who never
 * delivers them would grow this without limit. Oldest-first eviction: the
 * longer a message has been missing, the less likely it is still coming.
 */
export const MAX_SKIPPED_KEYS = 2000;

export type Keypair = {secretKey: Uint8Array; publicKey: Uint8Array};

/** Travels with the ciphertext, in the clear, and is authenticated as AAD. */
export type RatchetHeader = {
  /** Sender's current ratchet public key, base64. */
  dh: string;
  /** Number of messages in the sender's *previous* sending chain. */
  pn: number;
  /** This message's number within the sender's current sending chain. */
  n: number;
};

export type RatchetMessage = {
  alg: typeof RATCHET_ALG;
  header: RatchetHeader;
  /** nonce‖ciphertext, base64. */
  body: string;
};

export type RatchetSession = {
  /** Our current ratchet keypair. */
  dhs: Keypair;
  /** Their current ratchet public key; null until we have heard from them. */
  dhr: Uint8Array | null;
  /** Root key — the input to every DH ratchet step. */
  rk: Uint8Array;
  /** Sending chain key; null for a responder who has not yet replied. */
  cks: Uint8Array | null;
  /** Receiving chain key; null for an initiator who has not yet heard back. */
  ckr: Uint8Array | null;
  /** Messages sent in the current sending chain. */
  ns: number;
  /** Messages received in the current receiving chain. */
  nr: number;
  /** Messages in the previous sending chain. */
  pn: number;
  /** Message keys derived but not yet used, keyed by `${dhBase64}:${n}`. */
  skipped: Map<string, Uint8Array>;

  // Bookkeeping for the messaging layer (services/ratchetMessages.ts), kept
  // on the session so it is stored atomically with it. Nothing in this file
  // reads them; encrypt and decrypt carry them through unchanged.

  /** Base64 X3DH ephemeral key of the handshake that created this session. */
  baseKey?: string;
  /** Base64 ratchet identity of the peer that handshake was with. */
  peerIdentity?: string;
  /** Initiator only: the encoded X3DH half, re-sent until the peer is heard from. */
  pendingInitial?: string;
};

// ---- primitives ------------------------------------------------------------

export function generateRatchetKeypair(): Keypair {
  // noble v2 renamed randomPrivateKey → randomSecretKey; accept either so a
  // dependency bump in either direction cannot silently break key generation.
  const utils = x25519.utils as {
    randomSecretKey?: () => Uint8Array;
    randomPrivateKey?: () => Uint8Array;
  };
  const secretKey = utils.randomSecretKey
    ? utils.randomSecretKey()
    : utils.randomPrivateKey
      ? utils.randomPrivateKey()
      : secureRandomBytes(KEY_BYTES);
  return {secretKey, publicKey: x25519.getPublicKey(secretKey)};
}

/**
 * Root KDF. Mixes a fresh DH output into the root key, yielding the next root
 * key and a fresh chain key. HKDF with the old root key as salt, so the new
 * root key depends on the entire history of the ratchet, not just this step.
 */
function kdfRoot(rk: Uint8Array, dhOut: Uint8Array): {rk: Uint8Array; ck: Uint8Array} {
  const out = hkdf(sha256, dhOut, rk, utf8ToBytes(`${RATCHET_ALG}:root`), 64);
  return {rk: out.slice(0, 32), ck: out.slice(32, 64)};
}

/**
 * Chain KDF. Two domain-separated HMACs off the same chain key: one becomes
 * the message key, the other the next chain key.
 *
 * This is where forward secrecy actually comes from. HMAC-SHA256 is one-way,
 * so holding ck(n+1) gives no route back to ck(n) or to mk(n) — the message
 * key for every earlier message in the chain is unrecoverable the moment the
 * chain advances past it.
 *
 * The two constants must differ, and that is not cosmetic: if the message key
 * and the next chain key were the same value, anyone learning a single message
 * key would hold the chain key for everything after it. Exported so that
 * property can be asserted directly — a test that only watches messages
 * encrypt and decrypt does not notice it, which was found by mutation testing
 * rather than by reading.
 */
export function kdfChain(ck: Uint8Array): {ck: Uint8Array; mk: Uint8Array} {
  return {
    mk: hmac(sha256, ck, Uint8Array.of(0x01)),
    ck: hmac(sha256, ck, Uint8Array.of(0x02)),
  };
}

/** Canonical header encoding — the exact bytes that get authenticated. */
function encodeHeader(header: RatchetHeader): Uint8Array {
  return utf8ToBytes(JSON.stringify([header.dh, header.pn, header.n]));
}

/**
 * The associated data for the AEAD: the caller's AD (identity keys, chat id)
 * followed by the header.
 *
 * Authenticating the header is what stops an attacker reordering or
 * re-attributing a message they cannot decrypt — flipping `n`, or swapping in
 * a different ratchet key, invalidates the Poly1305 tag rather than silently
 * steering the receiver's chain.
 */
function associatedData(ad: Uint8Array, header: RatchetHeader): Uint8Array {
  const h = encodeHeader(header);
  const out = new Uint8Array(ad.length + h.length);
  out.set(ad, 0);
  out.set(h, ad.length);
  return out;
}

function aeadEncrypt(mk: Uint8Array, plaintext: string, ad: Uint8Array): string {
  // Random nonce rather than one derived from the KDF. Message keys are
  // single-use, so either is safe; a random 192-bit XChaCha nonce needs no
  // argument about counter discipline to be convinced of.
  const nonce = secureRandomBytes(NONCE_BYTES);
  const ct = xchacha20poly1305(mk, nonce, ad).encrypt(utf8ToBytes(plaintext));
  const packed = new Uint8Array(nonce.length + ct.length);
  packed.set(nonce, 0);
  packed.set(ct, nonce.length);
  return bytesToBase64(packed);
}

function aeadDecrypt(mk: Uint8Array, packedBase64: string, ad: Uint8Array): string {
  const packed = base64ToBytes(packedBase64);
  if (packed.length < NONCE_BYTES + 16) throw new Error('ratchet: ciphertext too short');
  const nonce = packed.subarray(0, NONCE_BYTES);
  const ct = packed.subarray(NONCE_BYTES);
  return bytesToUtf8(xchacha20poly1305(mk, nonce, ad).decrypt(ct));
}

// ---- session setup ---------------------------------------------------------

/**
 * The side that speaks first.
 *
 * It already knows the responder's signed prekey (from the bundle X3DH
 * consumed), so it can build a sending chain immediately and encrypt without a
 * round trip. It has no receiving chain until the responder replies.
 */
export function initSessionAsInitiator(
  sharedSecret: Uint8Array,
  theirSignedPreKeyPublic: Uint8Array,
): RatchetSession {
  const dhs = generateRatchetKeypair();
  const {rk, ck} = kdfRoot(sharedSecret, x25519.getSharedSecret(dhs.secretKey, theirSignedPreKeyPublic));
  return {
    dhs,
    dhr: theirSignedPreKeyPublic,
    rk,
    cks: ck,
    ckr: null,
    ns: 0,
    nr: 0,
    pn: 0,
    skipped: new Map(),
  };
}

/**
 * The side that is spoken to.
 *
 * Its first ratchet keypair is the signed prekey the initiator already used,
 * which is why that key must be passed in rather than generated. It has no
 * chains at all until the first message arrives and triggers a DH ratchet.
 */
export function initSessionAsResponder(
  sharedSecret: Uint8Array,
  ourSignedPreKey: Keypair,
): RatchetSession {
  return {
    dhs: ourSignedPreKey,
    dhr: null,
    rk: sharedSecret,
    cks: null,
    ckr: null,
    ns: 0,
    nr: 0,
    pn: 0,
    skipped: new Map(),
  };
}

// ---- encrypt / decrypt -----------------------------------------------------

function cloneSession(s: RatchetSession): RatchetSession {
  return {...s, skipped: new Map(s.skipped)};
}

export function ratchetEncrypt(
  session: RatchetSession,
  plaintext: string,
  ad: Uint8Array = new Uint8Array(0),
): {session: RatchetSession; message: RatchetMessage} {
  if (!session.cks) {
    // A responder that has not yet received anything has no sending chain. In
    // practice the caller must not reach this — replying is what creates it.
    throw new Error('ratchet: no sending chain yet; receive a message first');
  }
  const next = cloneSession(session);
  const {ck, mk} = kdfChain(next.cks!);
  next.cks = ck;

  const header: RatchetHeader = {
    dh: bytesToBase64(next.dhs.publicKey),
    pn: next.pn,
    n: next.ns,
  };
  next.ns += 1;

  return {
    session: next,
    message: {alg: RATCHET_ALG, header, body: aeadEncrypt(mk, plaintext, associatedData(ad, header))},
  };
}

function skippedKeyId(dhBase64: string, n: number): string {
  return `${dhBase64}:${n}`;
}

/**
 * Derives and stores the message keys for everything between where the
 * receiving chain is now and `until`, so those messages remain decryptable if
 * they turn up later.
 */
function skipMessageKeys(session: RatchetSession, until: number): void {
  if (session.ckr === null) return;
  if (session.nr + MAX_SKIP < until) {
    throw new Error(`ratchet: refusing to skip more than ${MAX_SKIP} messages`);
  }
  const dhBase64 = session.dhr ? bytesToBase64(session.dhr) : '';
  while (session.nr < until) {
    const {ck, mk} = kdfChain(session.ckr);
    session.ckr = ck;
    session.skipped.set(skippedKeyId(dhBase64, session.nr), mk);
    session.nr += 1;
  }
  // Oldest-first eviction. Map preserves insertion order, so the first key is
  // the one that has been waiting longest.
  while (session.skipped.size > MAX_SKIPPED_KEYS) {
    const oldest = session.skipped.keys().next();
    if (oldest.done) break;
    session.skipped.delete(oldest.value);
  }
}

/** A turn in the conversation: mix a fresh DH into the root key, both ways. */
function dhRatchet(session: RatchetSession, header: RatchetHeader): void {
  session.pn = session.ns;
  session.ns = 0;
  session.nr = 0;
  session.dhr = base64ToBytes(header.dh);

  const recv = kdfRoot(session.rk, x25519.getSharedSecret(session.dhs.secretKey, session.dhr));
  session.rk = recv.rk;
  session.ckr = recv.ck;

  session.dhs = generateRatchetKeypair();
  const send = kdfRoot(session.rk, x25519.getSharedSecret(session.dhs.secretKey, session.dhr));
  session.rk = send.rk;
  session.cks = send.ck;
}

export function ratchetDecrypt(
  session: RatchetSession,
  message: RatchetMessage,
  ad: Uint8Array = new Uint8Array(0),
): {session: RatchetSession; plaintext: string} {
  const {header} = message;
  const fullAd = associatedData(ad, header);

  // A message we had already skipped past. Handled before anything else so a
  // late arrival never disturbs the live chains.
  const skippedId = skippedKeyId(header.dh, header.n);
  const skippedKey = session.skipped.get(skippedId);
  if (skippedKey) {
    const plaintext = aeadDecrypt(skippedKey, message.body, fullAd);
    const next = cloneSession(session);
    next.skipped.delete(skippedId);
    return {session: next, plaintext};
  }

  const next = cloneSession(session);
  const turned = next.dhr === null || bytesToBase64(next.dhr) !== header.dh;
  if (turned) {
    // Everything left unsent in their previous chain, before this new one.
    skipMessageKeys(next, header.pn);
    dhRatchet(next, header);
  }
  skipMessageKeys(next, header.n);

  if (!next.ckr) throw new Error('ratchet: no receiving chain');
  const {ck, mk} = kdfChain(next.ckr);

  // Decrypt BEFORE committing the advance: a forged or corrupt body throws
  // here, and because `next` is a copy the caller's session is untouched.
  const plaintext = aeadDecrypt(mk, message.body, fullAd);

  next.ckr = ck;
  next.nr += 1;
  return {session: next, plaintext};
}

// ---- persistence -----------------------------------------------------------

type SerializedSession = {
  v: 1;
  dhs: {secretKey: string; publicKey: string};
  dhr: string | null;
  rk: string;
  cks: string | null;
  ckr: string | null;
  ns: number;
  nr: number;
  pn: number;
  skipped: [string, string][];
  baseKey?: string;
  peerIdentity?: string;
  pendingInitial?: string;
};

export function serializeSession(session: RatchetSession): string {
  const out: SerializedSession = {
    v: 1,
    dhs: {
      secretKey: bytesToBase64(session.dhs.secretKey),
      publicKey: bytesToBase64(session.dhs.publicKey),
    },
    dhr: session.dhr ? bytesToBase64(session.dhr) : null,
    rk: bytesToBase64(session.rk),
    cks: session.cks ? bytesToBase64(session.cks) : null,
    ckr: session.ckr ? bytesToBase64(session.ckr) : null,
    ns: session.ns,
    nr: session.nr,
    pn: session.pn,
    skipped: [...session.skipped].map(([k, v]) => [k, bytesToBase64(v)]),
    ...(session.baseKey !== undefined ? {baseKey: session.baseKey} : null),
    ...(session.peerIdentity !== undefined ? {peerIdentity: session.peerIdentity} : null),
    ...(session.pendingInitial !== undefined ? {pendingInitial: session.pendingInitial} : null),
  };
  return JSON.stringify(out);
}

export function deserializeSession(json: string): RatchetSession {
  const raw = JSON.parse(json) as SerializedSession;
  if (raw.v !== 1) throw new Error(`ratchet: unknown session version ${raw.v}`);
  return {
    dhs: {
      secretKey: base64ToBytes(raw.dhs.secretKey),
      publicKey: base64ToBytes(raw.dhs.publicKey),
    },
    dhr: raw.dhr ? base64ToBytes(raw.dhr) : null,
    rk: base64ToBytes(raw.rk),
    cks: raw.cks ? base64ToBytes(raw.cks) : null,
    ckr: raw.ckr ? base64ToBytes(raw.ckr) : null,
    ns: raw.ns,
    nr: raw.nr,
    pn: raw.pn,
    skipped: new Map(raw.skipped.map(([k, v]) => [k, base64ToBytes(v)])),
    ...(typeof raw.baseKey === 'string' ? {baseKey: raw.baseKey} : null),
    ...(typeof raw.peerIdentity === 'string' ? {peerIdentity: raw.peerIdentity} : null),
    ...(typeof raw.pendingInitial === 'string' ? {pendingInitial: raw.pendingInitial} : null),
  };
}

export function isRatchetMessage(value: unknown): value is RatchetMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<RatchetMessage>;
  return (
    m.alg === RATCHET_ALG &&
    typeof m.body === 'string' &&
    !!m.header &&
    typeof m.header.dh === 'string' &&
    typeof m.header.pn === 'number' &&
    typeof m.header.n === 'number'
  );
}
