// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive) — see account.test.ts.
const mockFixtures: {
  collections: Map<string, Array<{id: string; data: Record<string, unknown>}>>;
  docs: Map<string, Record<string, unknown> | undefined>;
  throwPaths: Set<string>;
} = {
  collections: new Map(),
  docs: new Map(),
  throwPaths: new Set(),
};

function mockClauseMatches(data: Record<string, unknown>, clause: {field: string; op: string; value: unknown}): boolean {
  const fieldValue = (data as any)?.[clause.field];
  if (clause.op === '==') return fieldValue === clause.value;
  if (clause.op === 'array-contains') return Array.isArray(fieldValue) && fieldValue.includes(clause.value);
  return true;
}

const mockGetOrCreateDeviceKeypair = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({path: segments.join('/'), clauses: []}),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  where: (field: string, op: string, value: unknown) => ({field, op, value}),
  query: (ref: any, ...clauses: any[]) => ({...ref, clauses: [...(ref.clauses || []), ...clauses]}),
  getDocs: async (ref: any) => {
    if (mockFixtures.throwPaths.has(ref.path)) {
      throw new Error(`mock getDocs failure: ${ref.path}`);
    }
    const all = mockFixtures.collections.get(ref.path) || [];
    const filtered = all.filter(d => (ref.clauses || []).every((c: any) => mockClauseMatches(d.data, c)));
    return {docs: filtered.map(d => ({id: d.id, data: () => d.data}))};
  },
  getDoc: async (ref: any) => {
    if (mockFixtures.throwPaths.has(ref.path)) {
      throw new Error(`mock getDoc failure: ${ref.path}`);
    }
    const found = mockFixtures.docs.get(ref.path);
    return {exists: !!found, data: () => found};
  },
  getFirestore: () => ({}),
}));

jest.mock('../e2eeKeys', () => ({
  getOrCreateDeviceKeypair: (...args: unknown[]) => mockGetOrCreateDeviceKeypair(...args),
}));

import {exportUserData, sanitizeForExport, sanitizeMessageForExport} from '../dataExport';
import {encryptMessage, generateKeypair} from '../e2ee';
import {bytesToHex} from '../crypto';

const ME = 'uid1';
const PEER = 'uid2';
const CHAT = 'chat1';

function isoTimestamp(iso: string) {
  return {toDate: () => new Date(iso)};
}

beforeEach(() => {
  mockFixtures.collections = new Map();
  mockFixtures.docs = new Map();
  mockFixtures.throwPaths = new Set();
  mockGetOrCreateDeviceKeypair.mockReset();
});

describe('sanitizeForExport', () => {
  it('converts a duck-typed Firestore Timestamp to an ISO string', () => {
    expect(sanitizeForExport(isoTimestamp('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00.000Z');
  });

  it('recurses into nested arrays and objects', () => {
    const input = {a: [isoTimestamp('2026-01-01T00:00:00.000Z'), {b: isoTimestamp('2026-02-01T00:00:00.000Z')}]};
    expect(sanitizeForExport(input)).toEqual({
      a: ['2026-01-01T00:00:00.000Z', {b: '2026-02-01T00:00:00.000Z'}],
    });
  });

  it('passes primitives and null through unchanged', () => {
    expect(sanitizeForExport('hi')).toBe('hi');
    expect(sanitizeForExport(42)).toBe(42);
    expect(sanitizeForExport(null)).toBe(null);
    expect(sanitizeForExport(undefined)).toBe(undefined);
  });
});

describe('sanitizeMessageForExport', () => {
  it('marks a never-encrypted message as plaintext, unchanged', () => {
    const raw = {text: 'hello', createdAt: isoTimestamp('2026-01-01T00:00:00.000Z')};
    const result = sanitizeMessageForExport(raw, null, CHAT);
    expect(result.decryptionStatus).toBe('plaintext');
    expect(result.text).toBe('hello');
    expect(result.decryptionError).toBeUndefined();
  });

  it('decrypts a valid encrypted field and strips the raw envelope', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('meet at 8', alice.secretKey, bob.publicKey, CHAT);
    const raw = {text: '', encrypted: payload, createdAt: isoTimestamp('2026-01-01T00:00:00.000Z')};

    const result = sanitizeMessageForExport(raw, alice.secretKey, CHAT);
    expect(result.decryptionStatus).toBe('decrypted');
    expect(result.text).toBe('meet at 8');
    expect(result.encrypted).toBeUndefined();
  });

  it('marks a field as failed, not thrown, when no secret key is available', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('meet at 8', alice.secretKey, bob.publicKey, CHAT);
    const raw = {text: '', encrypted: payload};

    const result = sanitizeMessageForExport(raw, null, CHAT);
    expect(result.decryptionStatus).toBe('failed');
    expect(result.text).toBe('');
    expect(result.decryptionError).toMatch(/could not decrypt/);
  });

  it('marks a field as failed, not thrown, when decryption raises (wrong key)', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const mallory = generateKeypair();
    const payload = encryptMessage('meet at 8', alice.secretKey, bob.publicKey, CHAT);

    const result = sanitizeMessageForExport({text: '', encrypted: payload}, mallory.secretKey, CHAT);
    expect(result.decryptionStatus).toBe('failed');
    expect(result.decryptionError).toBeTruthy();
  });

  it('reports partial when some encrypted fields decrypt and others fail', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const mallory = generateKeypair();
    const goodText = encryptMessage('hi', alice.secretKey, bob.publicKey, CHAT);
    // Sealed under a chat id the recipient won't derive against — simulates a
    // corrupted/foreign payload landing in the wrong field.
    const badImage = encryptMessage('https://example.com/x.jpg', mallory.secretKey, bob.publicKey, 'other-chat');

    const result = sanitizeMessageForExport(
      {text: '', encrypted: goodText, image: '', encryptedImage: badImage},
      alice.secretKey,
      CHAT,
    );
    expect(result.decryptionStatus).toBe('partial');
    expect(result.text).toBe('hi');
  });

  it('never leaks the secret key into the output, even serialized', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('super secret plan', alice.secretKey, bob.publicKey, CHAT);
    const result = sanitizeMessageForExport({text: '', encrypted: payload}, alice.secretKey, CHAT);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(bytesToHex(alice.secretKey));
  });
});

describe('exportUserData', () => {
  function seedFixtures() {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const mallory = generateKeypair();

    mockFixtures.docs.set('users/uid1', {displayName: 'Alice', email: 'alice@x.com', photoURL: null});

    mockFixtures.collections.set('chats', [
      {
        id: CHAT,
        data: {
          participants: [ME, PEER],
          name: null,
          wallpaperBy: {},
          createdAt: isoTimestamp('2026-01-01T00:00:00.000Z'),
        },
      },
    ]);
    mockFixtures.collections.set(`chats/${CHAT}/messages`, [
      {
        id: 'm1',
        data: {text: 'hello', createdAt: isoTimestamp('2026-01-02T00:00:00.000Z'), user: {_id: ME, name: 'Alice'}},
      },
      {
        id: 'm2',
        data: {
          text: '',
          encrypted: encryptMessage('secret text', alice.secretKey, bob.publicKey, CHAT),
          createdAt: isoTimestamp('2026-01-03T00:00:00.000Z'),
          user: {_id: PEER, name: 'Bob'},
        },
      },
      {
        id: 'm3',
        data: {
          text: '',
          // Sealed by two unrelated parties — undecryptable by ME's key.
          encrypted: encryptMessage('not for you', mallory.secretKey, bob.publicKey, CHAT),
          createdAt: isoTimestamp('2026-01-04T00:00:00.000Z'),
          user: {_id: PEER, name: 'Bob'},
        },
      },
    ]);

    mockFixtures.collections.set('moments', [
      {id: 'moment1', data: {authorId: ME, text: 'sunset', mediaUrl: 'https://x/y.jpg', visibility: 'public'}},
    ]);
    mockFixtures.collections.set('moments/moment1/likes', [{id: PEER, data: {createdAt: isoTimestamp('2026-01-05T00:00:00.000Z')}}]);
    mockFixtures.collections.set('moments/moment1/comments', [
      {id: 'c1', data: {authorId: PEER, text: 'nice!', createdAt: isoTimestamp('2026-01-05T00:00:00.000Z')}},
    ]);

    mockFixtures.collections.set('friends', [{id: 'uid1_uid2', data: {userIds: [ME, PEER], status: 'accepted'}}]);
    mockFixtures.collections.set('friendRequests', [
      {id: 'fr1', data: {fromId: ME, toId: 'uid3', status: 'pending'}},
      {id: 'fr2', data: {fromId: 'uid3', toId: ME, status: 'pending'}},
      {id: 'fr3', data: {fromId: 'uid3', toId: 'uid4', status: 'pending'}}, // unrelated to ME
    ]);
    mockFixtures.collections.set('blocks', [
      {id: 'b1', data: {blockerId: ME, blockedId: 'uid5'}},
      {id: 'b2', data: {blockerId: 'uid5', blockedId: ME}},
      {id: 'b3', data: {blockerId: 'uid9', blockedId: 'uid8'}}, // unrelated to ME
    ]);

    mockFixtures.collections.set('users/uid1/bookmarks', [
      {id: 'bk1', data: {chatId: CHAT, messageId: 'm1', text: 'hello', senderId: ME, bookmarkedAt: 1}},
    ]);
    mockFixtures.collections.set('users/uid1/reminders', []);
    mockFixtures.collections.set('users/uid1/private', [
      {id: 'contact', data: {phoneNumber: '+15550123', phoneUpdatedAt: isoTimestamp('2026-01-01T00:00:00.000Z')}},
    ]);
    mockFixtures.collections.set('users/uid1/publicKeys', [
      {id: 'e2ee', data: {publicKey: 'base64pubkey', updatedAt: isoTimestamp('2026-01-01T00:00:00.000Z')}},
    ]);

    mockGetOrCreateDeviceKeypair.mockResolvedValue(alice);
    return {alice, bob, mallory};
  }

  it('walks every collection and shapes a complete export', async () => {
    const {alice} = seedFixtures();
    const result = await exportUserData(ME);

    expect(result.uid).toBe(ME);
    expect(result.profile).toMatchObject({displayName: 'Alice', photoURL: null});

    expect(result.chats).toHaveLength(1);
    const chat = result.chats[0] as any;
    expect(chat.id).toBe(CHAT);
    expect(chat.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(chat.messages).toHaveLength(3);
    // Chronological order (oldest first), not Firestore's original doc order.
    expect(chat.messages.map((m: any) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(chat.messages[0]).toMatchObject({text: 'hello', decryptionStatus: 'plaintext'});
    expect(chat.messages[1]).toMatchObject({text: 'secret text', decryptionStatus: 'decrypted'});
    expect(chat.messages[1].encrypted).toBeUndefined();
    expect(chat.messages[2]).toMatchObject({decryptionStatus: 'failed'});

    expect(result.moments).toHaveLength(1);
    expect((result.moments[0] as any).likes).toHaveLength(1);
    expect((result.moments[0] as any).comments).toHaveLength(1);

    expect(result.friends).toHaveLength(1);
    expect(result.friendRequests.map((r: any) => r.id).sort()).toEqual(['fr1', 'fr2']);
    expect(result.blocks.map((b: any) => b.id).sort()).toEqual(['b1', 'b2']);

    expect(result.bookmarks).toHaveLength(1);
    expect(result.reminders).toHaveLength(0);
    expect(result.private).toHaveLength(1);
    expect(result.publicKeys).toHaveLength(1);

    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.report).toMatchObject({
      chatsProcessed: 1,
      messagesProcessed: 3,
      messagesDecryptFailed: 1,
      momentsProcessed: 1,
      errors: [],
    });

    // Security-critical: the secret key used to decrypt must never end up in
    // the exported, JSON-serializable output.
    expect(JSON.stringify(result)).not.toContain(bytesToHex(alice.secretKey));
  });

  it('isolates a failure in one section from the rest of the export', async () => {
    seedFixtures();
    mockFixtures.throwPaths.add('moments');

    const result = await exportUserData(ME);

    expect(result.moments).toEqual([]);
    expect(result.report.errors.some(e => e.includes('moments'))).toBe(true);
    // Unaffected sections still populate.
    expect(result.chats).toHaveLength(1);
    expect(result.friends).toHaveLength(1);
  });

  it('degrades to failed-decryption rather than aborting when the device key is unavailable', async () => {
    seedFixtures();
    mockGetOrCreateDeviceKeypair.mockReset().mockRejectedValue(new Error('no key material'));

    const result = await exportUserData(ME);

    expect(result.report.errors.some(e => e.includes('device key unavailable'))).toBe(true);
    const chat = result.chats[0] as any;
    const encryptedMessages = chat.messages.filter((m: any) => m.id === 'm2' || m.id === 'm3');
    expect(encryptedMessages.every((m: any) => m.decryptionStatus === 'failed')).toBe(true);
    // The rest of the export is unaffected by the missing key.
    expect(result.profile).toMatchObject({displayName: 'Alice'});
    expect(result.moments).toHaveLength(1);
  });
});
