import {
  PreKeySignatureError,
  consumeOneTimePreKey,
  generateIdentityKeypair,
  generatePreKeys,
  identityAgreementKeypair,
  initiateX3DH,
  respondX3DH,
  sessionAssociatedData,
  verifyPreKeySignature,
  type PreKeyBundle,
} from '../x3dh';
import {
  initSessionAsInitiator,
  initSessionAsResponder,
  ratchetDecrypt,
  ratchetEncrypt,
} from '../doubleRatchet';
import {bytesToBase64} from '../../crypto';
import {x25519} from '@noble/curves/ed25519.js';

/** A recipient who has published a prekey batch, as a new install would. */
function published(oneTimeCount = 3) {
  const identity = generateIdentityKeypair();
  const {published: pub, secrets} = generatePreKeys(identity, oneTimeCount);
  return {identity, pub, secrets};
}

function bundleFrom(pub: ReturnType<typeof published>['pub'], useOneTime = true): PreKeyBundle {
  return {
    identityKey: pub.identityKey,
    signedPreKey: pub.signedPreKey,
    signedPreKeySignature: pub.signedPreKeySignature,
    signedPreKeyId: pub.signedPreKeyId,
    ...(useOneTime && pub.oneTimePreKeys[0] ? {oneTimePreKey: pub.oneTimePreKeys[0]} : null),
  };
}

describe('identity keys', () => {
  it('derives an X25519 agreement key that actually agrees', () => {
    // The premise the whole design rests on: one Ed25519 identity that both
    // signs prekeys and yields a working DH key.
    const a = generateIdentityKeypair();
    const b = generateIdentityKeypair();
    const aX = identityAgreementKeypair(a);
    const bX = identityAgreementKeypair(b);
    expect(bytesToBase64(x25519.getSharedSecret(aX.secretKey, bX.publicKey))).toBe(
      bytesToBase64(x25519.getSharedSecret(bX.secretKey, aX.publicKey)),
    );
  });

  it('produces a different identity every time', () => {
    const keys = new Set(Array.from({length: 10}, () => bytesToBase64(generateIdentityKeypair().publicKey)));
    expect(keys.size).toBe(10);
  });
});

describe('signed prekeys', () => {
  it('verifies a signature made by the matching identity', () => {
    const {identity, pub} = published();
    expect(verifyPreKeySignature(identity.publicKey, pub.signedPreKey, pub.signedPreKeySignature)).toBe(true);
  });

  it('rejects a prekey signed by a different identity', () => {
    // The substitution this exists to stop: a server swapping in its own
    // prekey so it can read the conversation.
    const {pub} = published();
    const attacker = published();
    expect(
      verifyPreKeySignature(pub.identityKey, attacker.pub.signedPreKey, attacker.pub.signedPreKeySignature),
    ).toBe(false);
  });

  it('rejects a malformed signature without throwing', () => {
    const {identity, pub} = published();
    expect(verifyPreKeySignature(identity.publicKey, pub.signedPreKey, new Uint8Array(8))).toBe(false);
  });
});

describe('the exchange', () => {
  it('lands both sides on the same secret, with a one-time prekey', () => {
    const alice = generateIdentityKeypair();
    const bob = published();

    const {sharedSecret, initial} = initiateX3DH(alice, bundleFrom(bob.pub));
    const theirs = respondX3DH(bob.identity, bob.secrets, initial);

    expect(bytesToBase64(theirs)).toBe(bytesToBase64(sharedSecret));
  });

  it('lands both sides on the same secret without one, when the batch is exhausted', () => {
    // Prekey batches run out. The exchange has to keep working rather than
    // fail closed on a supply problem.
    const alice = generateIdentityKeypair();
    const bob = published(0);

    const {sharedSecret, initial} = initiateX3DH(alice, bundleFrom(bob.pub, false));
    expect(initial.oneTimePreKeyId).toBeUndefined();
    expect(bytesToBase64(respondX3DH(bob.identity, bob.secrets, initial))).toBe(bytesToBase64(sharedSecret));
  });

  it('gives different pairs different secrets', () => {
    const alice = generateIdentityKeypair();
    const bob = published();
    const carol = published();
    const one = initiateX3DH(alice, bundleFrom(bob.pub)).sharedSecret;
    const two = initiateX3DH(alice, bundleFrom(carol.pub)).sharedSecret;
    expect(bytesToBase64(one)).not.toBe(bytesToBase64(two));
  });

  it('gives two sessions with the same peer different secrets', () => {
    // The ephemeral key is what makes this true, and it is what stops a
    // second conversation from reusing the first one's root.
    const alice = generateIdentityKeypair();
    const bob = published();
    const one = initiateX3DH(alice, bundleFrom(bob.pub)).sharedSecret;
    const two = initiateX3DH(alice, bundleFrom(bob.pub)).sharedSecret;
    expect(bytesToBase64(one)).not.toBe(bytesToBase64(two));
  });

  it('refuses a bundle whose signature does not verify', () => {
    // Proceeding anyway would defeat the entire purpose while appearing to
    // work, which is the worst available outcome.
    const alice = generateIdentityKeypair();
    const bob = published();
    const attacker = published();
    const tampered: PreKeyBundle = {...bundleFrom(bob.pub), signedPreKey: attacker.pub.signedPreKey};
    expect(() => initiateX3DH(alice, tampered)).toThrow(PreKeySignatureError);
  });

  it('refuses a message naming a signed prekey the device does not hold', () => {
    const alice = generateIdentityKeypair();
    const bob = published();
    const {initial} = initiateX3DH(alice, bundleFrom(bob.pub));
    expect(() =>
      respondX3DH(bob.identity, bob.secrets, {...initial, signedPreKeyId: 'someone-elses'}),
    ).toThrow(/does not hold/);
  });
});

describe('one-time prekeys are one-time', () => {
  it('refuses to reuse a consumed prekey', () => {
    // Replay resistance for the first message: a captured initial message
    // must not open a second session.
    const alice = generateIdentityKeypair();
    const bob = published();
    const {initial} = initiateX3DH(alice, bundleFrom(bob.pub));

    expect(() => respondX3DH(bob.identity, bob.secrets, initial)).not.toThrow();

    const after = consumeOneTimePreKey(bob.secrets, initial.oneTimePreKeyId!);
    expect(() => respondX3DH(bob.identity, after, initial)).toThrow(/already used/);
  });

  it('does not mutate the caller when consuming', () => {
    // Deleting the key is separate from responding precisely so the caller
    // can order it after the session is durably stored — a crash mid-handshake
    // must not make the first message permanently undecryptable.
    const bob = published();
    const id = bob.pub.oneTimePreKeys[0].id;
    const after = consumeOneTimePreKey(bob.secrets, id);
    expect(bob.secrets.oneTimePreKeys.has(id)).toBe(true);
    expect(after.oneTimePreKeys.has(id)).toBe(false);
  });
});

describe('handing off to the ratchet', () => {
  it('produces sessions that can actually talk', () => {
    // The join between the two halves: X3DH's secret has to be the thing the
    // ratchet starts from, on both sides, or nothing decrypts.
    const alice = generateIdentityKeypair();
    const bob = published();
    const bundle = bundleFrom(bob.pub);

    const {sharedSecret, initial} = initiateX3DH(alice, bundle);
    const bobSecret = respondX3DH(bob.identity, bob.secrets, initial);

    const ad = sessionAssociatedData(alice.publicKey, bob.identity.publicKey, 'chat1');
    let aliceSession = initSessionAsInitiator(sharedSecret, bundle.signedPreKey);
    let bobSession = initSessionAsResponder(bobSecret, bob.secrets.signedPreKey);

    const sent = ratchetEncrypt(aliceSession, 'first contact', ad);
    aliceSession = sent.session;
    const got = ratchetDecrypt(bobSession, sent.message, ad);
    bobSession = got.session;
    expect(got.plaintext).toBe('first contact');

    const reply = ratchetEncrypt(bobSession, 'received', ad);
    expect(ratchetDecrypt(aliceSession, reply.message, ad).plaintext).toBe('received');
  });
});

describe('sessionAssociatedData', () => {
  it('is the same for both parties regardless of argument order', () => {
    const a = generateIdentityKeypair().publicKey;
    const b = generateIdentityKeypair().publicKey;
    expect(sessionAssociatedData(a, b, 'c1')).toEqual(sessionAssociatedData(b, a, 'c1'));
  });

  it('differs per conversation', () => {
    const a = generateIdentityKeypair().publicKey;
    const b = generateIdentityKeypair().publicKey;
    expect(sessionAssociatedData(a, b, 'c1')).not.toEqual(sessionAssociatedData(a, b, 'c2'));
  });
});
