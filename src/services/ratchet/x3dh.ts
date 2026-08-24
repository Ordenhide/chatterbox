/**
 * X3DH — the initial key agreement that produces the shared secret the Double
 * Ratchet starts from.
 *
 * ## Why not just do one DH between identity keys
 *
 * That is exactly what the current `deriveMessageKey` does, and it has three
 * problems X3DH exists to solve:
 *
 *   1. **No forward secrecy at the root.** One static DH means one secret for
 *      all time. X3DH mixes in an ephemeral key from the sender and a rotating
 *      signed prekey from the recipient, so the root secret itself is already
 *      unrecoverable once those are deleted.
 *   2. **No asynchrony.** A live handshake needs both parties online. Prekeys
 *      are published in advance precisely so the sender can establish a
 *      session against a recipient who is offline.
 *   3. **No replay resistance for the first message.** The one-time prekey is
 *      consumed on use, so a first message cannot be replayed into a fresh
 *      session.
 *
 * ## The four DHs, and what each one is for
 *
 *   DH1 = DH(IK_a, SPK_b)   authenticates the *sender* to the recipient
 *   DH2 = DH(EK_a, IK_b)    authenticates the *recipient* to the sender
 *   DH3 = DH(EK_a, SPK_b)   supplies the forward secrecy
 *   DH4 = DH(EK_a, OPK_b)   adds one-time-ness, when an OPK is available
 *
 * Dropping DH1 or DH2 would leave the exchange unauthenticated in one
 * direction; dropping DH3 would leave it without forward secrecy. DH4 is
 * optional by design — prekey batches run out, and the exchange must still
 * work rather than fail closed on a supply problem.
 *
 * ## Identity keys are Ed25519 here, not X25519
 *
 * The signed prekey has to be *signed*, or the server could substitute its own
 * and read everything — which would leave the whole exercise pointless. The
 * existing identity keys are bare X25519, which cannot sign.
 *
 * So an identity is an Ed25519 keypair, and its X25519 agreement key is
 * derived from it (`toMontgomery` / `toMontgomerySecret`). One identity, two
 * uses, no second key to publish, verify, or get out of sync. Verified
 * empirically that the derived pair agrees under DH before this was built on.
 *
 * The existing X25519 identity keys are untouched: they stay published and
 * keep decrypting history. See the migration note in the module that wires
 * this up.
 */
import {ed25519, x25519} from '@noble/curves/ed25519.js';
import {hkdf} from '@noble/hashes/hkdf.js';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToBase64, bytesToHex, secureRandomBytes, utf8ToBytes} from '../crypto';
import {generateRatchetKeypair, type Keypair} from './doubleRatchet';

export const X3DH_ALG = 'chatterbox-x3dh-v1';

/** Ed25519 identity: signs prekeys, and derives the X25519 agreement key. */
export type IdentityKeypair = {
  /** Ed25519 secret key. */
  secretKey: Uint8Array;
  /** Ed25519 public key — this is the identity users verify. */
  publicKey: Uint8Array;
};

export function generateIdentityKeypair(): IdentityKeypair {
  const secretKey = ed25519.utils.randomSecretKey();
  return {secretKey, publicKey: ed25519.getPublicKey(secretKey)};
}

/** The X25519 keypair derived from an Ed25519 identity, for DH only. */
export function identityAgreementKeypair(identity: IdentityKeypair): Keypair {
  return {
    secretKey: ed25519.utils.toMontgomerySecret(identity.secretKey),
    publicKey: ed25519.utils.toMontgomery(identity.publicKey),
  };
}

export function identityAgreementPublic(identityPublicKey: Uint8Array): Uint8Array {
  return ed25519.utils.toMontgomery(identityPublicKey);
}

/**
 * What a user publishes so others can start a session with them offline.
 * `oneTimePreKeys` is a batch; each is handed out at most once and deleted.
 */
export type PublishedPreKeys = {
  identityKey: Uint8Array;
  signedPreKey: Uint8Array;
  signedPreKeySignature: Uint8Array;
  signedPreKeyId: string;
  oneTimePreKeys: {id: string; publicKey: Uint8Array}[];
};

/** The private half, which never leaves the device. */
export type PreKeySecrets = {
  signedPreKey: Keypair;
  signedPreKeyId: string;
  oneTimePreKeys: Map<string, Keypair>;
};

export function signPreKey(identity: IdentityKeypair, preKeyPublic: Uint8Array): Uint8Array {
  return ed25519.sign(preKeyPublic, identity.secretKey);
}

export function verifyPreKeySignature(
  identityPublicKey: Uint8Array,
  preKeyPublic: Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    return ed25519.verify(signature, preKeyPublic, identityPublicKey);
  } catch {
    // A malformed signature is a failed verification, not a crash — this runs
    // on data the server handed us.
    return false;
  }
}

/**
 * Hex, not base64, because these ids become Firestore document ids and base64
 * contains '/' — which is a path separator there, not a character. A batch
 * published with base64 ids silently loses every key whose id happened to
 * contain one.
 */
function randomId(): string {
  return bytesToHex(secureRandomBytes(9));
}

export function generatePreKeys(
  identity: IdentityKeypair,
  oneTimeCount = 50,
): {published: PublishedPreKeys; secrets: PreKeySecrets} {
  const signedPreKey = generateRatchetKeypair();
  const signedPreKeyId = randomId();
  const oneTime = Array.from({length: oneTimeCount}, () => ({
    id: randomId(),
    pair: generateRatchetKeypair(),
  }));

  return {
    published: {
      identityKey: identity.publicKey,
      signedPreKey: signedPreKey.publicKey,
      signedPreKeySignature: signPreKey(identity, signedPreKey.publicKey),
      signedPreKeyId,
      oneTimePreKeys: oneTime.map(o => ({id: o.id, publicKey: o.pair.publicKey})),
    },
    secrets: {
      signedPreKey,
      signedPreKeyId,
      oneTimePreKeys: new Map(oneTime.map(o => [o.id, o.pair])),
    },
  };
}

/** One recipient's bundle, as fetched to start a session. */
export type PreKeyBundle = {
  identityKey: Uint8Array;
  signedPreKey: Uint8Array;
  signedPreKeySignature: Uint8Array;
  signedPreKeyId: string;
  oneTimePreKey?: {id: string; publicKey: Uint8Array};
};

/** What the initiator must send so the responder can derive the same secret. */
export type InitialMessageKeys = {
  identityKey: Uint8Array;
  ephemeralKey: Uint8Array;
  signedPreKeyId: string;
  oneTimePreKeyId?: string;
};

export class PreKeySignatureError extends Error {
  readonly code = 'prekey-signature-invalid';
  constructor(message = 'signed prekey signature did not verify') {
    super(message);
    this.name = 'PreKeySignatureError';
  }
}

function kdf(inputs: Uint8Array[]): Uint8Array {
  // The leading 0xFF block is from the X3DH spec: it domain-separates this
  // input from any raw DH output, so a shared secret can never collide with
  // one produced by a different construction over the same curve.
  const prefix = new Uint8Array(32).fill(0xff);
  const total = prefix.length + inputs.reduce((n, i) => n + i.length, 0);
  const ikm = new Uint8Array(total);
  ikm.set(prefix, 0);
  let offset = prefix.length;
  for (const input of inputs) {
    ikm.set(input, offset);
    offset += input.length;
  }
  return hkdf(sha256, ikm, new Uint8Array(32), utf8ToBytes(X3DH_ALG), 32);
}

/**
 * Initiator side. Verifies the bundle, runs the four DHs, and returns both the
 * shared secret and the identifiers the responder needs to reproduce it.
 *
 * Throws on a bad signature rather than continuing without one — an
 * unauthenticated prekey is exactly the substitution this is here to prevent,
 * so proceeding would defeat the purpose while looking like it worked.
 */
export function initiateX3DH(
  ourIdentity: IdentityKeypair,
  bundle: PreKeyBundle,
): {sharedSecret: Uint8Array; initial: InitialMessageKeys} {
  if (!verifyPreKeySignature(bundle.identityKey, bundle.signedPreKey, bundle.signedPreKeySignature)) {
    throw new PreKeySignatureError();
  }

  const ourAgreement = identityAgreementKeypair(ourIdentity);
  const theirIdentityAgreement = identityAgreementPublic(bundle.identityKey);
  const ephemeral = generateRatchetKeypair();

  const dh1 = x25519.getSharedSecret(ourAgreement.secretKey, bundle.signedPreKey);
  const dh2 = x25519.getSharedSecret(ephemeral.secretKey, theirIdentityAgreement);
  const dh3 = x25519.getSharedSecret(ephemeral.secretKey, bundle.signedPreKey);
  const parts = [dh1, dh2, dh3];
  if (bundle.oneTimePreKey) {
    parts.push(x25519.getSharedSecret(ephemeral.secretKey, bundle.oneTimePreKey.publicKey));
  }

  return {
    sharedSecret: kdf(parts),
    initial: {
      identityKey: ourIdentity.publicKey,
      ephemeralKey: ephemeral.publicKey,
      signedPreKeyId: bundle.signedPreKeyId,
      ...(bundle.oneTimePreKey ? {oneTimePreKeyId: bundle.oneTimePreKey.id} : null),
    },
  };
}

/**
 * Responder side. Reproduces the same secret from the initiator's identity and
 * ephemeral keys plus its own stored prekey secrets.
 *
 * The DH arguments are mirrored relative to initiateX3DH — DH1 pairs *their*
 * identity with *our* signed prekey either way round — which is the whole
 * reason both sides land on the same value.
 */
export function respondX3DH(
  ourIdentity: IdentityKeypair,
  secrets: PreKeySecrets,
  initial: InitialMessageKeys,
): Uint8Array {
  if (initial.signedPreKeyId !== secrets.signedPreKeyId) {
    throw new Error('x3dh: message names a signed prekey this device does not hold');
  }
  const ourAgreement = identityAgreementKeypair(ourIdentity);
  const theirIdentityAgreement = identityAgreementPublic(initial.identityKey);

  const dh1 = x25519.getSharedSecret(secrets.signedPreKey.secretKey, theirIdentityAgreement);
  const dh2 = x25519.getSharedSecret(ourAgreement.secretKey, initial.ephemeralKey);
  const dh3 = x25519.getSharedSecret(secrets.signedPreKey.secretKey, initial.ephemeralKey);
  const parts = [dh1, dh2, dh3];

  if (initial.oneTimePreKeyId) {
    const otp = secrets.oneTimePreKeys.get(initial.oneTimePreKeyId);
    // Absent means already consumed (or never held): a replay of a first
    // message, or a bundle from another device. Failing is correct — deriving
    // without DH4 would silently produce a different secret and surface as an
    // undecryptable message instead.
    if (!otp) throw new Error('x3dh: one-time prekey already used or unknown');
    parts.push(x25519.getSharedSecret(otp.secretKey, initial.ephemeralKey));
  }

  return kdf(parts);
}

/**
 * Consumes a one-time prekey, returning the secrets without it.
 *
 * Separate from respondX3DH so the caller controls *when* it is burned:
 * deleting it before the session is durably stored would make a crash
 * mid-handshake permanently undecryptable.
 */
export function consumeOneTimePreKey(secrets: PreKeySecrets, id: string): PreKeySecrets {
  const next = new Map(secrets.oneTimePreKeys);
  next.delete(id);
  return {...secrets, oneTimePreKeys: next};
}

/**
 * Associated data binding every message to both identities.
 *
 * Passed to the ratchet as AD so a ciphertext cannot be transplanted into a
 * different conversation and still authenticate. Order is fixed by sorting so
 * both sides compute the same bytes without agreeing on who is "first".
 */
export function sessionAssociatedData(
  identityA: Uint8Array,
  identityB: Uint8Array,
  chatId: string,
): Uint8Array {
  const [first, second] = [bytesToBase64(identityA), bytesToBase64(identityB)].sort();
  return utf8ToBytes(`${X3DH_ALG}|${first}|${second}|${chatId}`);
}
