import {
  computeSafetyNumber,
  decryptMessage,
  encryptMessage,
  E2EE_ALG,
  generateKeypair,
  isEncryptedPayload,
} from '../e2ee';
import {base64ToBytes, bytesToBase64} from '../crypto';

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
    // ChatScreen's encryptOutgoingMessage reuses encryptMessage/decryptMessage
    // unmodified for image/video/audio/file.uri: there is no separate "media"
    // code path in the crypto layer, only more fields it gets applied to.
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

  it('is independent of UIDs — it is not reproducible from the old fake scheme', () => {
    // Regression guard: the number must vary across key pairs even when we
    // hold "identity" constant, proving it cannot be the old UID-hash in
    // disguise (which only ever depended on two fixed strings, not keys).
    const alice = generateKeypair();
    const bobKey1 = generateKeypair();
    const bobKey2 = generateKeypair(); // e.g. bob reinstalled and got a new keypair
    expect(computeSafetyNumber(alice.publicKey, bobKey1.publicKey)).not.toBe(
      computeSafetyNumber(alice.publicKey, bobKey2.publicKey),
    );
  });

  it('formats as five space-separated 5-digit groups', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const sn = computeSafetyNumber(alice.publicKey, bob.publicKey);
    expect(sn).toMatch(/^\d{5} \d{5} \d{5} \d{5} \d{5}$/);
  });
});
