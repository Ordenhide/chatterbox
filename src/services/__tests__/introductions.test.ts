/**
 * The introduction is the only thing left that tells one user another's name,
 * and it arrives in a document every participant can write. So most of what
 * follows is about *refusing* one: a name in the wrong slot, from the wrong
 * key, or shaped to break the row it lands in.
 */
const mockFetchPeerKey = jest.fn();
const mockGetKeypair = jest.fn();
const mockReportError = jest.fn();

jest.mock('../e2eeKeys', () => ({
  fetchPeerPublicKeyChecked: (...args: unknown[]) => mockFetchPeerKey(...args),
  getDeviceKeypairIfEnrolled: (...args: unknown[]) => mockGetKeypair(...args),
}));
jest.mock('../errorLog', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

import {
  MAX_INTRO_LENGTH,
  openIntroduction,
  openIntroductions,
  sealIntroduction,
  tidyIntroduction,
} from '../introductions';
import {bytesToBase64} from '../crypto';
import {generateKeypair, encryptMessage} from '../e2ee';
import type {ChatRoom} from '../../types';

const CHAT = 'chat-1';
const alice = generateKeypair();
const bob = generateKeypair();
const mallory = generateKeypair();

const chat = (extra: Partial<ChatRoom> = {}): ChatRoom =>
  ({id: CHAT, name: 'Chat', participants: ['me', 'bob'], createdAt: new Date(0), ...extra}) as ChatRoom;

beforeEach(() => {
  mockFetchPeerKey.mockReset().mockResolvedValue({key: bob.publicKey});
  mockGetKeypair.mockReset().mockResolvedValue(alice);
  mockReportError.mockClear();
});

describe('tidyIntroduction', () => {
  it('collapses a name to one line', () => {
    // It lands in a chat title. A newline there is a layout attack, not a name.
    expect(tidyIntroduction('Ada\nLovelace')).toBe('Ada Lovelace');
    expect(tidyIntroduction('  Ada   L  ')).toBe('Ada L');
  });

  it('bounds the length', () => {
    expect(tidyIntroduction('x'.repeat(500))).toHaveLength(MAX_INTRO_LENGTH);
  });

  it('leaves an ordinary name alone', () => {
    expect(tidyIntroduction('Ada Lovelace')).toBe('Ada Lovelace');
  });
});

describe('sealing and opening', () => {
  it('round-trips a name to the person it was sealed for', () => {
    const sealed = sealIntroduction('Ada', bob.secretKey, bytesToBase64(alice.publicKey), CHAT);
    expect(openIntroduction(sealed, alice.secretKey, bob.publicKey, CHAT)).toBe('Ada');
  });

  it('seals nothing when there is no name to seal', () => {
    expect(sealIntroduction('', bob.secretKey, bytesToBase64(alice.publicKey), CHAT)).toBeNull();
    expect(sealIntroduction('   ', bob.secretKey, bytesToBase64(alice.publicKey), CHAT)).toBeNull();
  });

  it('reports a malformed peer key instead of throwing into the caller', () => {
    expect(sealIntroduction('Ada', bob.secretKey, 'not base64 !!', CHAT)).toBeNull();
    expect(mockReportError).toHaveBeenCalled();
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
    const other = sealIntroduction('Ada', bob.secretKey, bytesToBase64(alice.publicKey), 'chat-2');
    expect(openIntroduction(other, alice.secretKey, bob.publicKey, CHAT)).toBeNull();
  });

  it('refuses anything that is not an envelope', () => {
    for (const junk of [null, undefined, '', 'Ada', {}, {body: 'x'}, 42]) {
      expect(openIntroduction(junk, alice.secretKey, bob.publicKey, CHAT)).toBeNull();
    }
  });

  it('refuses when the peer has published no key to check against', () => {
    const sealed = sealIntroduction('Ada', bob.secretKey, bytesToBase64(alice.publicKey), CHAT);
    expect(openIntroduction(sealed, alice.secretKey, null, CHAT)).toBeNull();
  });

  it('tidies on the way out as well as in', () => {
    // The sender controls the plaintext, so a client that skipped the tidy on
    // write must not be able to put a newline in the reader's title.
    const raw = encryptMessage('Ada\n\nLovelace', bob.secretKey, alice.publicKey, CHAT);
    expect(openIntroduction(raw, alice.secretKey, bob.publicKey, CHAT)).toBe('Ada Lovelace');
  });
});

describe('openIntroductions', () => {
  const sealedForMe = () =>
    sealIntroduction('Ada', bob.secretKey, bytesToBase64(alice.publicKey), CHAT);

  it('returns the readable introductions, keyed by chat', async () => {
    const found = await openIntroductions([chat({introBy: {bob: sealedForMe()}} as never)], 'me');
    expect(found).toEqual({[CHAT]: 'Ada'});
  });

  it('ignores an introduction the peer did not write', async () => {
    // Keyed by the writer's uid. One sitting under your own uid is your own
    // name coming back at you, which is not information.
    const found = await openIntroductions([chat({introBy: {me: sealedForMe()}} as never)], 'me');
    expect(found).toEqual({});
  });

  it('ignores groups', async () => {
    const group = chat({participants: ['me', 'bob', 'carol'], introBy: {bob: sealedForMe()}} as never);
    expect(await openIntroductions([group], 'me')).toEqual({});
  });

  it('is empty for a device with no key, rather than enrolling one', async () => {
    // The chat list is not the place to discover you have no key, and the
    // enrolling variant here would publish a fresh one over the account's.
    mockGetKeypair.mockResolvedValue(null);
    expect(await openIntroductions([chat({introBy: {bob: sealedForMe()}} as never)], 'me')).toEqual({});
  });

  it('is empty when there is nothing to open', async () => {
    expect(await openIntroductions([chat()], 'me')).toEqual({});
    expect(await openIntroductions([], 'me')).toEqual({});
    expect(await openIntroductions([chat()], '')).toEqual({});
  });

  it('survives a key fetch that fails', async () => {
    mockFetchPeerKey.mockRejectedValue(new Error('offline'));
    expect(await openIntroductions([chat({introBy: {bob: sealedForMe()}} as never)], 'me')).toEqual({});
    expect(mockReportError).toHaveBeenCalled();
  });

  it('reads several chats independently', async () => {
    const second = sealIntroduction('Grace', bob.secretKey, bytesToBase64(alice.publicKey), 'chat-2');
    const found = await openIntroductions(
      [
        chat({introBy: {bob: sealedForMe()}} as never),
        chat({id: 'chat-2', participants: ['me', 'bob'], introBy: {bob: second}} as never),
        chat({id: 'chat-3', participants: ['me', 'bob']}),
      ],
      'me',
    );
    expect(found).toEqual({[CHAT]: 'Ada', 'chat-2': 'Grace'});
  });
});

/**
 * Two reimplementations of one wire format again (see the same block in
 * invites.test.ts). A name sealed on a phone has to open in a browser, so the
 * field, the bound and the check that gates it are pinned on both sides.
 *
 * Read as text rather than imported: the web module pulls in the Firebase web
 * SDK, which this jest environment does not have.
 */
describe('parity with the web client', () => {
  const fs = require('fs');
  const path = require('path');
  const web = fs.readFileSync(
    path.join(__dirname, '../../../web/src/services/introductions.ts'),
    'utf8',
  );
  const mine = fs.readFileSync(path.join(__dirname, '../introductions.ts'), 'utf8');

  it.each([
    ["export const INTRO_FIELD = 'introBy';", 'the field on the chat document'],
    ['export const MAX_INTRO_LENGTH = 48;', 'the length bound'],
    ["value.replace(/\\s+/g, ' ').trim().slice(0, MAX_INTRO_LENGTH)", 'the tidy'],
    [
      'if (intro.senderKey !== bytesToBase64(peerPublicKey)) return null;',
      'the check that a name came from the peer',
    ],
  ])('agrees on %s (%s)', line => {
    expect(web).toContain(line);
    expect(mine).toContain(line);
  });
});
