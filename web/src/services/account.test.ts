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
  /** Deletes and participant-list writes in the order they happened. */
  ops: [] as string[],
}));

/** "path?field=value" — enough to say what a purge query actually asked for. */
const describeQuery = (q: any) =>
  `${q.path}${(q.clauses || [])
    .filter((c: any) => c && 'field' in c)
    .map((c: any) => `?${c.field}=${c.value}`)
    .join('')}`;

function mockClauseMatches(data: Record<string, unknown>, clause: {field: string; op: string; value: unknown}): boolean {
  const fieldValue = clause.field.split('.').reduce<unknown>((o, k) => (o as any)?.[k], data);
  if (clause.op === '==') return fieldValue === clause.value;
  if (clause.op === 'array-contains') return Array.isArray(fieldValue) && fieldValue.includes(clause.value);
  return true;
}

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: {credential: (email: string, password: string) => ({email, password})},
  deleteUser: vi.fn(async () => undefined),
  reauthenticateWithCredential: vi.fn(async () => undefined),
  updatePassword: vi.fn(async () => undefined),
}));
vi.mock('firebase/firestore', () => ({
  arrayRemove: (v: unknown) => v,
  collection: (_db: unknown, ...segments: string[]) => ({path: segments.join('/'), clauses: []}),
  deleteDoc: vi.fn(async (ref: any) => {
    mockFixtures.ops.push(`delete ${ref.path}`);
  }),
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
  updateDoc: vi.fn(async (ref: any, data: Record<string, unknown>) => {
    if ('participants' in data) mockFixtures.ops.push(`leave ${ref.path}`);
  }),
  where: (field: string, op: string, value: unknown) => ({field, op, value}),
}));
vi.mock('firebase/storage', () => ({
  deleteObject: vi.fn(async () => undefined),
  listAll: vi.fn(async () => ({items: [], prefixes: []})),
  ref: () => ({}),
}));
vi.mock('../firebase', () => ({auth: {currentUser: null}, db: {}}));
vi.mock('./storage', () => ({storage: {}, deleteStorageObjectByUrl: vi.fn(async () => true)}));
vi.mock('./firestoreBatch', () => ({
  deleteQueryInChunks: vi.fn(async (q: any) => {
    mockFixtures.ops.push(`purge ${describeQuery(q)}`);
    return 0;
  }),
}));
vi.mock('./e2eeKeys', () => ({
  getOrCreateDeviceKeypair: vi.fn(),
  getDeviceKeypairIfEnrolled: vi.fn(),
}));

import {clearLocalData, describeAuthError, purgeUserData} from './account';
import {USER_SUBCOLLECTIONS} from './userSubcollections';
import {encryptMessage, generateKeypair} from './e2ee';

beforeEach(() => {
  localStorage.clear();
  mockFixtures.collections = new Map();
  mockFixtures.ops = [];
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

    const {getDeviceKeypairIfEnrolled} = await import('./e2eeKeys');
    const {deleteStorageObjectByUrl} = await import('./storage');
    vi.mocked(deleteStorageObjectByUrl).mockClear();
    return {
      me,
      getDeviceKeypair: vi.mocked(getDeviceKeypairIfEnrolled),
      deleteStorageObjectByUrl: vi.mocked(deleteStorageObjectByUrl),
    };
  }

  it('cleans up both plaintext and encrypted media once the device key resolves', async () => {
    const {me, getDeviceKeypair, deleteStorageObjectByUrl} = await seedChatWithMedia();
    getDeviceKeypair.mockResolvedValue(me);

    const report = await purgeUserData('uid1');

    const deletedUrls = deleteStorageObjectByUrl.mock.calls.map(([url]) => url);
    expect(deletedUrls.sort()).toEqual(
      ['https://storage.example/plain.jpg', 'https://storage.example/secret.jpg'].sort(),
    );
    expect(report.storageObjectsDeleted).toBe(2);
    expect(report.errors).toEqual([]);
  });

  it('still cleans up plaintext media but leaves encrypted media orphaned when the device key is unavailable — same degraded fallback as before this fix', async () => {
    const {getDeviceKeypair, deleteStorageObjectByUrl} = await seedChatWithMedia();
    getDeviceKeypair.mockRejectedValue(new Error('no key material'));

    const report = await purgeUserData('uid1');

    const deletedUrls = deleteStorageObjectByUrl.mock.calls.map(([url]) => url);
    expect(deletedUrls).toEqual(['https://storage.example/plain.jpg']);
    expect(report.storageObjectsDeleted).toBe(1);
    expect(report.errors.some(e => e.includes('device key unavailable'))).toBe(true);
  });

  it('degrades the same way on an unenrolled device, without minting a key', async () => {
    const {getDeviceKeypair, deleteStorageObjectByUrl} = await seedChatWithMedia();
    // The reader answers null rather than throwing: holding no key is a state,
    // not a failure. Purging must not be what enrolls a browser — publishing a
    // fresh key would be the last thing this account ever did, and it would
    // strand every other device's history on the way out.
    getDeviceKeypair.mockResolvedValue(null);
    const {getOrCreateDeviceKeypair} = await import('./e2eeKeys');
    vi.mocked(getOrCreateDeviceKeypair).mockClear();

    const report = await purgeUserData('uid1');

    expect(vi.mocked(getOrCreateDeviceKeypair)).not.toHaveBeenCalled();
    expect(deleteStorageObjectByUrl.mock.calls.map(([url]) => url)).toEqual([
      'https://storage.example/plain.jpg',
    ]);
    expect(report.errors.some(e => e.includes('not enrolled'))).toBe(true);
  });
});

/**
 * Deleting a Firestore document does not delete its subcollections, and every
 * rule inside a chat is gated on being a participant — so anything the purge
 * fails to name before it leaves is not merely left behind. deleteAccount
 * removes the auth user immediately afterwards, and that uid can never sign in
 * again to finish the job.
 */
describe('purgeUserData leaves nothing reachable behind', () => {
  beforeEach(() => {
    mockFixtures.collections.set('chats', [
      {id: 'chat1', data: {participants: ['uid1', 'uid2']}},
    ]);
    mockFixtures.collections.set('chats/chat1/messages', []);
  });

  it('purges the one-time prekeys, which no client could ever reach afterwards', async () => {
    await purgeUserData('uid1');
    expect(mockFixtures.ops).toContain('purge users/uid1/oneTimePreKeys');
  });

  it('visits every subcollection on the shared list', async () => {
    await purgeUserData('uid1');
    for (const sub of USER_SUBCOLLECTIONS) {
      expect(mockFixtures.ops).toContain(`purge users/uid1/${sub}`);
    }
  });

  it('takes my pending scheduled messages, trash and sender keys out of the chat', async () => {
    await purgeUserData('uid1');
    // Each filtered on the field its read rule tests — that filter is what
    // makes the query legal, so it belongs in the assertion.
    expect(mockFixtures.ops).toContain('purge chats/chat1/scheduledMessages?user._id=uid1');
    expect(mockFixtures.ops).toContain('purge chats/chat1/trash?deletedBy=uid1');
    expect(mockFixtures.ops).toContain('purge chats/chat1/senderKeys?from=uid1');
    expect(mockFixtures.ops).toContain('delete chats/chat1/liveLocations/uid1');
  });

  // Ordering is the whole game: once participants loses the uid, every rule in
  // the chat denies it, and deleteAccount is one line away.
  it('clears the chat subcollections before leaving the chat', async () => {
    await purgeUserData('uid1');
    const leftAt = mockFixtures.ops.indexOf('leave chats/chat1');
    expect(leftAt).toBeGreaterThan(-1);
    for (const op of [
      'purge chats/chat1/scheduledMessages?user._id=uid1',
      'purge chats/chat1/trash?deletedBy=uid1',
      'purge chats/chat1/senderKeys?from=uid1',
      'delete chats/chat1/liveLocations/uid1',
    ]) {
      const at = mockFixtures.ops.indexOf(op);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(leftAt);
    }
  });
});
