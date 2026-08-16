import {
  computeSafetyNumber,
  decryptMessage,
  diagnoseSealed,
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

  // The sender gets no copy of their own — X25519's symmetry means they can
  // derive against any copy's recipientKey instead.
  it('lets the sender read their own message despite having no copy', () => {
    const sender = member('alice');
    const bob = member('bob');
    const envelope = sealForRecipients('hi', sender.keypair.secretKey, [bob.recipient], CHAT);

    expect(envelope.copies.alice).toBeUndefined();
    expect(openEnvelope(envelope, sender.keypair.secretKey, 'alice', CHAT)).toBe('hi');
  });

  // The property the entire fan-out design rests on: removing someone is just
  // not addressing them. No key rotation, so no silent-failure window.
  it('makes a removed member unable to read anything sealed after removal', () => {
    const sender = member('alice');
    const bob = member('bob');
    const removed = member('mallory');

    const envelope = sealForRecipients(
      'secret plans',
      sender.keypair.secretKey,
      [bob.recipient], // mallory simply not included
      CHAT,
    );

    expect(() => openEnvelope(envelope, removed.keypair.secretKey, 'mallory', CHAT)).toThrow();
  });

  it('does not let an outsider read by guessing another member\'s uid', () => {
    const sender = member('alice');
    const bob = member('bob');
    const outsider = member('eve');

    const envelope = sealForRecipients('hi', sender.keypair.secretKey, [bob.recipient], CHAT);
    // Claiming to be bob does not help — eve still holds the wrong secret key.
    expect(() => openEnvelope(envelope, outsider.keypair.secretKey, 'bob', CHAT)).toThrow();
  });

  it('produces one independently-decryptable copy per recipient', () => {
    const sender = member('alice');
    const members = ['b', 'c', 'd'].map(member);
    const envelope = sealForRecipients(
      'x',
      sender.keypair.secretKey,
      members.map(m => m.recipient),
      CHAT,
    );

    expect(Object.keys(envelope.copies).sort()).toEqual(['b', 'c', 'd']);
    // Each copy opens with the plain 1:1 decryptMessage — group adds
    // distribution, not a second cipher.
    for (const m of members) {
      expect(decryptMessage(envelope.copies[m.uid], m.keypair.secretKey, CHAT)).toBe('x');
    }
  });

  it('binds ciphertext to the chat, so a copy lifted into another chat fails', () => {
    const sender = member('alice');
    const bob = member('bob');
    const envelope = sealForRecipients('hi', sender.keypair.secretKey, [bob.recipient], CHAT);

    expect(() => openEnvelope(envelope, bob.keypair.secretKey, 'bob', 'other-chat')).toThrow();
  });

  it('enforces the member cap rather than silently sealing an oversized group', () => {
    const sender = member('alice');
    const tooMany = Array.from({length: MAX_GROUP_MEMBERS + 1}, (_, i) => member(`u${i}`).recipient);

    expect(() => sealForRecipients('x', sender.keypair.secretKey, tooMany, CHAT)).toThrow(
      /exceeds the 32 cap/,
    );
    // Exactly at the cap is allowed.
    expect(() =>
      sealForRecipients('x', sender.keypair.secretKey, tooMany.slice(0, MAX_GROUP_MEMBERS), CHAT),
    ).not.toThrow();
  });

  it('rejects an empty recipient list instead of sealing an unreadable message', () => {
    expect(() => sealForRecipients('x', generateKeypair().secretKey, [], CHAT)).toThrow();
  });
});

describe('isSealedEnvelope', () => {
  it('recognises a real envelope', () => {
    const sender = generateKeypair();
    const bob = generateKeypair();
    const envelope = sealForRecipients('x', sender.secretKey, [{uid: 'bob', publicKey: bob.publicKey}], 'c');
    expect(isSealedEnvelope(envelope)).toBe(true);
  });

  // Both shapes coexist in Firestore during and after the 1:1 rollout, so the
  // reader has to tell them apart without guessing.
  it('does not confuse a single 1:1 payload for an envelope', () => {
    const sender = generateKeypair();
    const bob = generateKeypair();
    expect(isSealedEnvelope(encryptMessage('x', sender.secretKey, bob.publicKey, 'c'))).toBe(false);
  });

  it('rejects plaintext, null and malformed copies', () => {
    expect(isSealedEnvelope(null)).toBe(false);
    expect(isSealedEnvelope('hello')).toBe(false);
    expect(isSealedEnvelope({alg: E2EE_ALG, copies: {bob: {nope: 1}}})).toBe(false);
  });
});

describe('isSealed / openSealed (shape-agnostic reader)', () => {
  const CHAT = 'c1';

  it('reads a pre-group single payload', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('old', alice.secretKey, bob.publicKey, CHAT);

    expect(isSealed(payload)).toBe(true);
    expect(openSealed(payload, bob.secretKey, 'bob', CHAT)).toBe('old');
  });

  it('reads a fan-out envelope', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const envelope = sealForRecipients('new', alice.secretKey, [{uid: 'bob', publicKey: bob.publicKey}], CHAT);

    expect(isSealed(envelope)).toBe(true);
    expect(openSealed(envelope, bob.secretKey, 'bob', CHAT)).toBe('new');
  });

  // The bug this pair exists to prevent: a reader that recognised only one
  // shape would render the other as an empty message rather than failing loudly.
  it('recognises both shapes and rejects plaintext', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    expect(isSealed(encryptMessage('x', alice.secretKey, bob.publicKey, CHAT))).toBe(true);
    expect(isSealed(sealForRecipients('x', alice.secretKey, [{uid: 'b', publicKey: bob.publicKey}], CHAT))).toBe(true);
    expect(isSealed('plain text')).toBe(false);
    expect(isSealed(null)).toBe(false);
    expect(isSealed({})).toBe(false);
  });

  it('throws on a value that is not sealed at all', () => {
    expect(() => openSealed('plain', generateKeypair().secretKey, 'me', CHAT)).toThrow(/not sealed/);
  });
});

describe('diagnoseSealed', () => {
  // The distinction that matters to a user: "find your recovery phrase" vs
  // "this message is gone". Both surface as the same thrown auth-tag failure
  // out of openSealed, so nothing downstream can tell them apart without this.
  const CAROL_UID = 'carol';

  it('reports wrong-key when the message was sealed to another device of mine', () => {
    const alice = generateKeypair();
    const bobPhone = generateKeypair();
    const bobLaptop = generateKeypair();

    const payload = encryptMessage('sent to the phone', alice.secretKey, bobPhone.publicKey, CHAT);

    // The laptop cannot open it, and the reason is recoverable.
    expect(() => decryptMessage(payload, bobLaptop.secretKey, CHAT)).toThrow();
    expect(diagnoseSealed(payload, bobLaptop.publicKey, 'bob')).toBe('wrong-key');
    // ...whereas the phone's own key is correctly not blamed.
    expect(diagnoseSealed(payload, bobPhone.publicKey, 'bob')).toBe('corrupt');
  });

  it('reports corrupt when my key is right but the body is damaged', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('intact', alice.secretKey, bob.publicKey, CHAT);
    const damaged = {...payload, body: bytesToBase64(new Uint8Array(48))};

    expect(() => decryptMessage(damaged, bob.secretKey, CHAT)).toThrow();
    expect(diagnoseSealed(damaged, bob.publicKey, 'bob')).toBe('corrupt');
  });

  it('blames the copy addressed to me, not some other member of the group', () => {
    const alice = generateKeypair();
    const bobOld = generateKeypair();
    const bobNew = generateKeypair();
    const carol = generateKeypair();

    const envelope = sealForRecipients('group message', alice.secretKey, [
      {uid: 'bob', publicKey: bobOld.publicKey},
      {uid: CAROL_UID, publicKey: carol.publicKey},
    ], CHAT);

    // Bob's new device holds a key no copy names -> recoverable.
    expect(diagnoseSealed(envelope, bobNew.publicKey, 'bob')).toBe('wrong-key');
    // Carol's copy exists and names her key, so hers would be genuine damage.
    expect(diagnoseSealed(envelope, carol.publicKey, CAROL_UID)).toBe('corrupt');
  });

  it('does not blame the sender, who has no copy of their own', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const envelope = sealForRecipients('mine', alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
    ], CHAT);

    // Alice is not in `copies` at all but every copy names her as senderKey,
    // and openEnvelope's fallback does let her read it — so a failure here
    // would be damage, not a missing key.
    expect(openEnvelope(envelope, alice.secretKey, 'alice', CHAT)).toBe('mine');
    expect(diagnoseSealed(envelope, alice.publicKey, 'alice')).toBe('corrupt');
  });

  it('recognises a newer algorithm rather than calling it unsealed', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const future = {...encryptMessage('x', alice.secretKey, bob.publicKey, CHAT), alg: 'x25519-future-v2'};

    // isSealed deliberately rejects it — a reader must not open what it does
    // not understand — but the diagnosis must still say why.
    expect(isSealed(future)).toBe(false);
    expect(diagnoseSealed(future, bob.publicKey, 'bob')).toBe('unsupported-algorithm');
  });

  it('reports not-sealed for plaintext and junk', () => {
    const {publicKey} = generateKeypair();
    expect(diagnoseSealed('hello', publicKey, 'me')).toBe('not-sealed');
    expect(diagnoseSealed(null, publicKey, 'me')).toBe('not-sealed');
    expect(diagnoseSealed({}, publicKey, 'me')).toBe('not-sealed');
    expect(diagnoseSealed({alg: E2EE_ALG, copies: {}}, publicKey, 'me')).toBe('not-sealed');
  });
});
