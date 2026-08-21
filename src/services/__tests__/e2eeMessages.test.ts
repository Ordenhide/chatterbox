const mockSendMessage = jest.fn();
const mockFetchPeerPublicKeyChecked = jest.fn();
const mockGetOrCreateDeviceKeypair = jest.fn();

jest.mock('../firebaseChat', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));
jest.mock('../e2eeKeys', () => ({
  fetchPeerPublicKeyChecked: (...args: unknown[]) => mockFetchPeerPublicKeyChecked(...args),
  getOrCreateDeviceKeypair: (...args: unknown[]) => mockGetOrCreateDeviceKeypair(...args),
}));
jest.mock('../telemetry', () => ({reportError: jest.fn()}));

import {encryptMessage, generateKeypair, type Keypair} from '../e2ee';
import {isMessageEncrypted, resolveMessageText, sealedKeyCount, sendTextMessage} from '../e2eeMessages';
import type {Message} from '../../types';

const CHAT = 'chat-1';
const ME = 'alice';

let me: Keypair;
let bob: Keypair;
let carol: Keypair;

function msg(text: string): Message {
  return {_id: 'm1', text, createdAt: 0} as Message;
}

/** The last message handed to sendMessage — i.e. what would reach Firestore. */
function sent(): Message {
  const {calls} = mockSendMessage.mock;
  return calls[calls.length - 1]?.[1] as Message;
}

beforeEach(() => {
  me = generateKeypair();
  bob = generateKeypair();
  carol = generateKeypair();
  mockSendMessage.mockReset().mockResolvedValue(undefined);
  mockGetOrCreateDeviceKeypair.mockReset().mockResolvedValue(me);
  mockFetchPeerPublicKeyChecked.mockReset().mockImplementation(async (uid: string) => {
    if (uid === 'bob') return {key: bob.publicKey, status: 'unchanged'};
    if (uid === 'carol') return {key: carol.publicKey, status: 'unchanged'};
    // A definite answer from the server: this peer has no key. Distinct from
    // 'unavailable', which the tests below cover separately.
    return {key: null, status: 'unenrolled'};
  });
});

describe('sendTextMessage', () => {
  it('seals the body so no plaintext reaches Firestore', async () => {
    const result = await sendTextMessage(CHAT, msg('the nuclear codes'), ME, ['bob']);

    expect(result).toEqual({encrypted: true});
    expect(JSON.stringify(sent())).not.toContain('the nuclear codes');
    // Blanked rather than omitted: sendMessage derives the chat-list preview
    // from `text`, so leaving it would leak the body into lastMessage.
    expect(sent().text).toBe('');
  });

  it('addresses one copy to every recipient in a group', async () => {
    await sendTextMessage(CHAT, msg('hi all'), ME, ['bob', 'carol']);
    const envelope = sent().encrypted as {copies: Record<string, unknown>};
    expect(Object.keys(envelope.copies).sort()).toEqual(['bob', 'carol']);
  });

  // A partially-sealed message would be readable by some members and blank for
  // the rest — worse than one everyone can read.
  it('falls back to plaintext for everyone if any recipient has not enrolled', async () => {
    const result = await sendTextMessage(CHAT, msg('hello'), ME, ['bob', 'stranger']);

    expect(result).toEqual({encrypted: false});
    expect(sent().text).toBe('hello');
    expect(sent().encrypted).toBeUndefined();
  });

  it('sends plaintext when there is no text to seal', async () => {
    const result = await sendTextMessage(CHAT, msg(''), ME, ['bob']);
    expect(result).toEqual({encrypted: false});
  });

  it('sends plaintext when there are no recipients', async () => {
    const result = await sendTextMessage(CHAT, msg('alone'), ME, []);
    expect(result).toEqual({encrypted: false});
  });

  // Silently downgrading would mean the caller believes a message was sealed
  // when it went out in clear.
  it('throws rather than downgrading to plaintext when sealing fails', async () => {
    mockGetOrCreateDeviceKeypair.mockRejectedValue(new Error('keystore unavailable'));
    await expect(sendTextMessage(CHAT, msg('secret'), ME, ['bob'])).rejects.toThrow();
  });
});

describe('resolveMessageText', () => {
  it('round-trips through send for each recipient', async () => {
    await sendTextMessage(CHAT, msg('dinner at 8'), ME, ['bob', 'carol']);
    const delivered = sent();

    mockGetOrCreateDeviceKeypair.mockResolvedValue(bob);
    expect(await resolveMessageText(delivered, 'bob', CHAT)).toBe('dinner at 8');

    mockGetOrCreateDeviceKeypair.mockResolvedValue(carol);
    expect(await resolveMessageText(delivered, 'carol', CHAT)).toBe('dinner at 8');
  });

  it('lets the sender read their own message back', async () => {
    await sendTextMessage(CHAT, msg('my own words'), ME, ['bob']);
    expect(await resolveMessageText(sent(), ME, CHAT)).toBe('my own words');
  });

  it('returns null for a member who cannot decrypt, so the UI can say so', async () => {
    await sendTextMessage(CHAT, msg('secret'), ME, ['bob']);
    mockGetOrCreateDeviceKeypair.mockResolvedValue(generateKeypair()); // stranger
    expect(await resolveMessageText(sent(), 'mallory', CHAT)).toBeNull();
  });

  it('passes plaintext messages straight through', async () => {
    expect(await resolveMessageText(msg('just text'), ME, CHAT)).toBe('just text');
  });

  // Messages sealed before group support carry a bare payload, not an envelope.
  // There is no migration, so this path has to keep working indefinitely.
  it('still reads a pre-group single-payload message', async () => {
    const legacy = {
      ...msg(''),
      encrypted: encryptMessage('old message', me.secretKey, bob.publicKey, CHAT),
    } as Message;

    mockGetOrCreateDeviceKeypair.mockResolvedValue(bob);
    expect(await resolveMessageText(legacy, 'bob', CHAT)).toBe('old message');
  });
});

describe('isMessageEncrypted', () => {
  it('recognises both the envelope and the pre-group payload shapes', async () => {
    await sendTextMessage(CHAT, msg('x'), ME, ['bob']);
    expect(isMessageEncrypted(sent())).toBe(true);

    const legacy = {
      ...msg(''),
      encrypted: encryptMessage('x', me.secretKey, bob.publicKey, CHAT),
    } as Message;
    expect(isMessageEncrypted(legacy)).toBe(true);
  });

  it('is false for a plaintext message', () => {
    expect(isMessageEncrypted(msg('hello'))).toBe(false);
  });
});

describe('sealedKeyCount', () => {
  // Drives the "Sealed · N keys" pill in ChatScreen, so the number has to be
  // the real fan-out width rather than a participant tally.
  it('counts one copy per recipient in the envelope', async () => {
    await sendTextMessage(CHAT, msg('x'), ME, ['bob', 'carol']);
    expect(sealedKeyCount(sent())).toBe(2);

    await sendTextMessage(CHAT, msg('y'), ME, ['bob']);
    expect(sealedKeyCount(sent())).toBe(1);
  });

  it('reports a pre-group payload as the single copy it is', () => {
    const legacy = {
      ...msg(''),
      encrypted: encryptMessage('x', me.secretKey, bob.publicKey, CHAT),
    } as Message;
    expect(sealedKeyCount(legacy)).toBe(1);
  });

  // Null rather than 0 so the pill can hide entirely: "0 keys" would read as a
  // broken feature, when it actually means the peer has not enrolled yet.
  it('is null for a plaintext message', () => {
    expect(sealedKeyCount(msg('hello'))).toBeNull();
  });
});

describe('sendTextMessage refuses to downgrade on an unreachable key server', () => {
  // The distinction the whole change rests on. 'unenrolled' is the server
  // saying "this peer has no key", and plaintext is the documented, intended
  // answer to that. 'unavailable' is the server saying nothing at all, and
  // answering *that* with plaintext is how a dropped connection — or a region
  // where the key store is blocked outright — silently turns E2EE off.
  it('sends plaintext when a peer is definitely unenrolled', async () => {
    const result = await sendTextMessage(CHAT, msg('hello'), ME, ['dave']);
    expect(result).toEqual({encrypted: false});
    expect(sent().text).toBe('hello');
  });

  it('throws rather than sending plaintext when the key cannot be looked up', async () => {
    mockFetchPeerPublicKeyChecked.mockResolvedValue({key: null, status: 'unavailable'});

    await expect(sendTextMessage(CHAT, msg('the nuclear codes'), ME, ['bob'])).rejects.toThrow(
      /unavailable/,
    );
    // The critical assertion: nothing reached Firestore at all. A regression
    // here is not a failed send, it is a plaintext leak.
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('does not leak when only one member of a group is unreachable', async () => {
    mockFetchPeerPublicKeyChecked.mockImplementation(async (uid: string) => {
      if (uid === 'bob') return {key: bob.publicKey, status: 'unchanged'};
      return {key: null, status: 'unavailable'};
    });

    await expect(sendTextMessage(CHAT, msg('secret'), ME, ['bob', 'carol'])).rejects.toThrow();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
