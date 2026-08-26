import {
  MAX_SKIP,
  kdfChain,
  deserializeSession,
  generateRatchetKeypair,
  initSessionAsInitiator,
  initSessionAsResponder,
  isRatchetMessage,
  ratchetDecrypt,
  ratchetEncrypt,
  serializeSession,
  type RatchetMessage,
  type RatchetSession,
} from '../doubleRatchet';
import {bytesToBase64, secureRandomBytes, utf8ToBytes} from '../../crypto';

/**
 * A pair of sessions sharing a secret, as X3DH would have produced.
 * Alice is the initiator (she can send immediately); Bob holds the signed
 * prekey Alice used and cannot send until he has received.
 */
function pair(): {alice: RatchetSession; bob: RatchetSession} {
  const sharedSecret = secureRandomBytes(32);
  const bobSignedPreKey = generateRatchetKeypair();
  return {
    alice: initSessionAsInitiator(sharedSecret, bobSignedPreKey.publicKey),
    bob: initSessionAsResponder(sharedSecret, bobSignedPreKey),
  };
}

const AD = utf8ToBytes('alice|bob|chat1');

describe('a single conversation', () => {
  it('carries a message from the initiator to the responder', () => {
    let {alice, bob} = pair();
    const sent = ratchetEncrypt(alice, 'hello', AD);
    alice = sent.session;
    const got = ratchetDecrypt(bob, sent.message, AD);
    expect(got.plaintext).toBe('hello');
  });

  it('lets the conversation turn around repeatedly', () => {
    let {alice, bob} = pair();
    for (let round = 0; round < 5; round++) {
      const a = ratchetEncrypt(alice, `a${round}`, AD);
      alice = a.session;
      const gotA = ratchetDecrypt(bob, a.message, AD);
      bob = gotA.session;
      expect(gotA.plaintext).toBe(`a${round}`);

      const b = ratchetEncrypt(bob, `b${round}`, AD);
      bob = b.session;
      const gotB = ratchetDecrypt(alice, b.message, AD);
      alice = gotB.session;
      expect(gotB.plaintext).toBe(`b${round}`);
    }
  });

  it('handles a run of messages in one direction without a reply', () => {
    let {alice, bob} = pair();
    for (let i = 0; i < 20; i++) {
      const sent = ratchetEncrypt(alice, `msg${i}`, AD);
      alice = sent.session;
      const got = ratchetDecrypt(bob, sent.message, AD);
      bob = got.session;
      expect(got.plaintext).toBe(`msg${i}`);
    }
  });
});

describe('forward secrecy', () => {
  it('never reuses a message key', () => {
    // The property in its most direct observable form: encrypting the same
    // plaintext repeatedly must never produce the same ciphertext, because
    // the chain key — and so the message key — has moved on.
    let {alice} = pair();
    const bodies = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const sent = ratchetEncrypt(alice, 'identical plaintext', AD);
      alice = sent.session;
      bodies.add(sent.message.body);
    }
    expect(bodies.size).toBe(25);
  });

  it('advances the chain key on every message', () => {
    let {alice} = pair();
    const chainKeys = new Set<string>();
    for (let i = 0; i < 10; i++) {
      chainKeys.add(bytesToBase64(alice.cks!));
      alice = ratchetEncrypt(alice, 'x', AD).session;
    }
    expect(chainKeys.size).toBe(10);
  });

  it('leaves an old message undecryptable from a later session state', () => {
    // The whole point. Capture message 0, let the chain run on, then hand an
    // attacker the *current* state and confirm it cannot open message 0.
    let {alice, bob} = pair();
    const first = ratchetEncrypt(alice, 'the secret', AD);
    alice = first.session;

    let advancedBob = ratchetDecrypt(bob, first.message, AD).session;
    for (let i = 0; i < 5; i++) {
      const sent = ratchetEncrypt(alice, `later ${i}`, AD);
      alice = sent.session;
      advancedBob = ratchetDecrypt(advancedBob, sent.message, AD).session;
    }

    // advancedBob is the full compromised state, skipped keys included.
    expect(() => ratchetDecrypt(advancedBob, first.message, AD)).toThrow();
  });
});

describe('the chain KDF', () => {
  it('domain-separates the message key from the next chain key', () => {
    // If these were the same value, learning one message key would hand an
    // attacker the chain key for every message after it. Nothing observable
    // at the message level changes when they collide — both sides still agree
    // and every key still looks distinct — so this has to be asserted here.
    const ck = secureRandomBytes(32);
    const {ck: nextCk, mk} = kdfChain(ck);
    expect(bytesToBase64(mk)).not.toBe(bytesToBase64(nextCk));
    expect(bytesToBase64(mk)).not.toBe(bytesToBase64(ck));
    expect(bytesToBase64(nextCk)).not.toBe(bytesToBase64(ck));
  });

  it('is deterministic', () => {
    const ck = secureRandomBytes(32);
    const a = kdfChain(ck);
    const b = kdfChain(ck);
    expect(bytesToBase64(a.mk)).toBe(bytesToBase64(b.mk));
    expect(bytesToBase64(a.ck)).toBe(bytesToBase64(b.ck));
  });

  it('does not let a message key reproduce the chain it came from', () => {
    // Forward secrecy, stated over the KDF rather than over messages: the
    // message key must not be a usable chain key for the same position.
    const ck = secureRandomBytes(32);
    const {mk} = kdfChain(ck);
    const fromMk = kdfChain(mk);
    const real = kdfChain(kdfChain(ck).ck);
    expect(bytesToBase64(fromMk.mk)).not.toBe(bytesToBase64(real.mk));
  });
});

describe('out-of-order and missing messages', () => {
  it('decrypts messages that arrive in reverse order', () => {
    let {alice, bob} = pair();
    const messages: RatchetMessage[] = [];
    for (let i = 0; i < 5; i++) {
      const sent = ratchetEncrypt(alice, `m${i}`, AD);
      alice = sent.session;
      messages.push(sent.message);
    }
    const seen: string[] = [];
    for (const message of [...messages].reverse()) {
      const got = ratchetDecrypt(bob, message, AD);
      bob = got.session;
      seen.push(got.plaintext);
    }
    expect(seen).toEqual(['m4', 'm3', 'm2', 'm1', 'm0']);
  });

  it('still delivers a message that arrives after the chain moved on', () => {
    let {alice, bob} = pair();
    const held = ratchetEncrypt(alice, 'delayed', AD);
    alice = held.session;
    const next = ratchetEncrypt(alice, 'arrived first', AD);
    alice = next.session;

    const gotNext = ratchetDecrypt(bob, next.message, AD);
    bob = gotNext.session;
    expect(gotNext.plaintext).toBe('arrived first');

    const gotHeld = ratchetDecrypt(bob, held.message, AD);
    expect(gotHeld.plaintext).toBe('delayed');
  });

  it('bridges a gap that spans a conversation turn', () => {
    // The case the `pn` header field exists for: Alice's earlier chain has
    // unreceived messages when Bob's reply starts a new one.
    let {alice, bob} = pair();
    const a0 = ratchetEncrypt(alice, 'a0', AD);
    alice = a0.session;
    const a1 = ratchetEncrypt(alice, 'a1', AD);
    alice = a1.session;

    // Bob receives only a1, so a0 is skipped, then replies.
    bob = ratchetDecrypt(bob, a1.message, AD).session;
    const b0 = ratchetEncrypt(bob, 'b0', AD);
    bob = b0.session;
    alice = ratchetDecrypt(alice, b0.message, AD).session;

    // a0 finally turns up, after Bob has ratcheted forward.
    expect(ratchetDecrypt(bob, a0.message, AD).plaintext).toBe('a0');
  });

  it('refuses a header claiming an absurd jump instead of grinding the KDF', () => {
    // Without the bound this is a remote denial of service: one forged header
    // asks the recipient to run the KDF billions of times.
    const {alice, bob} = pair();
    const sent = ratchetEncrypt(alice, 'hi', AD);
    const forged: RatchetMessage = {
      ...sent.message,
      header: {...sent.message.header, n: MAX_SKIP + 5000},
    };
    expect(() => ratchetDecrypt(bob, forged, AD)).toThrow(/refusing to skip/);
  });
});

describe('tampering', () => {
  it('rejects a modified ciphertext', () => {
    const {alice, bob} = pair();
    const sent = ratchetEncrypt(alice, 'hello', AD);
    const flipped = [...sent.message.body];
    flipped[10] = flipped[10] === 'A' ? 'B' : 'A';
    expect(() =>
      ratchetDecrypt(bob, {...sent.message, body: flipped.join('')}, AD),
    ).toThrow();
  });

  it('rejects a message whose header has been altered', () => {
    // The header is authenticated as associated data, so renumbering a
    // message an attacker cannot read still invalidates it.
    const {alice, bob} = pair();
    const sent = ratchetEncrypt(alice, 'hello', AD);
    const renumbered: RatchetMessage = {
      ...sent.message,
      header: {...sent.message.header, pn: 7},
    };
    expect(() => ratchetDecrypt(bob, renumbered, AD)).toThrow();
  });

  it('rejects a message replayed into a different conversation', () => {
    // Different AD (a different chat id) must not authenticate, or a
    // ciphertext could be transplanted between conversations.
    const {alice, bob} = pair();
    const sent = ratchetEncrypt(alice, 'hello', AD);
    expect(() => ratchetDecrypt(bob, sent.message, utf8ToBytes('alice|bob|chat2'))).toThrow();
  });
});

describe('session integrity', () => {
  it('leaves the caller session untouched when a decrypt fails', () => {
    // The reason every operation is pure. A mutating implementation would
    // advance the receiving chain and then throw, leaving the session past a
    // message it never delivered and every later message undecryptable.
    let {alice, bob} = pair();
    const good = ratchetEncrypt(alice, 'first', AD);
    alice = good.session;

    const before = serializeSession(bob);
    expect(() => ratchetDecrypt(bob, {...good.message, body: 'AAAA'}, AD)).toThrow();
    expect(serializeSession(bob)).toBe(before);

    // And the real message still decrypts afterwards.
    expect(ratchetDecrypt(bob, good.message, AD).plaintext).toBe('first');
  });

  it('survives a serialize/deserialize round trip mid-conversation', () => {
    // Sessions must outlive an app restart; a session that only lived in
    // memory would silently reset the ratchet on every cold start.
    let {alice, bob} = pair();
    const a0 = ratchetEncrypt(alice, 'before restart', AD);
    alice = a0.session;
    bob = ratchetDecrypt(bob, a0.message, AD).session;

    alice = deserializeSession(serializeSession(alice));
    bob = deserializeSession(serializeSession(bob));

    const b0 = ratchetEncrypt(bob, 'after restart', AD);
    bob = b0.session;
    expect(ratchetDecrypt(alice, b0.message, AD).plaintext).toBe('after restart');
  });

  it('round-trips a session carrying skipped keys', () => {
    let {alice, bob} = pair();
    const held = ratchetEncrypt(alice, 'delayed', AD);
    alice = held.session;
    const next = ratchetEncrypt(alice, 'first', AD);
    alice = next.session;
    bob = ratchetDecrypt(bob, next.message, AD).session;
    expect(bob.skipped.size).toBe(1);

    const restored = deserializeSession(serializeSession(bob));
    expect(restored.skipped.size).toBe(1);
    expect(ratchetDecrypt(restored, held.message, AD).plaintext).toBe('delayed');
  });

  it('refuses to send before a responder has anything to send on', () => {
    const {bob} = pair();
    expect(() => ratchetEncrypt(bob, 'too early', AD)).toThrow(/no sending chain/);
  });
});

describe('history is not re-readable', () => {
  /**
   * Forward secrecy working as designed, recorded here because a *caller* can
   * so easily assume otherwise. Firestore keeps every envelope forever, which
   * makes it natural to treat the collection as the message store and decrypt
   * it again on each read — and that does work for the stateless envelopes in
   * services/e2ee.ts.
   *
   * It cannot work here: the message key is destroyed as it is used. Any UI
   * that re-decrypts a thread it has already shown will get failures for
   * everything already read, and ChatScreen's caches are per-mount `useRef`s,
   * so a remount does exactly that. A client that wants scrollback has to keep
   * the plaintext itself — once the key is gone there is nothing left to
   * recover it from.
   */
  it('cannot decrypt the same message twice', () => {
    let {alice, bob} = pair();
    const sent = ratchetEncrypt(alice, 'read once', AD);
    alice = sent.session;

    const first = ratchetDecrypt(bob, sent.message, AD);
    expect(first.plaintext).toBe('read once');
    // Round-tripped through storage, as the session store does between reads.
    bob = deserializeSession(serializeSession(first.session));

    expect(() => ratchetDecrypt(bob, sent.message, AD)).toThrow();
  });

  it('consumes a skipped key on use, so a delayed message is also read once', () => {
    let {alice, bob} = pair();
    const held = ratchetEncrypt(alice, 'delayed', AD);
    alice = held.session;
    const next = ratchetEncrypt(alice, 'first', AD);
    alice = next.session;
    bob = ratchetDecrypt(bob, next.message, AD).session;
    expect(bob.skipped.size).toBe(1);

    const caught = ratchetDecrypt(bob, held.message, AD);
    expect(caught.plaintext).toBe('delayed');
    expect(caught.session.skipped.size).toBe(0);
    expect(() => ratchetDecrypt(caught.session, held.message, AD)).toThrow();
  });
});

describe('isRatchetMessage', () => {
  it('accepts a real message and rejects everything else', () => {
    const {alice} = pair();
    expect(isRatchetMessage(ratchetEncrypt(alice, 'x', AD).message)).toBe(true);
    for (const bad of [null, undefined, 'x', 42, {}, {alg: 'other'}, {alg: 'chatterbox-double-ratchet-v1'}]) {
      expect(isRatchetMessage(bad)).toBe(false);
    }
  });
});
