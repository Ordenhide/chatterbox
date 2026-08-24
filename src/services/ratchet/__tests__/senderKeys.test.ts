import {
  MAX_SENDER_KEY_SKIP,
  advance,
  SenderKeySignatureError,
  acceptDistribution,
  createSenderKey,
  deserializeReceiverState,
  deserializeSenderKeyState,
  distributionFor,
  isSenderKeyMessage,
  rotateSenderKey,
  rotationRequired,
  senderKeyDecrypt,
  senderKeyEncrypt,
  serializeReceiverState,
  serializeSenderKeyState,
  type SenderKeyMessage,
} from '../senderKeys';
import {bytesToBase64, secureRandomBytes, utf8ToBytes} from '../../crypto';

const AD = utf8ToBytes('group1');

describe('a sender and its group', () => {
  it('delivers a message to a member holding the distribution', () => {
    let sender = createSenderKey();
    const member = acceptDistribution(distributionFor(sender));

    const sent = senderKeyEncrypt(sender, 'hello group', AD);
    sender = sent.state;
    expect(senderKeyDecrypt(member, sent.message, AD).plaintext).toBe('hello group');
  });

  it('delivers the same ciphertext to every member — one encryption, not fan-out', () => {
    // The efficiency claim, made concrete: three members open the *same*
    // message rather than three separately sealed copies.
    let sender = createSenderKey();
    const members = [0, 1, 2].map(() => acceptDistribution(distributionFor(sender)));
    const sent = senderKeyEncrypt(sender, 'one copy', AD);
    sender = sent.state;
    for (const m of members) {
      expect(senderKeyDecrypt(m, sent.message, AD).plaintext).toBe('one copy');
    }
  });

  it('carries a long run of messages', () => {
    let sender = createSenderKey();
    let member = acceptDistribution(distributionFor(sender));
    for (let i = 0; i < 30; i++) {
      const sent = senderKeyEncrypt(sender, `m${i}`, AD);
      sender = sent.state;
      const got = senderKeyDecrypt(member, sent.message, AD);
      member = got.state;
      expect(got.plaintext).toBe(`m${i}`);
    }
  });
});

describe('forward secrecy along the chain', () => {
  it('never reuses a message key', () => {
    let sender = createSenderKey();
    const bodies = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const sent = senderKeyEncrypt(sender, 'identical', AD);
      sender = sent.state;
      bodies.add(sent.message.body);
    }
    expect(bodies.size).toBe(20);
  });

  it('cannot open an earlier message from a later receiver state', () => {
    let sender = createSenderKey();
    let member = acceptDistribution(distributionFor(sender));

    const first = senderKeyEncrypt(sender, 'the secret', AD);
    sender = first.state;
    member = senderKeyDecrypt(member, first.message, AD).state;

    for (let i = 0; i < 5; i++) {
      const sent = senderKeyEncrypt(sender, `later${i}`, AD);
      sender = sent.state;
      member = senderKeyDecrypt(member, sent.message, AD).state;
    }

    expect(() => senderKeyDecrypt(member, first.message, AD)).toThrow(/already used|expired/);
  });

  it('starts a member added midway at the current index, closing history to them', () => {
    // Not enforced by the sender remembering to withhold anything: the chain
    // KDF is one-way, so a key handed out at index 3 simply cannot produce the
    // keys for 0..2.
    let sender = createSenderKey();
    const early = acceptDistribution(distributionFor(sender));

    const secret = senderKeyEncrypt(sender, 'before they joined', AD);
    sender = secret.state;
    for (let i = 0; i < 2; i++) {
      sender = senderKeyEncrypt(sender, `filler${i}`, AD).state;
    }

    const latecomer = acceptDistribution(distributionFor(sender));
    expect(latecomer.index).toBe(3);
    expect(() => senderKeyDecrypt(latecomer, secret.message, AD)).toThrow();
    // ...while the member who was there all along still can.
    expect(senderKeyDecrypt(early, secret.message, AD).plaintext).toBe('before they joined');
  });
});

describe('the chain KDF', () => {
  it('domain-separates the message key from the next chain key', () => {
    // In a group every member holds the chain key, so a collision here would
    // mean one leaked message key yields every subsequent one for everybody.
    const ck = secureRandomBytes(32);
    const {chainKey, messageKey} = advance(ck);
    expect(bytesToBase64(messageKey)).not.toBe(bytesToBase64(chainKey));
    expect(bytesToBase64(messageKey)).not.toBe(bytesToBase64(ck));
    expect(bytesToBase64(chainKey)).not.toBe(bytesToBase64(ck));
  });
});

describe('authorship', () => {
  it('rejects a message signed by someone else', () => {
    // Every member holds the chain key, so the group key proves membership,
    // not authorship. Without the signature any member could forge as any
    // other. This is the test for that.
    let sender = createSenderKey();
    const member = acceptDistribution(distributionFor(sender));

    const forger = createSenderKey();
    const sent = senderKeyEncrypt(sender, 'genuine', AD);
    sender = sent.state;
    const forgedSig = senderKeyEncrypt(
      {...forger, chainId: sender.chainId, chainKey: sender.chainKey, index: 0},
      'genuine',
      AD,
    ).message.signature;

    expect(() =>
      senderKeyDecrypt(member, {...sent.message, signature: forgedSig}, AD),
    ).toThrow(SenderKeySignatureError);
  });

  it('rejects a tampered ciphertext', () => {
    let sender = createSenderKey();
    const member = acceptDistribution(distributionFor(sender));
    const sent = senderKeyEncrypt(sender, 'hello', AD);
    sender = sent.state;
    const flipped = [...sent.message.body];
    flipped[10] = flipped[10] === 'A' ? 'B' : 'A';
    expect(() => senderKeyDecrypt(member, {...sent.message, body: flipped.join('')}, AD)).toThrow();
  });

  it('rejects a renumbered message', () => {
    let sender = createSenderKey();
    const member = acceptDistribution(distributionFor(sender));
    const sent = senderKeyEncrypt(sender, 'hello', AD);
    sender = sent.state;
    expect(() => senderKeyDecrypt(member, {...sent.message, index: 9}, AD)).toThrow();
  });

  it('rejects a message replayed into another group', () => {
    let sender = createSenderKey();
    const member = acceptDistribution(distributionFor(sender));
    const sent = senderKeyEncrypt(sender, 'hello', AD);
    sender = sent.state;
    expect(() => senderKeyDecrypt(member, sent.message, utf8ToBytes('group2'))).toThrow();
  });
});

describe('out of order', () => {
  it('delivers a message that arrives after the chain moved on', () => {
    let sender = createSenderKey();
    let member = acceptDistribution(distributionFor(sender));
    const held = senderKeyEncrypt(sender, 'delayed', AD);
    sender = held.state;
    const next = senderKeyEncrypt(sender, 'arrived first', AD);
    sender = next.state;

    const gotNext = senderKeyDecrypt(member, next.message, AD);
    member = gotNext.state;
    expect(gotNext.plaintext).toBe('arrived first');
    expect(senderKeyDecrypt(member, held.message, AD).plaintext).toBe('delayed');
  });

  it('rejects an outsider renumbering a message before doing any work', () => {
    // The index is signed, so an attacker who cannot sign cannot even reach
    // the skip bound — the signature check is the outer defence.
    let sender = createSenderKey();
    const member = acceptDistribution(distributionFor(sender));
    const sent = senderKeyEncrypt(sender, 'hi', AD);
    sender = sent.state;
    const forged: SenderKeyMessage = {...sent.message, index: MAX_SENDER_KEY_SKIP + 5000};
    expect(() => senderKeyDecrypt(member, forged, AD)).toThrow(SenderKeySignatureError);
  });

  it('refuses an absurd jump even from a properly signed sender', () => {
    // The bound is what remains once the signature is genuine: a compromised
    // or malicious *member* could otherwise ask every recipient to run the
    // KDF billions of times, which is a denial of service they are authorised
    // to send.
    const sender = createSenderKey();
    const member = acceptDistribution(distributionFor(sender));
    // A real signature over a real jump: same chain, index far ahead.
    const jumped = senderKeyEncrypt(
      {...sender, index: MAX_SENDER_KEY_SKIP + 5000},
      'far ahead',
      AD,
    ).message;
    expect(() => senderKeyDecrypt(member, jumped, AD)).toThrow(/refusing to skip/);
  });

  it('leaves the receiver state untouched when a decrypt fails', () => {
    let sender = createSenderKey();
    const member = acceptDistribution(distributionFor(sender));
    const sent = senderKeyEncrypt(sender, 'hello', AD);
    sender = sent.state;

    const before = serializeReceiverState(member);
    expect(() => senderKeyDecrypt(member, {...sent.message, body: 'AAAA'}, AD)).toThrow();
    expect(serializeReceiverState(member)).toBe(before);
    expect(senderKeyDecrypt(member, sent.message, AD).plaintext).toBe('hello');
  });
});

describe('rotation', () => {
  it('is required when someone leaves, not when someone joins', () => {
    // Removal is the only case that needs it, and it needs it absolutely: the
    // departing member holds the chain key and can advance it themselves.
    expect(rotationRequired(['a', 'b', 'c'], ['a', 'b'])).toBe(true);
    expect(rotationRequired(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    expect(rotationRequired(['a', 'b'], ['a', 'b'])).toBe(false);
    // A swap is a removal too.
    expect(rotationRequired(['a', 'b'], ['a', 'c'])).toBe(true);
  });

  it('locks out a holder of the old chain key', () => {
    let sender = createSenderKey();
    const removed = acceptDistribution(distributionFor(sender));

    sender = rotateSenderKey(sender);
    const remaining = acceptDistribution(distributionFor(sender));

    const after = senderKeyEncrypt(sender, 'post-rotation', AD);
    sender = after.state;

    expect(senderKeyDecrypt(remaining, after.message, AD).plaintext).toBe('post-rotation');
    expect(() => senderKeyDecrypt(removed, after.message, AD)).toThrow(/different chain/);
  });

  it('keeps the signing identity across a rotation', () => {
    // Rotating it would be churn: it is a public identity within the group,
    // not a secret whose exposure rotation repairs.
    const sender = createSenderKey();
    const rotated = rotateSenderKey(sender);
    expect(bytesToBase64(rotated.signingKey.publicKey)).toBe(bytesToBase64(sender.signingKey.publicKey));
    expect(rotated.chainId).not.toBe(sender.chainId);
    expect(rotated.index).toBe(0);
  });
});

describe('persistence', () => {
  it('round-trips sender state mid-chain', () => {
    let sender = createSenderKey();
    const member = acceptDistribution(distributionFor(sender));
    sender = senderKeyEncrypt(sender, 'first', AD).state;

    sender = deserializeSenderKeyState(serializeSenderKeyState(sender));
    const sent = senderKeyEncrypt(sender, 'after restart', AD);
    expect(senderKeyDecrypt(member, sent.message, AD).plaintext).toBeDefined();
  });

  it('round-trips receiver state including skipped keys', () => {
    let sender = createSenderKey();
    let member = acceptDistribution(distributionFor(sender));
    const held = senderKeyEncrypt(sender, 'delayed', AD);
    sender = held.state;
    const next = senderKeyEncrypt(sender, 'first', AD);
    sender = next.state;
    member = senderKeyDecrypt(member, next.message, AD).state;
    expect(member.skipped.size).toBe(1);

    const restored = deserializeReceiverState(serializeReceiverState(member));
    expect(restored.skipped.size).toBe(1);
    expect(senderKeyDecrypt(restored, held.message, AD).plaintext).toBe('delayed');
  });
});

describe('isSenderKeyMessage', () => {
  it('accepts a real message and rejects everything else', () => {
    const sender = createSenderKey();
    expect(isSenderKeyMessage(senderKeyEncrypt(sender, 'x', AD).message)).toBe(true);
    for (const bad of [null, undefined, 'x', 7, {}, {alg: 'other'}]) {
      expect(isSenderKeyMessage(bad)).toBe(false);
    }
  });
});
