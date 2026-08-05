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

// vi.mock factories are hoisted above imports; vi.hoisted() lets this fixture
// store survive that hoisting so both the firestore mock factory below and
// the purgeUserData tests can read/write the same Map.
const mockFixtures = vi.hoisted(() => ({
  collections: new Map<string, Array<{id: string; data: Record<string, unknown>}>>(),
}));

function mockClauseMatches(data: Record<string, unknown>, clause: {field: string; op: string; value: unknown}): boolean {
  const fieldValue = clause.field.split('.').reduce<unknown>((o, k) => (o as any)?.[k], data);
  if (clause.op === '==') return fieldValue === clause.value;
  if (clause.op === 'array-contains') return Array.isArray(fieldValue) && fieldValue.includes(clause.value);
  return true;
}

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: {credential: (email: string, password: string) => ({email, password})},
  deleteUser: vi.fn(async () => undefined),
  linkWithPhoneNumber: vi.fn(async () => ({
    verificationId: 'verification-id',
    confirm: vi.fn(async () => ({user: {phoneNumber: '+14155550123'}})),
  })),
  reauthenticateWithCredential: vi.fn(async () => undefined),
  unlink: vi.fn(async () => undefined),
  updatePassword: vi.fn(async () => undefined),
}));
vi.mock('firebase/firestore', () => ({
  arrayRemove: (v: unknown) => v,
  collection: (_db: unknown, ...segments: string[]) => ({path: segments.join('/'), clauses: []}),
  deleteDoc: vi.fn(async () => undefined),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDocs: async (ref: any) => {
    const all = mockFixtures.collections.get(ref.path) || [];
    const filtered = all.filter(d => (ref.clauses || []).every((c: any) => mockClauseMatches(d.data, c)));
    return {
      docs: filtered.map(d => ({id: d.id, ref: {id: d.id}, data: () => d.data})),
      empty: filtered.length === 0,
      size: filtered.length,
    };
  },
  limit: () => ({}),
  orderBy: () => ({}),
  query: (ref: any, ...clauses: any[]) => ({
    ...ref,
    clauses: [...(ref.clauses || []), ...clauses.filter(c => c && 'field' in c)],
  }),
  serverTimestamp: () => ({}),
  setDoc: vi.fn(async () => undefined),
  updateDoc: vi.fn(async () => undefined),
  where: (field: string, op: string, value: unknown) => ({field, op, value}),
}));
vi.mock('firebase/storage', () => ({
  deleteObject: vi.fn(async () => undefined),
  listAll: vi.fn(async () => ({items: [], prefixes: []})),
  ref: () => ({}),
}));
vi.mock('../firebase', () => ({auth: {currentUser: null}, db: {}}));
vi.mock('./storage', () => ({storage: {}, deleteStorageObjectByUrl: vi.fn(async () => true)}));
vi.mock('./firestoreBatch', () => ({deleteQueryInChunks: vi.fn(async () => 0)}));
vi.mock('./e2eeKeys', () => ({getOrCreateDeviceKeypair: vi.fn()}));

import {auth} from '../firebase';
import {
  clearLocalData,
  confirmPhoneLink,
  describeAuthError,
  describePhoneLinkError,
  purgeUserData,
  sendPhoneLinkCode,
  unlinkPhoneNumber,
} from './account';
import {encryptMessage, generateKeypair} from './e2ee';

beforeEach(() => {
  localStorage.clear();
  mockFixtures.collections = new Map();
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

describe('describePhoneLinkError', () => {
  it('maps every credential-rejection spelling to wrong-password, same as describeAuthError', () => {
    for (const code of [
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/invalid-login-credentials',
    ]) {
      expect(describePhoneLinkError({code})).toBe('wrong-password');
    }
  });

  it('distinguishes phone-specific failures', () => {
    expect(describePhoneLinkError({code: 'auth/invalid-phone-number'})).toBe('invalid-phone-number');
    expect(describePhoneLinkError({code: 'auth/invalid-verification-code'})).toBe(
      'invalid-verification-code',
    );
    expect(describePhoneLinkError({code: 'auth/code-expired'})).toBe('code-expired');
    expect(describePhoneLinkError({code: 'auth/too-many-requests'})).toBe('too-many-requests');
  });

  it('collapses both spellings Firebase uses for an already-linked phone number', () => {
    expect(describePhoneLinkError({code: 'auth/credential-already-in-use'})).toBe(
      'phone-already-in-use',
    );
    expect(describePhoneLinkError({code: 'auth/provider-already-linked'})).toBe(
      'phone-already-in-use',
    );
  });

  it('reports provider-not-enabled when the Phone sign-in provider is off in the Firebase console', () => {
    expect(describePhoneLinkError({code: 'auth/operation-not-allowed'})).toBe('provider-not-enabled');
    expect(describePhoneLinkError({code: 'auth/admin-restricted-operation'})).toBe(
      'provider-not-enabled',
    );
  });

  it('falls back to unknown rather than mislabelling an unexpected failure', () => {
    expect(describePhoneLinkError({code: 'auth/network-request-failed'})).toBe('unknown');
    expect(describePhoneLinkError(null)).toBe('unknown');
  });
});

describe('phone linking', () => {
  const fakeVerifier = {type: 'recaptcha', verify: vi.fn(async () => 'token')};

  beforeEach(() => {
    (auth as {currentUser: unknown}).currentUser = {
      uid: 'uid1',
      email: 'a@b.com',
      phoneNumber: null,
    };
  });

  it('rejects sendPhoneLinkCode when nobody is signed in', async () => {
    (auth as {currentUser: unknown}).currentUser = null;
    await expect(sendPhoneLinkCode('pw', '+14155550123', fakeVerifier)).rejects.toThrow(
      'not signed in',
    );
  });

  it('sendPhoneLinkCode reauthenticates before starting verification', async () => {
    const confirmation = await sendPhoneLinkCode('pw', '+14155550123', fakeVerifier);
    expect(confirmation.verificationId).toBe('verification-id');
  });

  it('wraps a reauth failure with reason wrong-password', async () => {
    const {reauthenticateWithCredential} = await import('firebase/auth');
    vi.mocked(reauthenticateWithCredential).mockRejectedValueOnce({code: 'auth/wrong-password'});
    await expect(sendPhoneLinkCode('bad-pw', '+14155550123', fakeVerifier)).rejects.toMatchObject({
      reason: 'wrong-password',
    });
  });

  it('confirmPhoneLink writes the verified phone number to the private doc', async () => {
    const {setDoc} = await import('firebase/firestore');
    const confirmation = {
      verificationId: 'verification-id',
      confirm: vi.fn(async () => ({user: {phoneNumber: '+14155550123'}})),
    };
    await confirmPhoneLink(confirmation as never, '123456');
    expect(confirmation.confirm).toHaveBeenCalledWith('123456');
    expect(vi.mocked(setDoc)).toHaveBeenCalledWith(
      {path: 'users/uid1/private/contact'},
      expect.objectContaining({phoneNumber: '+14155550123'}),
      {merge: true},
    );
  });

  it('unlinkPhoneNumber clears the private doc after unlinking', async () => {
    const {unlink} = await import('firebase/auth');
    const {setDoc} = await import('firebase/firestore');
    await unlinkPhoneNumber();
    expect(unlink).toHaveBeenCalledWith(expect.anything(), 'phone');
    expect(vi.mocked(setDoc)).toHaveBeenCalledWith(
      {path: 'users/uid1/private/contact'},
      expect.objectContaining({phoneNumber: null}),
      {merge: true},
    );
  });
});

describe('purgeUserData media cleanup', () => {
  const CHAT_ID = 'chat1';

  async function seedChatWithMedia() {
    const me = generateKeypair();
    const peer = generateKeypair();
    const encryptedPayload = encryptMessage(
      'https://storage.example/secret.jpg',
      me.secretKey,
      peer.publicKey,
      CHAT_ID,
    );

    mockFixtures.collections.set('chats', [{id: CHAT_ID, data: {participants: ['uid1', 'uid2']}}]);
    mockFixtures.collections.set(`chats/${CHAT_ID}/messages`, [
      {id: 'm1', data: {user: {_id: 'uid1'}, image: 'https://storage.example/plain.jpg', createdAt: 1}},
      {id: 'm2', data: {user: {_id: 'uid1'}, encryptedImage: encryptedPayload, createdAt: 2}},
    ]);

    const {getOrCreateDeviceKeypair} = await import('./e2eeKeys');
    const {deleteStorageObjectByUrl} = await import('./storage');
    vi.mocked(deleteStorageObjectByUrl).mockClear();
    return {me, getOrCreateDeviceKeypair: vi.mocked(getOrCreateDeviceKeypair), deleteStorageObjectByUrl: vi.mocked(deleteStorageObjectByUrl)};
  }

  it('cleans up both plaintext and encrypted media once the device key resolves', async () => {
    const {me, getOrCreateDeviceKeypair, deleteStorageObjectByUrl} = await seedChatWithMedia();
    getOrCreateDeviceKeypair.mockResolvedValue(me);

    const report = await purgeUserData('uid1');

    const deletedUrls = deleteStorageObjectByUrl.mock.calls.map(([url]) => url);
    expect(deletedUrls.sort()).toEqual(
      ['https://storage.example/plain.jpg', 'https://storage.example/secret.jpg'].sort(),
    );
    expect(report.storageObjectsDeleted).toBe(2);
    expect(report.errors).toEqual([]);
  });

  it('still cleans up plaintext media but leaves encrypted media orphaned when the device key is unavailable — same degraded fallback as before this fix', async () => {
    const {getOrCreateDeviceKeypair, deleteStorageObjectByUrl} = await seedChatWithMedia();
    getOrCreateDeviceKeypair.mockRejectedValue(new Error('no key material'));

    const report = await purgeUserData('uid1');

    const deletedUrls = deleteStorageObjectByUrl.mock.calls.map(([url]) => url);
    expect(deletedUrls).toEqual(['https://storage.example/plain.jpg']);
    expect(report.storageObjectsDeleted).toBe(1);
    expect(report.errors.some(e => e.includes('device key unavailable'))).toBe(true);
  });
});

describe('describePhoneLinkError — reCAPTCHA failures', () => {
  // These used to fall through to 'unknown', which showed a generic "something
  // went wrong" for what is really a retryable robot-check failure. The
  // password and phone number were valid; only the single-use captcha token
  // was not, which is also what a double-submit produces.
  it('maps invalid-app-credential to a retryable captcha failure', () => {
    expect(describePhoneLinkError({code: 'auth/invalid-app-credential'})).toBe('recaptcha-failed');
  });

  it('maps the other captcha error codes the same way', () => {
    expect(describePhoneLinkError({code: 'auth/captcha-check-failed'})).toBe('recaptcha-failed');
    expect(describePhoneLinkError({code: 'auth/missing-app-credential'})).toBe('recaptcha-failed');
  });

  it('still distinguishes a disabled provider from a captcha failure', () => {
    expect(describePhoneLinkError({code: 'auth/operation-not-allowed'})).toBe('provider-not-enabled');
  });

  it('leaves genuinely unrecognised codes as unknown', () => {
    expect(describePhoneLinkError({code: 'auth/internal-error'})).toBe('unknown');
  });
});
