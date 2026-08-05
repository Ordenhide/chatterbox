// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockLinkWithPhoneNumber = jest.fn();
const mockReauthenticateWithCredential = jest.fn();
const mockUnlink = jest.fn();
const mockSetUserPhoneNumber = jest.fn();
const mockDeleteStorageObjectByUrl = jest.fn();
const mockGetOrCreateDeviceKeypair = jest.fn();

let mockCurrentUser: {uid: string; email: string | null; phoneNumber: string | null} | null = {
  uid: 'uid1',
  email: 'a@b.com',
  phoneNumber: null,
};

const mockFixtures: {
  collections: Map<string, Array<{id: string; data: Record<string, unknown>}>>;
} = {collections: new Map()};

function mockClauseMatches(data: Record<string, unknown>, clause: {field: string; op: string; value: unknown}): boolean {
  const fieldValue = clause.field.split('.').reduce<unknown>((o, k) => (o as any)?.[k], data);
  if (clause.op === '==') return fieldValue === clause.value;
  if (clause.op === 'array-contains') return Array.isArray(fieldValue) && fieldValue.includes(clause.value);
  return true;
}

jest.mock('@react-native-firebase/auth', () => ({
  EmailAuthProvider: {credential: (email: string, password: string) => ({email, password})},
  deleteUser: jest.fn(async () => undefined),
  getAuth: () => ({
    get currentUser() {
      return mockCurrentUser;
    },
  }),
  linkWithPhoneNumber: (...args: unknown[]) => mockLinkWithPhoneNumber(...args),
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthenticateWithCredential(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  updatePassword: jest.fn(async () => undefined),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  arrayRemove: (v: unknown) => v,
  collection: (_db: unknown, ...segments: string[]) => ({path: segments.join('/'), clauses: []}),
  deleteDoc: jest.fn(async () => undefined),
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
  getFirestore: () => ({}),
  limit: () => ({}),
  orderBy: () => ({}),
  query: (ref: any, ...clauses: any[]) => ({
    ...ref,
    clauses: [...(ref.clauses || []), ...clauses.filter(c => c && 'field' in c)],
  }),
  updateDoc: jest.fn(async () => undefined),
  where: (field: string, op: string, value: unknown) => ({field, op, value}),
  writeBatch: () => ({delete: jest.fn(), commit: jest.fn(async () => undefined)}),
}));

jest.mock('@react-native-firebase/storage', () => () => ({
  ref: () => ({listAll: jest.fn(async () => ({items: [], prefixes: []}))}),
}));
jest.mock('../storageMMKV', () => ({mmkvStorage: {clear: jest.fn(async () => undefined)}}));
jest.mock('../telemetry', () => ({reportError: jest.fn()}));
jest.mock('../firebaseChat', () => ({
  setUserPhoneNumber: (...args: unknown[]) => mockSetUserPhoneNumber(...args),
  deleteStorageObjectByUrl: (...args: unknown[]) => mockDeleteStorageObjectByUrl(...args),
}));
jest.mock('../e2eeKeys', () => ({
  getOrCreateDeviceKeypair: (...args: unknown[]) => mockGetOrCreateDeviceKeypair(...args),
}));

import {
  confirmPhoneLink,
  describePhoneLinkError,
  purgeUserData,
  sendPhoneLinkCode,
  unlinkPhoneNumber,
} from '../account';
import {encryptMessage, generateKeypair} from '../e2ee';

beforeEach(() => {
  mockCurrentUser = {uid: 'uid1', email: 'a@b.com', phoneNumber: null};
  mockLinkWithPhoneNumber.mockReset().mockResolvedValue({
    verificationId: 'verification-id',
    confirm: jest.fn(async (code: string) => ({user: {phoneNumber: '+14155550123'}})),
  });
  mockReauthenticateWithCredential.mockReset().mockResolvedValue(undefined);
  mockUnlink.mockReset().mockResolvedValue(undefined);
  mockSetUserPhoneNumber.mockReset().mockResolvedValue(undefined);
  mockDeleteStorageObjectByUrl.mockReset().mockResolvedValue(true);
  mockGetOrCreateDeviceKeypair.mockReset();
  mockFixtures.collections = new Map();
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

describe('sendPhoneLinkCode', () => {
  it('rejects when nobody is signed in', async () => {
    mockCurrentUser = null;
    await expect(sendPhoneLinkCode('pw', '+14155550123')).rejects.toThrow('not signed in');
  });

  it('reauthenticates before starting phone verification', async () => {
    const confirmation = await sendPhoneLinkCode('pw', '+14155550123');
    expect(mockReauthenticateWithCredential).toHaveBeenCalled();
    expect(mockLinkWithPhoneNumber).toHaveBeenCalledWith(mockCurrentUser, '+14155550123');
    expect(confirmation.verificationId).toBe('verification-id');
  });

  it('wraps a reauth failure with reason wrong-password', async () => {
    mockReauthenticateWithCredential.mockRejectedValueOnce({code: 'auth/wrong-password'});
    await expect(sendPhoneLinkCode('bad-pw', '+14155550123')).rejects.toMatchObject({
      reason: 'wrong-password',
    });
    expect(mockLinkWithPhoneNumber).not.toHaveBeenCalled();
  });
});

describe('confirmPhoneLink', () => {
  it('confirms the code and writes the verified phone number to the private doc', async () => {
    const confirmation = {
      verificationId: 'verification-id',
      confirm: jest.fn(async () => ({user: {phoneNumber: '+14155550123'}})),
    };
    await confirmPhoneLink(confirmation as never, '123456');
    expect(confirmation.confirm).toHaveBeenCalledWith('123456');
    expect(mockSetUserPhoneNumber).toHaveBeenCalledWith('uid1', '+14155550123');
  });

  it('wraps an invalid code with reason invalid-verification-code', async () => {
    const confirmation = {
      verificationId: 'verification-id',
      confirm: jest.fn(async () => {
        throw {code: 'auth/invalid-verification-code'};
      }),
    };
    await expect(confirmPhoneLink(confirmation as never, 'bad-code')).rejects.toMatchObject({
      reason: 'invalid-verification-code',
    });
    expect(mockSetUserPhoneNumber).not.toHaveBeenCalled();
  });
});

describe('unlinkPhoneNumber', () => {
  it('unlinks the phone provider then clears the private doc', async () => {
    await unlinkPhoneNumber();
    expect(mockUnlink).toHaveBeenCalledWith(mockCurrentUser, 'phone');
    expect(mockSetUserPhoneNumber).toHaveBeenCalledWith('uid1', null);
  });

  it('rejects when nobody is signed in', async () => {
    mockCurrentUser = null;
    await expect(unlinkPhoneNumber()).rejects.toThrow('not signed in');
  });
});

describe('purgeUserData media cleanup', () => {
  const CHAT_ID = 'chat1';

  function seedChatWithMedia() {
    const me = generateKeypair();
    const peer = generateKeypair();
    const encryptedPayload = encryptMessage(
      'https://storage.example/secret.jpg',
      me.secretKey,
      peer.publicKey,
      CHAT_ID,
    );

    mockFixtures.collections.set('chats', [
      {id: CHAT_ID, data: {participants: ['uid1', 'uid2']}},
    ]);
    mockFixtures.collections.set(`chats/${CHAT_ID}/messages`, [
      {id: 'm1', data: {user: {_id: 'uid1'}, image: 'https://storage.example/plain.jpg', createdAt: 1}},
      {id: 'm2', data: {user: {_id: 'uid1'}, encryptedImage: encryptedPayload, createdAt: 2}},
    ]);
    return {me, peer};
  }

  it('cleans up both plaintext and encrypted media once the device key resolves', async () => {
    const {me} = seedChatWithMedia();
    mockGetOrCreateDeviceKeypair.mockResolvedValue(me);

    const report = await purgeUserData('uid1');

    const deletedUrls = mockDeleteStorageObjectByUrl.mock.calls.map(([url]) => url);
    expect(deletedUrls.sort()).toEqual(
      ['https://storage.example/plain.jpg', 'https://storage.example/secret.jpg'].sort(),
    );
    expect(report.storageObjectsDeleted).toBe(2);
    expect(report.errors).toEqual([]);
  });

  it('still cleans up plaintext media but leaves encrypted media orphaned when the device key is unavailable — same degraded fallback as before this fix', async () => {
    seedChatWithMedia();
    mockGetOrCreateDeviceKeypair.mockRejectedValue(new Error('no key material'));

    const report = await purgeUserData('uid1');

    const deletedUrls = mockDeleteStorageObjectByUrl.mock.calls.map(([url]) => url);
    expect(deletedUrls).toEqual(['https://storage.example/plain.jpg']);
    expect(report.storageObjectsDeleted).toBe(1);
    expect(report.errors.some(e => e.includes('device key unavailable'))).toBe(true);
  });
});
