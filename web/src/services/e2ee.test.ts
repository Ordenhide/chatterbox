import {describe, expect, it} from 'vitest';
import {
  computeSafetyNumber,
  decryptMessage,
  encryptMessage,
  E2EE_ALG,
  generateKeypair,
  isEncryptedPayload,
  isSealed,
  isSealedEnvelope,
  MAX_GROUP_MEMBERS,
  openSealed,
  openEnvelope,
  sealForRecipients,
} from './e2ee';
import {base64ToBytes, bytesToBase64, KEY_BYTES, NONCE_BYTES} from './crypto';

// e2ee.ts and crypto.ts are verbatim ports of the mobile app's originals (see
// their module docs) — this suite mirrors src/services/__tests__/e2ee.test.ts
// so both platforms are proven to agree on the same envelope shape, not just
// internally self-consistent.

const CHAT = 'chat-abc123';

describe('keypair generation', () => {
  it('produces 32-byte keys', () => {
    const {secretKey, publicKey} = generateKeypair();
    expect(secretKey).toHaveLength(32);
    expect(publicKey).toHaveLength(32);
  });

  it('is different every time', () => {
    const a = bytesToBase64(generateKeypair().secretKey);
    const b = bytesToBase64(generateKeypair().secretKey);
    expect(a).not.toBe(b);
  });
});

describe('message round-trip', () => {
  it('the recipient can read what the sender sealed', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('meet me at 8', alice.secretKey, bob.publicKey, CHAT);
    expect(decryptMessage(payload, bob.secretKey, CHAT)).toBe('meet me at 8');
  });

  it('the sender can also read their own message back', () => {
    // X25519 is symmetric, so this works without storing a second copy.
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('my own message', alice.secretKey, bob.publicKey, CHAT);
    expect(decryptMessage(payload, alice.secretKey, CHAT)).toBe('my own message');
  });

  it('handles non-ASCII and emoji', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    for (const text of ['你好世界', '🔐🎈 secret', 'mixed 中文 and ascii']) {
      const payload = encryptMessage(text, alice.secretKey, bob.publicKey, CHAT);
      expect(decryptMessage(payload, bob.secretKey, CHAT)).toBe(text);
    }
  });

  it('seals media as readily as text — a Storage URL or a data URI is just a string to this layer', () => {
    // ChatPane's encryptOutgoingMessage reuses encryptMessage/decryptMessage
    // unmodified for image/audio/file.uri: there is no separate "media" code
    // path in the crypto layer, only more fields it gets applied to.
    const alice = generateKeypair();
    const bob = generateKeypair();
    const values = [
      'https://firebasestorage.googleapis.com/v0/b/x/o/chats%2Fc1%2Fphoto.jpg?alt=media&token=secret-bearer-token',
      'data:audio/mp4;base64,AAAABBBBCCCCDDDD====',
    ];
    for (const value of values) {
      const payload = encryptMessage(value, alice.secretKey, bob.publicKey, CHAT);
      expect(decryptMessage(payload, bob.secretKey, CHAT)).toBe(value);
      // The whole point of sealing the URL: the bearer token must not appear
      // in what gets persisted to Firestore.
      expect(JSON.stringify(payload)).not.toContain(value);
    }
  });
});

describe('security properties', () => {
  it('the server sees no plaintext', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const secret = 'THE_NUCLEAR_CODES';
    const payload = encryptMessage(secret, alice.secretKey, bob.publicKey, CHAT);

    // Everything that would be persisted to Firestore:
    const stored = JSON.stringify(payload);
    expect(stored).not.toContain(secret);

    // ...and the raw ciphertext bytes don't contain it either.
    const needle = Array.from(secret).map(c => c.charCodeAt(0));
    const hay = Array.from(base64ToBytes(payload.body));
    const found = hay.some((_, i) => needle.every((b, j) => hay[i + j] === b));
    expect(found).toBe(false);
  });

  it('a third party holding neither secret key cannot decrypt', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const eve = generateKeypair();
    const payload = encryptMessage('private', alice.secretKey, bob.publicKey, CHAT);
    expect(() => decryptMessage(payload, eve.secretKey, CHAT)).toThrow();
  });

  it('the same plaintext encrypts differently each time', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const a = encryptMessage('same', alice.secretKey, bob.publicKey, CHAT);
    const b = encryptMessage('same', alice.secretKey, bob.publicKey, CHAT);
    expect(a.body).not.toBe(b.body);
  });

  it('keys are bound to the conversation — a payload will not decrypt in another chat', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('chat-scoped', alice.secretKey, bob.publicKey, CHAT);
    expect(() => decryptMessage(payload, bob.secretKey, 'a-different-chat')).toThrow();
  });

  it('detects tampering with the ciphertext', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('original', alice.secretKey, bob.publicKey, CHAT);
    const bytes = base64ToBytes(payload.body);
    bytes[bytes.length - 1] ^= 0xff;
    expect(() =>
      decryptMessage({...payload, body: bytesToBase64(bytes)}, bob.secretKey, CHAT),
    ).toThrow();
  });

  it('rejects an unknown algorithm rather than guessing', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('x', alice.secretKey, bob.publicKey, CHAT);
    expect(() =>
      decryptMessage({...payload, alg: 'rot13' as never}, bob.secretKey, CHAT),
    ).toThrow(/unsupported e2ee algorithm/);
  });
});

describe('isEncryptedPayload', () => {
  it('recognises a real envelope', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    expect(isEncryptedPayload(encryptMessage('x', alice.secretKey, bob.publicKey, CHAT))).toBe(true);
  });

  it('rejects plaintext and malformed values', () => {
    expect(isEncryptedPayload('just a string')).toBe(false);
    expect(isEncryptedPayload(null)).toBe(false);
    expect(isEncryptedPayload(undefined)).toBe(false);
    expect(isEncryptedPayload({})).toBe(false);
    expect(isEncryptedPayload({alg: E2EE_ALG})).toBe(false);
    expect(isEncryptedPayload({alg: 'other', body: 'x', senderKey: 'y', recipientKey: 'z'})).toBe(
      false,
    );
    // Missing recipientKey: an envelope in the old single-key shape must not
    // be treated as decryptable, since the sender could not read it back.
    expect(isEncryptedPayload({alg: E2EE_ALG, body: 'x', senderKey: 'y'})).toBe(false);
  });
});

describe('computeSafetyNumber', () => {
  it('both participants derive the same number regardless of argument order', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    expect(computeSafetyNumber(alice.publicKey, bob.publicKey)).toBe(
      computeSafetyNumber(bob.publicKey, alice.publicKey),
    );
  });

  it('changes if either key changes (detects a substituted/MITM key)', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const eve = generateKeypair();
    const real = computeSafetyNumber(alice.publicKey, bob.publicKey);
    const tampered = computeSafetyNumber(alice.publicKey, eve.publicKey);
    expect(tampered).not.toBe(real);
  });

  it('is deterministic for the same key pair', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    expect(computeSafetyNumber(alice.publicKey, bob.publicKey)).toBe(
      computeSafetyNumber(alice.publicKey, bob.publicKey),
    );
  });

  it('formats as five space-separated 5-digit groups', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const sn = computeSafetyNumber(alice.publicKey, bob.publicKey);
    expect(sn).toMatch(/^\d{5} \d{5} \d{5} \d{5} \d{5}$/);
  });
});

describe('mobile/web interop', () => {
  // e2ee.ts and crypto.ts are manually kept in sync as verbatim copies (no
  // shared package between the two apps) — the actual interop guarantee is
  // that the algorithm code is identical, not something a runtime test can
  // independently prove. What a test *can* catch is the algorithm identifier
  // or a cipher parameter silently drifting between the two copies, since
  // that's exactly the kind of edit that's easy to make in one file and
  // forget in the other.
  it('uses the same algorithm identifier and cipher parameters as the mobile client', () => {
    expect(E2EE_ALG).toBe('x25519-xchacha20poly1305-v1');
    expect(KEY_BYTES).toBe(32);
    expect(NONCE_BYTES).toBe(24);
  });
});

describe('sealForRecipients / openEnvelope (group fan-out)', () => {
  const CHAT = 'group-chat-1';

  function member(uid: string) {
    const keypair = generateKeypair();
    return {uid, keypair, recipient: {uid, publicKey: keypair.publicKey}};
  }

  it('lets every addressed member read the message', () => {
    const sender = member('alice');
    const bob = member('bob');
    const carol = member('carol');
    const envelope = sealForRecipients(
      'dinner at 8?',
      sender.keypair.secretKey,
      [bob.recipient, carol.recipient],
      CHAT,
    );
    expect(openEnvelope(envelope, bob.keypair.secretKey, 'bob', CHAT)).toBe('dinner at 8?');
    expect(openEnvelope(envelope, carol.keypair.secretKey, 'carol', CHAT)).toBe('dinner at 8?');
  });

  it('lets the sender read their own message despite having no copy', () => {
    const sender = member('alice');
    const bob = member('bob');
    const envelope = sealForRecipients('hi', sender.keypair.secretKey, [bob.recipient], CHAT);
    expect(envelope.copies.alice).toBeUndefined();
    expect(openEnvelope(envelope, sender.keypair.secretKey, 'alice', CHAT)).toBe('hi');
  });

  // The property the entire fan-out design rests on: removal is just not
  // addressing someone, so there is no key rotation to get wrong.
  it('makes a removed member unable to read anything sealed after removal', () => {
    const sender = member('alice');
    const bob = member('bob');
    const removed = member('mallory');
    const envelope = sealForRecipients('secret plans', sender.keypair.secretKey, [bob.recipient], CHAT);
    expect(() => openEnvelope(envelope, removed.keypair.secretKey, 'mallory', CHAT)).toThrow();
  });

  it('does not let an outsider read by guessing another member uid', () => {
    const sender = member('alice');
    const bob = member('bob');
    const outsider = member('eve');
    const envelope = sealForRecipients('hi', sender.keypair.secretKey, [bob.recipient], CHAT);
    expect(() => openEnvelope(envelope, outsider.keypair.secretKey, 'bob', CHAT)).toThrow();
  });

  it('binds ciphertext to the chat, so a copy lifted into another chat fails', () => {
    const sender = member('alice');
    const bob = member('bob');
    const envelope = sealForRecipients('hi', sender.keypair.secretKey, [bob.recipient], CHAT);
    expect(() => openEnvelope(envelope, bob.keypair.secretKey, 'bob', 'other-chat')).toThrow();
  });

  // Must match mobile exactly: both clients seal into the same documents, so a
  // client with a higher cap would produce envelopes the other refuses to send.
  it('enforces the same member cap as mobile', () => {
    const sender = member('alice');
    const tooMany = Array.from({length: MAX_GROUP_MEMBERS + 1}, (_, i) => member(`u${i}`).recipient);
    expect(() => sealForRecipients('x', sender.keypair.secretKey, tooMany, CHAT)).toThrow(
      /exceeds the 32 cap/,
    );
  });

  it('rejects an empty recipient list instead of sealing an unreadable message', () => {
    expect(() => sealForRecipients('x', generateKeypair().secretKey, [], CHAT)).toThrow();
  });
});

describe('isSealedEnvelope', () => {
  // Both shapes coexist in Firestore during and after the 1:1 rollout, so the
  // reader has to tell them apart without guessing.
  it('recognises a real envelope but not a single 1:1 payload', () => {
    const sender = generateKeypair();
    const bob = generateKeypair();
    const envelope = sealForRecipients('x', sender.secretKey, [{uid: 'bob', publicKey: bob.publicKey}], 'c');
    expect(isSealedEnvelope(envelope)).toBe(true);
    expect(isSealedEnvelope(encryptMessage('x', sender.secretKey, bob.publicKey, 'c'))).toBe(false);
  });

  it('rejects plaintext, null and malformed copies', () => {
    expect(isSealedEnvelope(null)).toBe(false);
    expect(isSealedEnvelope('hello')).toBe(false);
    expect(isSealedEnvelope({alg: E2EE_ALG, copies: {bob: {nope: 1}}})).toBe(false);
  });
});

describe('isSealed / openSealed (shape-agnostic reader)', () => {
  const C = 'c1';

  // A reader recognising only one shape renders the other as an empty message.
  // That failure is cross-platform: mobile seals envelopes, so a browser still
  // checking only the pre-group shape would silently blank every group message.
  it('reads both the pre-group payload and the fan-out envelope', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();

    const legacy = encryptMessage('old', alice.secretKey, bob.publicKey, C);
    const envelope = sealForRecipients('new', alice.secretKey, [{uid: 'bob', publicKey: bob.publicKey}], C);

    expect(isSealed(legacy)).toBe(true);
    expect(isSealed(envelope)).toBe(true);
    expect(openSealed(legacy, bob.secretKey, 'bob', C)).toBe('old');
    expect(openSealed(envelope, bob.secretKey, 'bob', C)).toBe('new');
  });

  it('rejects plaintext rather than treating it as sealed', () => {
    expect(isSealed('plain text')).toBe(false);
    expect(isSealed(null)).toBe(false);
    expect(isSealed({})).toBe(false);
    expect(() => openSealed('plain', generateKeypair().secretKey, 'me', C)).toThrow(/not sealed/);
  });
});
