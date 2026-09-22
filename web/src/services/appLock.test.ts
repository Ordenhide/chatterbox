import {beforeEach, describe, expect, it, vi} from 'vitest';

const memoryStorage = (() => {
  let data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = String(v);
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    clear: () => {
      data = {};
    },
  };
})();
vi.stubGlobal('localStorage', memoryStorage);

import {isChatLocked, removeChatLock, setChatLockPIN, verifyChatPIN} from './appLock';

beforeEach(() => memoryStorage.clear());

describe('chat locks', () => {
  it('locks a chat and accepts the right PIN', () => {
    expect(isChatLocked('c1')).toBe(false);
    setChatLockPIN('c1', '1234');
    expect(isChatLocked('c1')).toBe(true);
    expect(verifyChatPIN('c1', '1234')).toBe(true);
  });

  it('rejects the wrong PIN', () => {
    setChatLockPIN('c1', '1234');
    expect(verifyChatPIN('c1', '9999')).toBe(false);
    expect(verifyChatPIN('c1', '')).toBe(false);
    expect(verifyChatPIN('c1', '12345')).toBe(false);
  });

  it('keeps chats independent — one PIN does not open another chat', () => {
    setChatLockPIN('c1', '1111');
    setChatLockPIN('c2', '2222');
    expect(verifyChatPIN('c2', '1111')).toBe(false);
    expect(verifyChatPIN('c2', '2222')).toBe(true);
  });

  it('rejects everything for a chat that was never locked', () => {
    expect(verifyChatPIN('never-locked', '1234')).toBe(false);
  });

  it('unlocking removes the lock entirely', () => {
    setChatLockPIN('c1', '1234');
    removeChatLock('c1');
    expect(isChatLocked('c1')).toBe(false);
    expect(verifyChatPIN('c1', '1234')).toBe(false);
  });

  // The PIN must never be recoverable from what is stored, or the lock is
  // decoration — anyone reading localStorage would just read the PIN back out.
  it('never stores the PIN itself', () => {
    setChatLockPIN('c1', '4821');
    const stored = memoryStorage.getItem('chat_lock_v1:c1');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('4821');
  });

  // Without a per-lock random salt, identical PINs would hash identically and a
  // single precomputed table would open every lock in the app.
  it('salts each lock, so the same PIN stores differently every time', () => {
    setChatLockPIN('c1', '1234');
    setChatLockPIN('c2', '1234');
    expect(memoryStorage.getItem('chat_lock_v1:c1')).not.toBe(
      memoryStorage.getItem('chat_lock_v1:c2'),
    );
    // ...and both still verify.
    expect(verifyChatPIN('c1', '1234')).toBe(true);
    expect(verifyChatPIN('c2', '1234')).toBe(true);
  });

  it('rejects a stored value in an unknown format rather than guessing at it', () => {
    memoryStorage.setItem('chat_lock_v1:c1', 'v0:deadbeef:whatever');
    expect(verifyChatPIN('c1', '1234')).toBe(false);
    memoryStorage.setItem('chat_lock_v1:c1', 'garbage');
    expect(verifyChatPIN('c1', '1234')).toBe(false);
  });
});

/**
 * There was an `app lock` suite here covering setAppLockPIN / verifyAppPIN /
 * isAppLockEnabled / disableAppLock. Those four exports are gone: they were
 * complete, nothing on this client reached them, and appLock.ts now records why
 * the browser does not offer a whole-app lock rather than leaving the pieces
 * lying around for someone to half-wire.
 *
 * The suite is not replaced by a "stays deleted" check. The reachability guard
 * (noUnreachableExports.test.ts) is what would catch them coming back without a
 * screen, which is the failure worth guarding — not their absence.
 */
describe('a chat lock is scoped to its chat', () => {
  it('does not accept another chat’s PIN', () => {
    setChatLockPIN('c1', '1111');
    setChatLockPIN('c2', '2222');
    expect(verifyChatPIN('c1', '2222')).toBe(false);
    expect(verifyChatPIN('c2', '1111')).toBe(false);
    expect(verifyChatPIN('c1', '1111')).toBe(true);
    expect(verifyChatPIN('c2', '2222')).toBe(true);
  });

  it('leaves other chats locked when one is unlocked', () => {
    setChatLockPIN('c1', '1111');
    setChatLockPIN('c2', '2222');
    removeChatLock('c1');
    expect(isChatLocked('c1')).toBe(false);
    expect(isChatLocked('c2')).toBe(true);
  });
});
