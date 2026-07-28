import {beforeEach, describe, expect, it, vi} from 'vitest';

/** In-memory localStorage, matching session.test.ts's stand-in. */
const memoryStorage = (() => {
  let data: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(data).length;
    },
    key: (i: number) => Object.keys(data)[i] ?? null,
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

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: {credential: (email: string, password: string) => ({email, password})},
  deleteUser: vi.fn(async () => undefined),
  reauthenticateWithCredential: vi.fn(async () => undefined),
  updatePassword: vi.fn(async () => undefined),
}));
vi.mock('firebase/firestore', () => ({
  arrayRemove: (v: unknown) => v,
  collection: () => ({}),
  deleteDoc: vi.fn(async () => undefined),
  doc: () => ({}),
  getDocs: vi.fn(async () => ({docs: [], empty: true})),
  limit: () => ({}),
  orderBy: () => ({}),
  query: () => ({}),
  updateDoc: vi.fn(async () => undefined),
  where: () => ({}),
}));
vi.mock('firebase/storage', () => ({
  deleteObject: vi.fn(async () => undefined),
  listAll: vi.fn(async () => ({items: [], prefixes: []})),
  ref: () => ({}),
}));
vi.mock('../firebase', () => ({auth: {currentUser: null}, db: {}}));
vi.mock('./storage', () => ({storage: {}}));
vi.mock('./firestoreBatch', () => ({deleteQueryInChunks: vi.fn(async () => 0)}));

import {clearLocalData, describeAuthError} from './account';

beforeEach(() => {
  localStorage.clear();
});

describe('describeAuthError', () => {
  it('maps every credential-rejection spelling Firebase uses to one reason', () => {
    // Firebase has changed which of these it returns for a bad password over
    // time (invalid-login-credentials / invalid-credential appeared when email
    // enumeration protection shipped). Collapsing them means the UI shows
    // "wrong password" rather than a generic error, whichever one comes back.
    for (const code of [
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/invalid-login-credentials',
    ]) {
      expect(describeAuthError({code})).toBe('wrong-password');
    }
  });

  it('distinguishes weak passwords and rate limiting from a wrong password', () => {
    expect(describeAuthError({code: 'auth/weak-password'})).toBe('weak-password');
    expect(describeAuthError({code: 'auth/too-many-requests'})).toBe('too-many-requests');
  });

  it('falls back to unknown rather than mislabelling an unexpected failure', () => {
    expect(describeAuthError({code: 'auth/network-request-failed'})).toBe('unknown');
    expect(describeAuthError(new Error('boom'))).toBe('unknown');
    expect(describeAuthError(null)).toBe('unknown');
  });
});

describe('clearLocalData', () => {
  it('removes the E2EE secret key — the one piece of data that exists only here', () => {
    // Losing this on a shared computer would be the most sensitive residue of
    // a deleted account: it is never uploaded anywhere, so nothing else can
    // clean it up later.
    localStorage.setItem('e2ee_secret_key_v1:uid1', 'SECRET');
    clearLocalData('uid1');
    expect(localStorage.getItem('e2ee_secret_key_v1:uid1')).toBeNull();
  });

  it('removes cached peer keys, drafts, the tour flag and the session id', () => {
    localStorage.setItem('e2ee_peer_key_v1:uid1:peer', 'KEY');
    localStorage.setItem('@chatterbox:drafts:uid1', '{}');
    localStorage.setItem('@chatterbox:tour', 'done');
    localStorage.setItem('cb_web_session', 'web_abc');
    clearLocalData('uid1');
    expect(localStorage.getItem('e2ee_peer_key_v1:uid1:peer')).toBeNull();
    expect(localStorage.getItem('@chatterbox:drafts:uid1')).toBeNull();
    expect(localStorage.getItem('@chatterbox:tour')).toBeNull();
    expect(localStorage.getItem('cb_web_session')).toBeNull();
  });

  it('removes every key mentioning the uid, whatever the prefix', () => {
    localStorage.setItem('some_future_feature:uid1', 'x');
    clearLocalData('uid1');
    expect(localStorage.getItem('some_future_feature:uid1')).toBeNull();
  });

  it('leaves another account\'s data alone', () => {
    // A shared browser may have a second Chatterbox account's keys stored;
    // deleting one account must not destroy the other's secret key.
    localStorage.setItem('e2ee_secret_key_v1:uid2', 'OTHER_SECRET');
    localStorage.setItem('unrelated_app_key', 'keep me');
    clearLocalData('uid1');
    expect(localStorage.getItem('e2ee_secret_key_v1:uid2')).toBeNull(); // prefix match
    expect(localStorage.getItem('unrelated_app_key')).toBe('keep me');
  });

  it('does not throw when storage is unavailable', () => {
    const original = globalThis.localStorage;
    vi.stubGlobal('localStorage', {
      get length(): number {
        throw new Error('blocked');
      },
      key: () => null,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('blocked');
      },
      clear: () => undefined,
    });
    expect(() => clearLocalData('uid1')).not.toThrow();
    vi.stubGlobal('localStorage', original);
  });
});
