const mockSendMessage = jest.fn();
const mockSealText = jest.fn();
const mockOpenRatchetEnvelope = jest.fn();
const mockFetchPeerPublicKeyChecked = jest.fn();
const mockGetOrCreateDeviceKeypair = jest.fn();
const mockGetDeviceKeypairIfEnrolled = jest.fn();

jest.mock('../firebaseChat', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));
jest.mock('../e2eeKeys', () => ({
  fetchPeerPublicKeyChecked: (...args: unknown[]) => mockFetchPeerPublicKeyChecked(...args),
  getOrCreateDeviceKeypair: (...args: unknown[]) => mockGetOrCreateDeviceKeypair(...args),
  getDeviceKeypairIfEnrolled: (...args: unknown[]) => mockGetDeviceKeypairIfEnrolled(...args),
}));
// Mocked at this boundary because ratchetMessages reaches Firestore through
// ratchetKeys; the dispatch logic under test here is which path is chosen, not
// the ratchet itself (covered in ratchetMessages.test.ts).
jest.mock('../ratchetMessages', () => ({
  RATCHET_ENVELOPE_ALG: 'chatterbox-ratchet-envelope-v1',
  isRatchetEnvelope: (v: unknown) =>
    !!v && typeof v === 'object' && (v as {alg?: string}).alg === 'chatterbox-ratchet-envelope-v1',
  sealText: (...args: unknown[]) => mockSealText(...args),
  openEnvelope: (...args: unknown[]) => mockOpenRatchetEnvelope(...args),
}));
const mockSaveBodies = jest.fn();
jest.mock('../messageBodyStore', () => ({
  saveBodies: (...a: unknown[]) => mockSaveBodies(...a),
}));
const mockReportError = jest.fn();
const mockReportSealedFailure = jest.fn();
jest.mock('../errorLog', () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
  reportSealedFailure: (...a: unknown[]) => mockReportSealedFailure(...a),
}));

import {encryptMessage, generateKeypair, type Keypair} from '../e2ee';
import {isMessageEncrypted, resolveMessageText, sealedKeyCount, sendTextMessage} from '../e2eeMessages';
import {encodeBody, isStructuredBody} from '../messageBody';
import {MEDIA_CRYPTO_ALG} from '../mediaCrypto';
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
  mockGetDeviceKeypairIfEnrolled.mockReset().mockResolvedValue(me);
  mockReportError.mockReset();
  mockReportSealedFailure.mockReset();
  // Default: the peer is an older client with no published bundle, so every
  // existing test keeps exercising the static path it was written for.
  mockSealText.mockReset().mockResolvedValue({protection: 'unavailable'});
  mockOpenRatchetEnvelope.mockReset();
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

    expect(result).toEqual({encrypted: true, protection: 'static'});
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

    expect(result).toEqual({encrypted: false, protection: 'none'});
    expect(sent().text).toBe('hello');
    expect(sent().encrypted).toBeUndefined();
  });

  it('sends plaintext when there is no text to seal', async () => {
    const result = await sendTextMessage(CHAT, msg(''), ME, ['bob']);
    expect(result).toEqual({encrypted: false, protection: 'none'});
  });

  it('sends plaintext when there are no recipients', async () => {
    const result = await sendTextMessage(CHAT, msg('alone'), ME, []);
    expect(result).toEqual({encrypted: false, protection: 'none'});
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
    mockGetDeviceKeypairIfEnrolled.mockResolvedValue(generateKeypair()); // stranger
    expect(await resolveMessageText(sent(), 'mallory', CHAT)).toBeNull();

    // Reported as the diagnosed, expected condition rather than as an app
    // error. A reader without the key is end-to-end encryption working; if
    // this reaches reportError, every user with an un-restored second device
    // files Crashlytics issues, and the 'corrupt' failure that does mean
    // damage is buried among them.
    expect(mockReportError).not.toHaveBeenCalled();
    expect(mockReportSealedFailure).toHaveBeenCalledWith(expect.anything(), 'wrong-key');
  });

  // The read path must never be what enrolls this device. getOrCreate mints
  // *and publishes*, so a push notification decrypting a preview on a
  // reinstalled phone would have overwritten the account's published key in
  // the background — before the app was opened, and long before the user
  // could reach the restore screen.
  it('does not enroll the device just to read', async () => {
    await sendTextMessage(CHAT, msg('secret'), ME, ['bob']);
    mockGetOrCreateDeviceKeypair.mockClear();
    mockGetDeviceKeypairIfEnrolled.mockResolvedValue(bob);

    expect(await resolveMessageText(sent(), 'bob', CHAT)).toBe('secret');
    expect(mockGetOrCreateDeviceKeypair).not.toHaveBeenCalled();
  });

  it('reads nothing rather than minting a key when this device is unenrolled', async () => {
    await sendTextMessage(CHAT, msg('secret'), ME, ['bob']);
    mockGetOrCreateDeviceKeypair.mockClear();
    mockGetDeviceKeypairIfEnrolled.mockResolvedValue(null);

    expect(await resolveMessageText(sent(), 'bob', CHAT)).toBeNull();
    expect(mockGetOrCreateDeviceKeypair).not.toHaveBeenCalled();
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

    mockGetDeviceKeypairIfEnrolled.mockResolvedValue(bob);
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
    expect(result).toEqual({encrypted: false, protection: 'none'});
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

describe('choosing between the ratchet and the static path', () => {
  const ratchetEnvelope = {
    alg: 'chatterbox-ratchet-envelope-v1',
    from: ME,
    message: {alg: 'chatterbox-double-ratchet-v1', header: {dh: 'x', pn: 0, n: 0}, body: 'ct'},
  };

  it('uses the ratchet for a 1:1 chat when the peer has published a bundle', async () => {
    mockSealText.mockResolvedValue({protection: 'ratchet', envelope: ratchetEnvelope});
    const result = await sendTextMessage(CHAT, msg('hello'), ME, ['bob']);
    expect(result).toEqual({encrypted: true, protection: 'ratchet'});
    expect(sent().encrypted).toBe(ratchetEnvelope);
    expect(sent().text).toBe('');
  });

  it('falls back to the static path when the peer has no bundle, and says so', async () => {
    // The fallback is correct — an older client could not read a ratchet
    // message — but it must be reported, or the conversation silently stops
    // being forward-secret.
    mockSealText.mockResolvedValue({protection: 'unavailable'});
    mockFetchPeerPublicKeyChecked.mockResolvedValue({key: bob.publicKey, status: 'unchanged'});
    const result = await sendTextMessage(CHAT, msg('hello'), ME, ['bob']);
    expect(result).toEqual({encrypted: true, protection: 'static'});
    expect(sent().encrypted).not.toBe(ratchetEnvelope);
  });

  it('never claims ratchet protection for a group message', async () => {
    // The ratchet is a two-party protocol. Groups keep fan-out until sender
    // keys are wired up, and must not be reported as forward-secret.
    mockSealText.mockResolvedValue({protection: 'ratchet', envelope: ratchetEnvelope});
    mockFetchPeerPublicKeyChecked.mockResolvedValue({key: bob.publicKey, status: 'unchanged'});
    const result = await sendTextMessage(CHAT, msg('hello'), ME, ['bob', 'carol']);
    expect(result.protection).toBe('static');
    expect(mockSealText).not.toHaveBeenCalled();
  });

  it('reports "none" when nothing was sealed', async () => {
    mockFetchPeerPublicKeyChecked.mockResolvedValue({key: null, status: 'unenrolled'});
    const result = await sendTextMessage(CHAT, msg('hello'), ME, ['bob']);
    expect(result).toEqual({encrypted: false, protection: 'none'});
  });

  it('opens a ratchet envelope through the ratchet, not the static opener', async () => {
    // Handing it to the static opener would fail and report a perfectly good
    // message as undecryptable.
    mockOpenRatchetEnvelope.mockResolvedValue({status: 'ok', text: 'hi', sessionReset: false});
    const message = {_id: 'm1', text: '', createdAt: 0, encrypted: ratchetEnvelope} as unknown as Message;
    expect(await resolveMessageText(message, ME, CHAT)).toBe('hi');
    expect(mockOpenRatchetEnvelope).toHaveBeenCalled();
  });

  it('reports an undecryptable ratchet message as null rather than blank', async () => {
    mockOpenRatchetEnvelope.mockResolvedValue({status: 'undecryptable'});
    const message = {_id: 'm1', text: '', createdAt: 0, encrypted: ratchetEnvelope} as unknown as Message;
    expect(await resolveMessageText(message, ME, CHAT)).toBeNull();
  });

  it('counts a ratchet message as encrypted and as one copy', async () => {
    const message = {_id: 'm1', text: '', createdAt: 0, encrypted: ratchetEnvelope} as unknown as Message;
    expect(isMessageEncrypted(message)).toBe(true);
    expect(sealedKeyCount(message)).toBe(1);
  });
});


/**
 * Opening a message has to be durable, and has to hand back text.
 *
 * This function's only caller is the background push handler, and a ratchet
 * envelope opens exactly once. Opening one to build a notification and then
 * dropping the plaintext destroyed the message: by the time the chat screen
 * looked, the key was gone and nothing had written the body to the store that
 * outlives the envelope. Every message that arrived while the app was in the
 * background — most of them — became permanently unreadable.
 *
 * And what the openers return is the encoded body, not the text. A message
 * carrying an attachment therefore put a NUL marker, JSON, and the
 * attachment's base64 content key into the notification body, which lands in
 * the OS notification history.
 */
describe('resolveMessageText records what it opened', () => {
  const RATCHET = {alg: 'chatterbox-ratchet-envelope-v1', from: 'bob', message: {}};
  const KEY = {
    alg: MEDIA_CRYPTO_ALG,
    key: 'a'.repeat(43) + '=',
    nonceBase: 'b'.repeat(22) + '==',
    chunkBytes: 1024,
    chunkCount: 1,
    plaintextBytes: 512,
  } as const;

  beforeEach(() => {
    mockSaveBodies.mockReset().mockResolvedValue(undefined);
    mockOpenRatchetEnvelope.mockReset();
  });

  it('persists the body it opened, keyed by message id', async () => {
    mockOpenRatchetEnvelope.mockResolvedValue({status: 'ok', text: 'hello there'});
    const text = await resolveMessageText(
      {_id: 'm1', encrypted: RATCHET} as unknown as Message,
      ME,
      CHAT,
    );
    expect(text).toBe('hello there');
    expect(mockSaveBodies).toHaveBeenCalledWith(ME, CHAT, new Map([['m1', 'hello there']]));
  });

  it('returns the text of a structured body, not the body — and not the media key', async () => {
    const raw = encodeBody({text: 'look at this', media: {image: KEY}});
    expect(isStructuredBody(raw)).toBe(true);
    mockOpenRatchetEnvelope.mockResolvedValue({status: 'ok', text: raw});

    const text = await resolveMessageText(
      {_id: 'm2', encrypted: RATCHET} as unknown as Message,
      ME,
      CHAT,
    );
    expect(text).toBe('look at this');
    // The leak, pinned: none of the envelope's machinery reaches the caller.
    expect(text).not.toContain('cbx-body-1');
    expect(text).not.toContain(KEY.key);

    // But the *stored* body keeps the key, which is what makes the attachment
    // openable later (see messageBodyStore).
    expect(mockSaveBodies).toHaveBeenCalledWith(ME, CHAT, new Map([['m2', raw]]));
  });

  it('stores nothing when the envelope did not open', async () => {
    mockOpenRatchetEnvelope.mockResolvedValue({status: 'failed'});
    expect(
      await resolveMessageText({_id: 'm3', encrypted: RATCHET} as unknown as Message, ME, CHAT),
    ).toBeNull();
    expect(mockSaveBodies).not.toHaveBeenCalled();
  });

  it('stores nothing for a message that was never sealed', async () => {
    expect(
      await resolveMessageText({_id: 'm4', text: 'in the clear'} as unknown as Message, ME, CHAT),
    ).toBe('in the clear');
    expect(mockSaveBodies).not.toHaveBeenCalled();
  });
});

/**
 * The sender's own copy has to be stored at send time, because nothing can
 * reconstruct it afterwards.
 *
 * A forward-secret message is sealed to the *recipient* and advances the
 * sender's chain as it is encrypted, so the sender cannot open what they just
 * sent — not once, not ever. The composer's optimistic bubble hid this: it
 * showed the text until the Firestore snapshot replaced it with the stored
 * document, whose `text` is blank and whose envelope will not open here. Every
 * message this device sent then rendered "🔒 Unable to decrypt", and reopening
 * the chat showed a thread where only the other person's half was readable.
 */
describe('the sender keeps a readable copy of what they sent', () => {
  const ratchetEnvelope = {
    alg: 'chatterbox-ratchet-envelope-v1',
    from: ME,
    message: {alg: 'chatterbox-double-ratchet-v1', header: {dh: 'x', pn: 0, n: 0}, body: 'ct'},
  };

  beforeEach(() => {
    mockSaveBodies.mockReset().mockResolvedValue(undefined);
  });

  it('stores the body it sealed under the ratchet, keyed by message id', async () => {
    mockSealText.mockResolvedValue({protection: 'ratchet', envelope: ratchetEnvelope});
    await sendTextMessage(CHAT, msg('the nuclear codes'), ME, ['bob']);
    expect(mockSaveBodies).toHaveBeenCalledWith(ME, CHAT, new Map([['m1', 'the nuclear codes']]));
  });

  it('stores nothing for a message that went out in the clear', async () => {
    mockFetchPeerPublicKeyChecked.mockResolvedValue({key: null, status: 'unenrolled'});
    await sendTextMessage(CHAT, msg('in the clear'), ME, ['bob']);
    expect(mockSaveBodies).not.toHaveBeenCalled();
  });
});
