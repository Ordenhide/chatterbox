/**
 * Paired with src/services/__tests__/introductions.test.ts on mobile. The
 * introduction is the only thing left that tells one user another's name, and
 * it arrives in a document every participant can write — so most of this is
 * about refusing one.
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mockFixtures = vi.hoisted(() => ({
  keypair: null as {publicKey: Uint8Array; secretKey: Uint8Array} | null,
  peerKey: null as Uint8Array | null,
  failPeerKey: false,
}));

vi.mock('./e2eeKeys', () => ({
  getDeviceKeypairIfEnrolled: async () => mockFixtures.keypair,
  fetchPeerPublicKeyChecked: async () => {
    if (mockFixtures.failPeerKey) throw new Error('offline');
    return {key: mockFixtures.peerKey, status: 'ok'};
  },
}));

import {
  MAX_INTRO_LENGTH,
  openIntroduction,
  openIntroductions,
  sealIntroduction,
  tidyIntroduction,
} from './introductions';
import {bytesToBase64} from './crypto';
import {encryptMessage, generateKeypair} from './e2ee';
import type {ChatRoom} from '../types';

const CHAT = 'chat-1';
const alice = generateKeypair();
const bob = generateKeypair();
const mallory = generateKeypair();

const chat = (extra: Partial<ChatRoom> = {}): ChatRoom =>
  ({id: CHAT, name: 'Chat', participants: ['me', 'bob'], ...extra}) as ChatRoom;

const sealedForMe = (name = 'Ada', chatId = CHAT) =>
  sealIntroduction(name, bob.secretKey, bytesToBase64(alice.publicKey), chatId);

beforeEach(() => {
  mockFixtures.keypair = alice;
  mockFixtures.peerKey = bob.publicKey;
  mockFixtures.failPeerKey = false;
});

describe('tidyIntroduction', () => {
  it('collapses a name to one line and bounds it', () => {
    // It lands in a chat title. A newline there is a layout attack, not a name.
    expect(tidyIntroduction('Ada\nLovelace')).toBe('Ada Lovelace');
    expect(tidyIntroduction('  Ada   L  ')).toBe('Ada L');
    expect(tidyIntroduction('x'.repeat(500))).toHaveLength(MAX_INTRO_LENGTH);
    expect(tidyIntroduction('Ada Lovelace')).toBe('Ada Lovelace');
  });
});

describe('sealing and opening', () => {
  it('round-trips a name to the person it was sealed for', () => {
    expect(openIntroduction(sealedForMe(), alice.secretKey, bob.publicKey, CHAT)).toBe('Ada');
  });

  it('seals nothing when there is no name, and survives a malformed key', () => {
    expect(sealIntroduction('', bob.secretKey, bytesToBase64(alice.publicKey), CHAT)).toBeNull();
    expect(sealIntroduction('Ada', bob.secretKey, 'not base64 !!', CHAT)).toBeNull();
  });

  /**
   * The forgery this exists to stop. Every participant can write the chat
   * document, so Mallory can put a ciphertext in Bob's slot — sealed to Alice,
   * so it decrypts perfectly. The slot proves nothing; the sender key does.
   */
  it('refuses an envelope not sealed by the peer, even though it decrypts', () => {
    const forged = encryptMessage('Bob', mallory.secretKey, alice.publicKey, CHAT);
    expect(openIntroduction(forged, alice.secretKey, bob.publicKey, CHAT)).toBeNull();
  });

  it('refuses one sealed for a different conversation', () => {
    expect(openIntroduction(sealedForMe('Ada', 'chat-2'), alice.secretKey, bob.publicKey, CHAT)).toBeNull();
  });

  it('refuses junk, and refuses when the peer published no key', () => {
    for (const junk of [null, undefined, '', 'Ada', {}, {body: 'x'}, 42]) {
      expect(openIntroduction(junk, alice.secretKey, bob.publicKey, CHAT)).toBeNull();
    }
    expect(openIntroduction(sealedForMe(), alice.secretKey, null, CHAT)).toBeNull();
  });

  it('tidies on the way out as well as in', () => {
    // The sender controls the plaintext, so a client that skipped the tidy on
    // write must not put a newline in the reader's title.
    const raw = encryptMessage('Ada\n\nLovelace', bob.secretKey, alice.publicKey, CHAT);
    expect(openIntroduction(raw, alice.secretKey, bob.publicKey, CHAT)).toBe('Ada Lovelace');
  });
});

describe('openIntroductions', () => {
  it('returns the readable introductions, keyed by chat', async () => {
    expect(await openIntroductions([chat({introBy: {bob: sealedForMe()}})], 'me')).toEqual({
      [CHAT]: 'Ada',
    });
  });

  it('ignores one written under your own uid, and ignores groups', async () => {
    expect(await openIntroductions([chat({introBy: {me: sealedForMe()}})], 'me')).toEqual({});
    expect(
      await openIntroductions(
        [chat({participants: ['me', 'bob', 'carol'], introBy: {bob: sealedForMe()}})],
        'me',
      ),
    ).toEqual({});
  });

  it('is empty for a browser with no key, rather than enrolling one', async () => {
    mockFixtures.keypair = null;
    expect(await openIntroductions([chat({introBy: {bob: sealedForMe()}})], 'me')).toEqual({});
  });

  it('is empty when there is nothing to open', async () => {
    expect(await openIntroductions([chat()], 'me')).toEqual({});
    expect(await openIntroductions([], 'me')).toEqual({});
    expect(await openIntroductions([chat()], '')).toEqual({});
  });

  it('survives a key fetch that fails', async () => {
    mockFixtures.failPeerKey = true;
    expect(await openIntroductions([chat({introBy: {bob: sealedForMe()}})], 'me')).toEqual({});
  });
});
