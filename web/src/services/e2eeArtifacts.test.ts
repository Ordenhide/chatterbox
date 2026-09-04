import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  keypair: vi.fn(),
  peerKey: vi.fn(),
}));

vi.mock('./e2eeKeys', () => ({
  getOrCreateDeviceKeypair: (...a: unknown[]) => mocks.keypair(...a),
  getDeviceKeypairIfEnrolled: (...a: unknown[]) => mocks.keypair(...a),
  fetchPeerPublicKeyChecked: (...a: unknown[]) => mocks.peerKey(...a),
}));

import {generateKeypair} from './e2ee';
import {INERT_ARTIFACT_CRYPTO, makeArtifactCrypto, sealedField} from './e2eeArtifacts';

const CHAT = 'chat1';
const alice = generateKeypair();
const bob = generateKeypair();

beforeEach(() => {
  mocks.keypair.mockReset().mockResolvedValue(alice);
  mocks.peerKey.mockReset().mockResolvedValue({key: bob.publicKey, status: 'ok'});
});

describe('makeArtifactCrypto', () => {
  it('seals a value into an encrypted payload rather than leaving it readable', async () => {
    const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
    const sealed = crypto.seal('Weekend groceries');

    expect(crypto.active).toBe(true);
    expect(sealed).toBeTruthy();
    // The plaintext must not survive anywhere in what gets persisted.
    expect(JSON.stringify(sealed)).not.toContain('Weekend groceries');
  });

  it('round-trips through the peer, which is the whole point', async () => {
    const mine = await makeArtifactCrypto('alice', 'bob', CHAT);
    const sealed = mine.seal('Milk, eggs, bread');

    // Bob's client: his own secret, Alice's public key, same chat.
    mocks.keypair.mockResolvedValue(bob);
    mocks.peerKey.mockResolvedValue({key: alice.publicKey, status: 'ok'});
    const theirs = await makeArtifactCrypto('bob', 'alice', CHAT);

    expect(theirs.open('', sealed)).toBe('Milk, eggs, bread');
  });

  it('does not decrypt for a third party', async () => {
    const mine = await makeArtifactCrypto('alice', 'bob', CHAT);
    const sealed = mine.seal('private');

    const mallory = generateKeypair();
    mocks.keypair.mockResolvedValue(mallory);
    mocks.peerKey.mockResolvedValue({key: alice.publicKey, status: 'ok'});
    const theirs = await makeArtifactCrypto('mallory', 'alice', CHAT);

    // Falls back to the (empty) plaintext rather than yielding the content.
    expect(theirs.open('', sealed)).toBe('');
  });

  it('is chat-scoped: the same pair cannot read it from another chat', async () => {
    const mine = await makeArtifactCrypto('alice', 'bob', CHAT);
    const sealed = mine.seal('secret plan');

    mocks.keypair.mockResolvedValue(bob);
    mocks.peerKey.mockResolvedValue({key: alice.publicKey, status: 'ok'});
    const elsewhere = await makeArtifactCrypto('bob', 'alice', 'a-different-chat');

    expect(elsewhere.open('', sealed)).toBe('');
  });

  describe('backward compatibility', () => {
    it('reads legacy plaintext written before encryption existed', async () => {
      const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
      expect(crypto.open('old plaintext title', undefined)).toBe('old plaintext title');
    });

    it('prefers the encrypted value when both are present', async () => {
      const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
      const sealed = crypto.seal('the real title');
      expect(crypto.open('stale plaintext', sealed)).toBe('the real title');
    });

    it('falls back to plaintext when the payload cannot be decrypted', async () => {
      const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
      const junk = {alg: 'x25519-hkdf-xchacha20poly1305', body: 'zzz', senderKey: 'z', recipientKey: 'z'};
      expect(crypto.open('readable fallback', junk)).toBe('readable fallback');
    });

    it('returns an empty string rather than undefined for a missing field', async () => {
      const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
      expect(crypto.open(undefined, undefined)).toBe('');
    });
  });

  describe('degrading safely', () => {
    it('stays plaintext when the peer has never enrolled a key', async () => {
      mocks.peerKey.mockResolvedValue({key: null, status: 'missing'});
      const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);

      expect(crypto.active).toBe(false);
      expect(crypto.seal('anything')).toBeNull();
    });

    it('can still READ encrypted content when the peer key is missing', async () => {
      // Decryption needs only my own secret, so losing the peer's published
      // key must not make previously-sealed items unreadable.
      const mine = await makeArtifactCrypto('alice', 'bob', CHAT);
      const sealed = mine.seal('still readable');

      mocks.keypair.mockResolvedValue(bob);
      mocks.peerKey.mockResolvedValue({key: null, status: 'missing'});
      const degraded = await makeArtifactCrypto('bob', 'alice', CHAT);
      expect(degraded.open('', sealed)).toBe('still readable');
    });

    it('returns an inert crypto instead of throwing when keys are unavailable', async () => {
      mocks.keypair.mockRejectedValue(new Error('keystore locked'));
      const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
      expect(crypto.active).toBe(false);
      expect(crypto.seal('x')).toBeNull();
      expect(crypto.open('plain', undefined)).toBe('plain');
    });

    it('is inert without a peer — a chat with a deleted account still works', async () => {
      const crypto = await makeArtifactCrypto('alice', undefined, CHAT);
      expect(crypto).toBe(INERT_ARTIFACT_CRYPTO);
      expect(crypto.seal('x')).toBeNull();
    });

    it('never seals an empty value into a payload', async () => {
      const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
      expect(crypto.seal('')).toBeNull();
      expect(crypto.seal(undefined)).toBeNull();
    });
  });
});

describe('sealedField', () => {
  it('writes only the encrypted half when sealing succeeds', async () => {
    const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
    const out = sealedField(crypto, 'title', 'encryptedTitle', 'Groceries');

    expect(out.encryptedTitle).toBeTruthy();
    expect(out.title).toBe(''); // cleared, not left readable
    expect(JSON.stringify(out)).not.toContain('Groceries');
  });

  it('falls back to the plaintext half when there is no peer key', async () => {
    mocks.peerKey.mockResolvedValue({key: null, status: 'missing'});
    const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
    const out = sealedField(crypto, 'title', 'encryptedTitle', 'Groceries');

    expect(out).toEqual({title: 'Groceries'});
    // Firestore rejects undefined, so the unused key must be absent entirely.
    expect('encryptedTitle' in out).toBe(false);
  });

  it('never emits undefined for a missing value', async () => {
    mocks.peerKey.mockResolvedValue({key: null, status: 'missing'});
    const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
    expect(sealedField(crypto, 'title', 'encryptedTitle', undefined)).toEqual({title: ''});
  });
});
