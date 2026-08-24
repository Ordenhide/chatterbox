/**
 * `messageProtection` is the function other code and several comments point at
 * for "what did this message actually get?". It had no tests, and was wrong:
 * a group message sealed with sender keys reported 'none'.
 *
 * The direction of an error here matters. Overstating protection is the worse
 * failure and the one its own doc comment warns about; understating it is what
 * actually happened, and it is still a wrong answer from the function whose
 * entire job is to give a right one.
 */
// e2eeMessages imports the send path, which drags in the Firestore SDK. These
// two functions are pure and touch none of it.
jest.mock('../telemetry', () => ({reportError: jest.fn()}));
jest.mock('../firebaseChat', () => ({sendMessage: jest.fn()}));
jest.mock('../e2eeKeys', () => ({
  fetchPeerPublicKeyChecked: jest.fn(),
  getOrCreateDeviceKeypair: jest.fn(),
}));
jest.mock('../ratchetMessages', () => ({
  isRatchetEnvelope: (v: any) => v?.alg === 'chatterbox-ratchet-envelope-v1',
  openEnvelope: jest.fn(),
  sealText: jest.fn(),
}));

import {messageProtection, sealedKeyCount} from '../e2eeMessages';
import {generateKeypair, sealForRecipients, encryptMessage} from '../e2ee';
import type {Message} from '../../types';

const CHAT_ID = 'chat-1';

function messageWith(encrypted: unknown): Message {
  return {_id: 'm1', text: '', createdAt: Date.now(), encrypted} as Message;
}

const ratchetEnvelope = {
  alg: 'chatterbox-ratchet-envelope-v1',
  from: 'alice',
  message: {header: {dh: 'AAAA', pn: 0, n: 0}, body: 'AAAA', alg: 'x'},
};

const groupEnvelope = {
  alg: 'chatterbox-group-envelope-v1',
  from: 'alice',
  message: {alg: 'x', chainId: 'c1', index: 0, body: 'AAAA', signature: 'AAAA'},
};

describe('messageProtection', () => {
  it('reports a ratchet message as forward-secret', () => {
    expect(messageProtection(messageWith(ratchetEnvelope))).toBe('ratchet');
  });

  it('reports a sender-key group message as forward-secret', () => {
    // The regression this file exists for. Reported 'none' before, which read
    // as "this group message was sent in the clear".
    expect(messageProtection(messageWith(groupEnvelope))).toBe('sender-key');
  });

  it('reports a fan-out envelope as static', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const envelope = sealForRecipients(
      'hi',
      alice.secretKey,
      [{uid: 'bob', publicKey: bob.publicKey}],
      CHAT_ID,
    );
    expect(messageProtection(messageWith(envelope))).toBe('static');
  });

  it('reports a pre-group bare payload as static', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('hi', alice.secretKey, bob.publicKey, CHAT_ID);
    expect(messageProtection(messageWith(payload))).toBe('static');
  });

  it('reports an unsealed message as none', () => {
    expect(messageProtection(messageWith(undefined))).toBe('none');
    expect(messageProtection({_id: 'm', text: 'hi', createdAt: 0} as Message)).toBe('none');
  });

  it('never reports a sealed message as none', () => {
    // The general form of the bug: any recognised envelope must map to some
    // protection. A new envelope type added without touching this function
    // would fail here rather than silently reporting no protection.
    for (const envelope of [ratchetEnvelope, groupEnvelope]) {
      expect(messageProtection(messageWith(envelope))).not.toBe('none');
    }
  });
});

describe('sealedKeyCount', () => {
  it('counts one ciphertext for a sender-key group message', () => {
    // Not the number of members who can read it: that lives in the sender's
    // chain distribution, not in the message.
    expect(sealedKeyCount(messageWith(groupEnvelope))).toBe(1);
  });

  it('counts one for a ratchet message', () => {
    expect(sealedKeyCount(messageWith(ratchetEnvelope))).toBe(1);
  });

  it('counts a copy per recipient for a fan-out envelope', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const carol = generateKeypair();
    const envelope = sealForRecipients(
      'hi',
      alice.secretKey,
      [
        {uid: 'bob', publicKey: bob.publicKey},
        {uid: 'carol', publicKey: carol.publicKey},
      ],
      CHAT_ID,
    );
    expect(sealedKeyCount(messageWith(envelope))).toBe(2);
  });

  it('is null for an unsealed message', () => {
    expect(sealedKeyCount(messageWith(undefined))).toBeNull();
  });
});
