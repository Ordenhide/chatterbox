// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockKeypair = jest.fn();
const mockPeerKey = jest.fn();

jest.mock('../e2eeKeys', () => ({
  getOrCreateDeviceKeypair: (...a: unknown[]) => mockKeypair(...a),
  getDeviceKeypairIfEnrolled: (...a: unknown[]) => mockKeypair(...a),
  fetchPeerPublicKeyChecked: (...a: unknown[]) => mockPeerKey(...a),
}));
// transcription.ts reaches the callable and the consent store at import time.
// Nothing here calls either — the function under test is pure.
jest.mock('../firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => () => {
    throw new Error('not used in this test');
  },
}));
jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

import {generateKeypair} from '../e2ee';
import {INERT_ARTIFACT_CRYPTO, makeArtifactCrypto} from '../e2eeArtifacts';
import {buildTranscriptionPatch} from '../transcription';

/**
 * A transcript is the message, rendered readable.
 *
 * The Cloud Function used to write it straight into the message document,
 * which left a permanent plaintext copy of a voice note beside its own
 * ciphertext — and made "we cannot read your messages" false for every message
 * anyone had ever transcribed. The function now returns it and this patch
 * stores it, sealed to the chat exactly as a link preview is.
 */

const CHAT = 'chat1';
const alice = generateKeypair();
const bob = generateKeypair();

const TRANSCRIPT = 'the appointment is on the fourteenth at half past two';

beforeEach(() => {
  mockKeypair.mockReset().mockResolvedValue(alice);
  mockPeerKey.mockReset().mockResolvedValue({key: bob.publicKey, status: 'ok'});
});

describe('buildTranscriptionPatch', () => {
  // The negative assertion is the one that matters: a test that only checked
  // for the sealed field would still pass if both were written.
  it('seals the transcript and stores no plaintext copy', async () => {
    const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
    const patch = buildTranscriptionPatch(TRANSCRIPT, crypto);

    expect(patch.encryptedTranscription).toBeTruthy();
    expect(patch.transcription).toBeUndefined();
    expect(JSON.stringify(patch)).not.toContain('fourteenth');
  });

  it('is readable by the other participant, and by nobody else', async () => {
    const mine = await makeArtifactCrypto('alice', 'bob', CHAT);
    const patch = buildTranscriptionPatch(TRANSCRIPT, mine);

    mockKeypair.mockResolvedValue(bob);
    mockPeerKey.mockResolvedValue({key: alice.publicKey, status: 'ok'});
    const theirs = await makeArtifactCrypto('bob', 'alice', CHAT);
    expect(theirs.open('', patch.encryptedTranscription)).toBe(TRANSCRIPT);

    const mallory = generateKeypair();
    mockKeypair.mockResolvedValue(mallory);
    mockPeerKey.mockResolvedValue({key: alice.publicKey, status: 'ok'});
    const intruder = await makeArtifactCrypto('mallory', 'alice', CHAT);
    expect(intruder.open('', patch.encryptedTranscription)).toBe('');
  });

  // A group chat, or a peer who never enrolled a key. Transcription still
  // works and stays server-visible — which is where it was for its whole life,
  // and the same degradation shared lists and link previews already accept.
  it('falls back to the plaintext field when there is nobody to encrypt to', () => {
    const patch = buildTranscriptionPatch(TRANSCRIPT, INERT_ARTIFACT_CRYPTO);
    expect(patch).toEqual({transcription: TRANSCRIPT});
  });

  // The shared sealer returns null for an empty string (see e2eeArtifacts),
  // so this takes the plaintext branch — writing `transcription: ''`, which
  // discloses nothing. Pinned because the branch exists and someone reading
  // the fallback above could reasonably assume it only fires without a key.
  // The screen never gets here: it skips the write when the transcript is
  // empty.
  it('writes an empty transcript in the clear, which is nothing', async () => {
    const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
    expect(buildTranscriptionPatch('', crypto)).toEqual({transcription: ''});
  });
});
