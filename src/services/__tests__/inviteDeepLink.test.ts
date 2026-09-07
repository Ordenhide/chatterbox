// The module under test is pure, but it imports parseInviteLink from
// invites.ts, whose module graph reaches Firestore and the native key store
// at import time. Nothing here calls any of it.
jest.mock('../firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: () => ({}),
  getDoc: async () => ({exists: () => false}),
  setDoc: async () => undefined,
  updateDoc: async () => undefined,
  deleteDoc: async () => undefined,
  serverTimestamp: () => 0,
}));
jest.mock('../e2eeKeys', () => ({getDeviceKeypairIfEnrolled: async () => null}));
jest.mock('../errorLog', () => ({reportError: jest.fn()}));
jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

import {
  __clearPendingInvite,
  captureInviteUrl,
  hasPendingInvite,
  takePendingInvite,
} from '../inviteDeepLink';
import {inviteLink, newInviteToken} from '../invites';

const TOKEN = 'a'.repeat(64);

beforeEach(() => {
  __clearPendingInvite();
});

describe('capture', () => {
  it('takes the token out of a real invite link', () => {
    expect(captureInviteUrl(inviteLink(TOKEN))).toBe(true);
    expect(takePendingInvite()).toBe(TOKEN);
  });

  it('takes a freshly minted token, so the two ends agree on the format', () => {
    const token = newInviteToken();
    expect(captureInviteUrl(inviteLink(token))).toBe(true);
    expect(takePendingInvite()).toBe(token);
  });

  // The OS hands the app every URL it is registered for, and one day that
  // will be more than one kind. Returning false is how the caller tells them
  // apart, and parking a non-token would send someone to the invite screen
  // with rubbish in the field.
  it('refuses anything that is not an invite link', () => {
    for (const url of [
      null,
      undefined,
      '',
      'https://example.com',
      'chatterbox://something-else#' + TOKEN,
      'chatterbox://invite',
      'chatterbox://invite#not-hex',
      'chatterbox://invite#' + 'a'.repeat(63),
    ]) {
      expect(captureInviteUrl(url)).toBe(false);
    }
    expect(hasPendingInvite()).toBe(false);
  });

  it('keeps the newest link when two arrive', () => {
    const second = 'b'.repeat(64);
    captureInviteUrl(inviteLink(TOKEN));
    captureInviteUrl(inviteLink(second));
    expect(takePendingInvite()).toBe(second);
  });
});

describe('take', () => {
  // The caller navigates with it. Left set, it would send the user back to
  // the invite screen every time the app resumed, long after they dealt with
  // it — or worse, after they declined.
  it('clears as it is read', () => {
    captureInviteUrl(inviteLink(TOKEN));
    expect(takePendingInvite()).toBe(TOKEN);
    expect(takePendingInvite()).toBeNull();
    expect(hasPendingInvite()).toBe(false);
  });

  it('is null when nothing arrived', () => {
    expect(takePendingInvite()).toBeNull();
  });
});
