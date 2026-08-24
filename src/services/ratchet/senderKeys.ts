/**
 * Sender Keys — forward secrecy for group messages.
 *
 * ## Why groups cannot just use the Double Ratchet
 *
 * The Double Ratchet is a two-party protocol. Its DH ratchet turns on the
 * conversation alternating between exactly two sides; there is no coherent
 * meaning to "the other party's current ratchet key" among 32 people.
 *
 * The obvious workaround is what this codebase does today: fan out, sealing
 * one copy per recipient. That works and it is genuinely end-to-end, but it
 * costs O(members) ciphertexts per message, and — the reason we are here — it
 * inherits whatever the pairwise scheme's properties are. Today that is a
 * static DH with no forward secrecy at all.
 *
 * Sender Keys split the problem. Each *sender* keeps one hash chain for the
 * group. Messages are encrypted once, under a key derived from that chain, and
 * the chain advances per message. The chain key itself is distributed to
 * members over the pairwise ratchet — which is why this file sits on top of
 * doubleRatchet.ts rather than beside it.
 *
 * ## What this does and does not give you
 *
 * **Forward secrecy: yes, along the chain.** The chain advances by a one-way
 * KDF, so an attacker who takes the current chain key cannot derive keys for
 * earlier messages.
 *
 * **Post-compromise security: no, not within an epoch.** This is the honest
 * limitation and it must not be glossed. An attacker holding a sender's chain
 * key can derive every *future* key in that chain, because advancing is
 * something they can do too. The pairwise ratchet heals itself after a round
 * trip; a sender key does not heal at all. It is only repaired by rotation —
 * which is why rotation on membership change is not merely an access-control
 * chore but the sole recovery mechanism this construction has.
 *
 * **Authenticity: per-sender signatures.** Every member holds every other
 * member's chain key, so the group key alone cannot prove who sent a message —
 * any member could forge one. Each sender therefore also has an Ed25519
 * signing key, distributed with the chain key, and signs each message.
 *
 * ## Rotation
 *
 * On *removal*, rotation is mandatory and must be immediate: the departing
 * member holds the current chain key and could otherwise derive every future
 * message key in the group. On *addition*, a new member simply receives the
 * current chain key at its current index, which by construction cannot open
 * anything sent before that index — so history stays closed without rotating.
 */
import {ed25519} from '@noble/curves/ed25519.js';
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {hmac} from '@noble/hashes/hmac.js';
import {sha256} from '@noble/hashes/sha2.js';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  secureRandomBytes,
  utf8ToBytes,
} from '../crypto';

export const SENDER_KEY_ALG = 'chatterbox-sender-key-v1';

const NONCE_BYTES = 24;

/**
 * Bound on how far ahead a message may claim to be, for the same reason
 * MAX_SKIP exists in the pairwise ratchet: without it a forged index is a
 * remote denial of service against every recipient.
 */
export const MAX_SENDER_KEY_SKIP = 2000;

/** The private half: what a sender keeps in order to send. */
export type SenderKeyState = {
  /** Identifies this chain; changes on every rotation. */
  chainId: string;
  /** Current chain key. */
  chainKey: Uint8Array;
  /** Index of the next message to be sent. */
  index: number;
  /** Ed25519 signing key proving messages came from this sender. */
  signingKey: {secretKey: Uint8Array; publicKey: Uint8Array};
};

/** What a receiver keeps for one (sender, chain) pair. */
export type SenderKeyReceiverState = {
  chainId: string;
  chainKey: Uint8Array;
  index: number;
  signingPublicKey: Uint8Array;
  /** Keys derived past, for messages that arrived out of order. */
  skipped: Map<number, Uint8Array>;
};

/**
 * The chain key handed to a group member, delivered over the pairwise
 * ratchet. Never sent in the clear — anyone holding it can read the group.
 */
export type SenderKeyDistribution = {
  alg: typeof SENDER_KEY_ALG;
  chainId: string;
  chainKey: string;
  index: number;
  signingPublicKey: string;
};

export type SenderKeyMessage = {
  alg: typeof SENDER_KEY_ALG;
  chainId: string;
  index: number;
  /** nonce‖ciphertext, base64. */
  body: string;
  /** Ed25519 over the authenticated bytes, base64. */
  signature: string;
};

/**
 * Chain KDF, domain-separated the same way as the pairwise chain: one HMAC
 * yields the message key, another the next chain key. One-way, so earlier
 * message keys are unrecoverable once the chain moves on.
 *
 * The two constants must differ. If the message key and the next chain key
 * were equal, one leaked message key would yield every key after it — and in
 * a group that key is held by every member. Exported so the separation can be
 * asserted directly; watching messages round-trip does not reveal it.
 */
export function advance(chainKey: Uint8Array): {chainKey: Uint8Array; messageKey: Uint8Array} {
  return {
    messageKey: hmac(sha256, chainKey, Uint8Array.of(0x01)),
    chainKey: hmac(sha256, chainKey, Uint8Array.of(0x02)),
  };
}

function signedBytes(chainId: string, index: number, body: string, ad: Uint8Array): Uint8Array {
  const head = utf8ToBytes(`${SENDER_KEY_ALG}|${chainId}|${index}|${body}|`);
  const out = new Uint8Array(head.length + ad.length);
  out.set(head, 0);
  out.set(ad, head.length);
  return out;
}

export function createSenderKey(): SenderKeyState {
  const secretKey = ed25519.utils.randomSecretKey();
  return {
    chainId: bytesToBase64(secureRandomBytes(12)),
    chainKey: secureRandomBytes(32),
    index: 0,
    signingKey: {secretKey, publicKey: ed25519.getPublicKey(secretKey)},
  };
}

/**
 * The distribution message for the chain's *current* position.
 *
 * Deliberately the current index, not zero: a member added midway must not be
 * handed a key that opens messages sent before they joined. The chain KDF is
 * one-way, so starting them here makes earlier messages unreadable by
 * construction rather than by the sender remembering to withhold them.
 */
export function distributionFor(state: SenderKeyState): SenderKeyDistribution {
  return {
    alg: SENDER_KEY_ALG,
    chainId: state.chainId,
    chainKey: bytesToBase64(state.chainKey),
    index: state.index,
    signingPublicKey: bytesToBase64(state.signingKey.publicKey),
  };
}

export function acceptDistribution(d: SenderKeyDistribution): SenderKeyReceiverState {
  if (d.alg !== SENDER_KEY_ALG) throw new Error('sender key: unknown algorithm');
  return {
    chainId: d.chainId,
    chainKey: base64ToBytes(d.chainKey),
    index: d.index,
    signingPublicKey: base64ToBytes(d.signingPublicKey),
    skipped: new Map(),
  };
}

export function senderKeyEncrypt(
  state: SenderKeyState,
  plaintext: string,
  ad: Uint8Array = new Uint8Array(0),
): {state: SenderKeyState; message: SenderKeyMessage} {
  const {chainKey, messageKey} = advance(state.chainKey);
  const index = state.index;

  const nonce = secureRandomBytes(NONCE_BYTES);
  const ct = xchacha20poly1305(messageKey, nonce, ad).encrypt(utf8ToBytes(plaintext));
  const packed = new Uint8Array(nonce.length + ct.length);
  packed.set(nonce, 0);
  packed.set(ct, nonce.length);
  const body = bytesToBase64(packed);

  const signature = ed25519.sign(
    signedBytes(state.chainId, index, body, ad),
    state.signingKey.secretKey,
  );

  return {
    state: {...state, chainKey, index: index + 1},
    message: {
      alg: SENDER_KEY_ALG,
      chainId: state.chainId,
      index,
      body,
      signature: bytesToBase64(signature),
    },
  };
}

export class SenderKeySignatureError extends Error {
  readonly code = 'sender-key-signature-invalid';
  constructor(message = 'sender key message signature did not verify') {
    super(message);
    this.name = 'SenderKeySignatureError';
  }
}

export function senderKeyDecrypt(
  state: SenderKeyReceiverState,
  message: SenderKeyMessage,
  ad: Uint8Array = new Uint8Array(0),
): {state: SenderKeyReceiverState; plaintext: string} {
  if (message.chainId !== state.chainId) {
    // A different chain — usually a rotation whose distribution has not
    // arrived yet. The caller decides whether to wait or re-request.
    throw new Error('sender key: message belongs to a different chain');
  }

  // Checked before any key derivation. Every member holds this chain key, so
  // without the signature any of them could forge a message as this sender —
  // the group key proves membership, not authorship.
  const ok = ed25519.verify(
    base64ToBytes(message.signature),
    signedBytes(message.chainId, message.index, message.body, ad),
    state.signingPublicKey,
  );
  if (!ok) throw new SenderKeySignatureError();

  const next: SenderKeyReceiverState = {...state, skipped: new Map(state.skipped)};

  const open = (mk: Uint8Array): string => {
    const packed = base64ToBytes(message.body);
    if (packed.length < NONCE_BYTES + 16) throw new Error('sender key: ciphertext too short');
    return bytesToUtf8(
      xchacha20poly1305(mk, packed.subarray(0, NONCE_BYTES), ad).decrypt(packed.subarray(NONCE_BYTES)),
    );
  };

  const stored = next.skipped.get(message.index);
  if (stored) {
    const plaintext = open(stored);
    next.skipped.delete(message.index);
    return {state: next, plaintext};
  }

  if (message.index < next.index) {
    // Below the chain head with no stored key: already delivered, or evicted.
    // Replay of a delivered message is exactly what this must refuse.
    throw new Error('sender key: message key already used or expired');
  }
  if (message.index - next.index > MAX_SENDER_KEY_SKIP) {
    throw new Error(`sender key: refusing to skip more than ${MAX_SENDER_KEY_SKIP} messages`);
  }

  let chainKey = next.chainKey;
  let index = next.index;
  let messageKey: Uint8Array | null = null;
  while (index <= message.index) {
    const step = advance(chainKey);
    chainKey = step.chainKey;
    if (index === message.index) messageKey = step.messageKey;
    else next.skipped.set(index, step.messageKey);
    index += 1;
  }
  if (!messageKey) throw new Error('sender key: failed to derive message key');

  // Decrypt before committing, so a bad body leaves the caller's state intact.
  const plaintext = open(messageKey);
  next.chainKey = chainKey;
  next.index = index;
  return {state: next, plaintext};
}

/**
 * A fresh chain, keeping the same signing identity.
 *
 * Rotating the signing key too would be pointless churn — it is a public
 * identity within the group, not a secret whose exposure this repairs — and
 * would make every receiver treat the sender as a new participant.
 */
export function rotateSenderKey(state: SenderKeyState): SenderKeyState {
  return {
    chainId: bytesToBase64(secureRandomBytes(12)),
    chainKey: secureRandomBytes(32),
    index: 0,
    signingKey: state.signingKey,
  };
}

/**
 * Whether a membership change requires rotation before the next message.
 *
 * Removal: yes, always. The departing member holds the current chain key, and
 * because advancing it is something they can do unaided, every future message
 * in this chain is readable by them until it is replaced. This is the sole
 * healing mechanism sender keys have.
 *
 * Addition: no. A new member is given the chain at its current index, which
 * cannot open anything earlier.
 */
export function rotationRequired(previous: string[], next: string[]): boolean {
  const after = new Set(next);
  return previous.some(uid => !after.has(uid));
}

// ---- persistence -----------------------------------------------------------

export function serializeSenderKeyState(state: SenderKeyState): string {
  return JSON.stringify({
    v: 1,
    chainId: state.chainId,
    chainKey: bytesToBase64(state.chainKey),
    index: state.index,
    signingKey: {
      secretKey: bytesToBase64(state.signingKey.secretKey),
      publicKey: bytesToBase64(state.signingKey.publicKey),
    },
  });
}

export function deserializeSenderKeyState(json: string): SenderKeyState {
  const raw = JSON.parse(json);
  if (raw.v !== 1) throw new Error(`sender key: unknown state version ${raw.v}`);
  return {
    chainId: raw.chainId,
    chainKey: base64ToBytes(raw.chainKey),
    index: raw.index,
    signingKey: {
      secretKey: base64ToBytes(raw.signingKey.secretKey),
      publicKey: base64ToBytes(raw.signingKey.publicKey),
    },
  };
}

export function serializeReceiverState(state: SenderKeyReceiverState): string {
  return JSON.stringify({
    v: 1,
    chainId: state.chainId,
    chainKey: bytesToBase64(state.chainKey),
    index: state.index,
    signingPublicKey: bytesToBase64(state.signingPublicKey),
    skipped: [...state.skipped].map(([k, v]) => [k, bytesToBase64(v)]),
  });
}

export function deserializeReceiverState(json: string): SenderKeyReceiverState {
  const raw = JSON.parse(json);
  if (raw.v !== 1) throw new Error(`sender key: unknown receiver state version ${raw.v}`);
  return {
    chainId: raw.chainId,
    chainKey: base64ToBytes(raw.chainKey),
    index: raw.index,
    signingPublicKey: base64ToBytes(raw.signingPublicKey),
    skipped: new Map((raw.skipped as [number, string][]).map(([k, v]) => [k, base64ToBytes(v)])),
  };
}

export function isSenderKeyMessage(value: unknown): value is SenderKeyMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<SenderKeyMessage>;
  return (
    m.alg === SENDER_KEY_ALG &&
    typeof m.chainId === 'string' &&
    typeof m.index === 'number' &&
    typeof m.body === 'string' &&
    typeof m.signature === 'string'
  );
}
