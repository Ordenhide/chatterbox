// Jest hoists jest.mock() factories above imports and only allows them to
// close over variables prefixed with `mock`.

/** Firestore stand-in: a path -> data map, plus enough of the query surface
 * that claiming a one-time prekey (a transaction over a filtered read) can be
 * exercised rather than stubbed away. */
const mockDocs = new Map<string, Record<string, unknown>>();
const mockOutage = {read: false, write: false};
/** Forces the transaction to observe a doc claimed between read and write —
 * the race two simultaneous senders actually create. */
const mockRace = {claimUnderneath: false};

jest.mock('../firebase/firestore', () => {
  const refFor = (path: string) => ({path, id: path.split('/').pop() as string});
  return {
    getFirestore: () => ({}),
    collection: (parent: unknown, name: string) => ({
      path: `${(parent as {path?: string})?.path ?? ''}${(parent as {path?: string})?.path ? '/' : ''}${name}`,
    }),
    doc: (parent: unknown, ...segments: string[]) => {
      const base = (parent as {path?: string})?.path;
      return refFor([base, ...segments].filter(Boolean).join('/'));
    },
    getDoc: async (ref: {path: string}) => {
      if (mockOutage.read) throw new Error('network unavailable');
      const data = mockDocs.get(ref.path);
      return {exists: () => !!data, data: () => data};
    },
    setDoc: async (ref: {path: string}, data: Record<string, unknown>, opts?: {merge?: boolean}) => {
      if (mockOutage.write) throw new Error('network unavailable');
      const existing = opts?.merge ? mockDocs.get(ref.path) : undefined;
      mockDocs.set(ref.path, {...existing, ...data});
    },
    deleteDoc: async (ref: {path: string}) => {
      mockDocs.delete(ref.path);
    },
    getDocs: async (q: {path: string; field?: string; value?: unknown; max?: number}) => {
      if (mockOutage.read) throw new Error('network unavailable');
      let docs = [...mockDocs.entries()]
        .filter(([path]) => path.startsWith(`${q.path}/`) && path.slice(q.path.length + 1).indexOf('/') === -1)
        .map(([path, data]) => ({id: path.split('/').pop() as string, ref: refFor(path), data: () => data}));
      if (q.field !== undefined) docs = docs.filter(d => (d.data() as never)[q.field!] === q.value);
      if (q.max !== undefined) docs = docs.slice(0, q.max);
      return {docs, size: docs.length, empty: docs.length === 0};
    },
    query: (base: {path: string}, ...clauses: Record<string, unknown>[]) =>
      Object.assign({path: base.path}, ...clauses),
    where: (field: string, _op: string, value: unknown) => ({field, value}),
    limit: (max: number) => ({max}),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: async (ref: {path: string}) => {
          if (mockRace.claimUnderneath) {
            // Someone else claimed it between the listing read and this
            // transactional one — which is exactly why the transaction
            // re-reads rather than trusting the listing.
            const current = mockDocs.get(ref.path);
            if (current) mockDocs.set(ref.path, {...current, claimed: true});
          }
          const data = mockDocs.get(ref.path);
          return {exists: () => !!data, data: () => data};
        },
        update: (ref: {path: string}, patch: Record<string, unknown>) => {
          mockDocs.set(ref.path, {...(mockDocs.get(ref.path) as object), ...patch});
        },
      }),
    serverTimestamp: () => 'TS',
  };
});

const mockMmkvStore = new Map<string, string>();
jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async (key: string) => mockMmkvStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockMmkvStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockMmkvStore.delete(key);
    },
  },
}));

const mockKeychain = {available: false, writeSucceeds: true, store: new Map<string, string>()};
jest.mock('../secureKeyStore', () => ({
  isSecureStoreAvailable: () => mockKeychain.available,
  getSecret: async (service: string) =>
    mockKeychain.available ? mockKeychain.store.get(service) ?? null : null,
  setSecretVerified: async (service: string, secret: string) => {
    if (!mockKeychain.available || !mockKeychain.writeSucceeds) return false;
    mockKeychain.store.set(service, secret);
    return true;
  },
  removeSecret: async (service: string) => {
    mockKeychain.store.delete(service);
  },
}));

jest.mock('../telemetry', () => ({reportError: () => undefined}));

import {
  ONE_TIME_PREKEY_BATCH,
  PreKeyBundleUnavailableError,
  _resetRatchetIdentityCache,
  burnOneTimePreKey,
  clearRatchetKeys,
  ensureRatchetKeysPublished,
  fetchPeerPreKeyBundle,
  fetchPeerRatchetIdentity,
  getOrCreateRatchetIdentity,
  loadPreKeySecrets,
  publishRatchetKeys,
  preKeySecretsForResponding,
  ratchetKeyStatus,
  rotateSignedPreKey,
  topUpOneTimePreKeys,
} from '../ratchetKeys';
import {initiateX3DH, respondX3DH} from '../ratchet/x3dh';
import {bytesToBase64} from '../crypto';

const ME = 'user-me';
const PEER = 'user-peer';

beforeEach(() => {
  mockDocs.clear();
  mockMmkvStore.clear();
  mockKeychain.store.clear();
  mockKeychain.available = false;
  mockKeychain.writeSucceeds = true;
  mockOutage.read = false;
  mockOutage.write = false;
  mockRace.claimUnderneath = false;
  _resetRatchetIdentityCache();
});

describe('ratchet identity', () => {
  it('creates one on first use and returns the same one afterwards', async () => {
    const first = await getOrCreateRatchetIdentity(ME);
    _resetRatchetIdentityCache();
    const second = await getOrCreateRatchetIdentity(ME);
    expect(bytesToBase64(second.publicKey)).toBe(bytesToBase64(first.publicKey));
  });

  it('keeps identities separate per account', async () => {
    const mine = await getOrCreateRatchetIdentity(ME);
    _resetRatchetIdentityCache();
    const theirs = await getOrCreateRatchetIdentity('other-account');
    expect(bytesToBase64(theirs.publicKey)).not.toBe(bytesToBase64(mine.publicKey));
  });

  it('prefers the OS key store when it is available', async () => {
    mockKeychain.available = true;
    await getOrCreateRatchetIdentity(ME);
    expect([...mockKeychain.store.keys()].some(k => k.includes('identity'))).toBe(true);
    expect([...mockMmkvStore.keys()].some(k => k.startsWith('ratchet_identity'))).toBe(false);
  });

  it('keeps the MMKV copy when the key store cannot read it back', async () => {
    // Same safety property as the E2EE device key: a store that accepts a
    // write and returns nothing must never cost the only copy.
    mockKeychain.available = true;
    mockKeychain.writeSucceeds = false;
    await getOrCreateRatchetIdentity(ME);
    expect([...mockMmkvStore.keys()].some(k => k.startsWith('ratchet_identity'))).toBe(true);
  });

  it('refuses to silently replace an identity it cannot read', async () => {
    // Generating a fresh one instead would orphan every session already
    // established under the old identity, with no indication why.
    mockMmkvStore.set('ratchet_identity_v1_' + ME, 'not json at all');
    await expect(getOrCreateRatchetIdentity(ME)).rejects.toThrow(/unreadable/);
  });

  it('does not publish as a side effect of being created', async () => {
    await getOrCreateRatchetIdentity(ME);
    expect(mockDocs.has(`users/${ME}/publicKeys/ratchet`)).toBe(false);
  });
});

describe('publishing', () => {
  it('publishes a bundle and a full batch of one-time prekeys', async () => {
    await publishRatchetKeys(ME);
    const bundle = mockDocs.get(`users/${ME}/publicKeys/ratchet`);
    expect(bundle?.identityKey).toBeDefined();
    expect(bundle?.signedPreKeySignature).toBeDefined();

    const status = await ratchetKeyStatus(ME);
    expect(status.published).toBe(true);
    expect(status.unclaimedPreKeys).toBe(ONE_TIME_PREKEY_BATCH);
  });

  it('gives every prekey a Firestore-safe document id', async () => {
    // These ids become document ids. Base64 contains '/', which is a path
    // separator there rather than a character, so a base64 id silently
    // publishes the key into a nested path nobody looks in — the batch comes
    // out short and nothing reports an error.
    await publishRatchetKeys(ME);
    const secrets = await loadPreKeySecrets(ME);
    const ids = [...secrets!.oneTimePreKeys.keys(), ...secrets!.signedPreKeys.keys()];
    expect(ids).toHaveLength(ONE_TIME_PREKEY_BATCH + 1);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(id).not.toMatch(/^__.*__$/);
    }
  });

  it('stores the private half before publishing anything', async () => {
    // Publishing first would advertise a prekey this device cannot answer,
    // making the first message of every conversation started against it
    // permanently undecryptable.
    mockOutage.write = true;
    await expect(publishRatchetKeys(ME)).rejects.toThrow();
    expect(await loadPreKeySecrets(ME)).not.toBeNull();
  });

  it('leaves the existing X25519 identity completely alone', async () => {
    // The whole coexistence premise: history must keep decrypting.
    mockDocs.set(`users/${ME}/publicKeys/e2ee`, {publicKey: 'existing-x25519'});
    await publishRatchetKeys(ME);
    expect(mockDocs.get(`users/${ME}/publicKeys/e2ee`)).toEqual({publicKey: 'existing-x25519'});
  });
});

describe('ensureRatchetKeysPublished', () => {
  it('publishes when nothing is published yet', async () => {
    await ensureRatchetKeysPublished(ME);
    expect((await ratchetKeyStatus(ME)).published).toBe(true);
  });

  it('does not republish when the batch is healthy', async () => {
    await publishRatchetKeys(ME);
    const before = mockDocs.get(`users/${ME}/publicKeys/ratchet`)?.signedPreKeyId;
    await ensureRatchetKeysPublished(ME);
    expect(mockDocs.get(`users/${ME}/publicKeys/ratchet`)?.signedPreKeyId).toBe(before);
  });

  it('tops the batch back up once it runs low, without touching the signed prekey', async () => {
    await publishRatchetKeys(ME);
    const before = mockDocs.get(`users/${ME}/publicKeys/ratchet`)?.signedPreKeyId;
    // Drain all but a handful, as a busy peer (or a griefer) would.
    const keys = [...mockDocs.keys()].filter(k => k.startsWith(`users/${ME}/oneTimePreKeys/`));
    const survivors = keys.slice(keys.length - 3);
    for (const k of keys.slice(0, keys.length - 3)) mockDocs.delete(k);

    await ensureRatchetKeysPublished(ME);

    // The signed prekey is not due for rotation, so it must not move.
    expect(mockDocs.get(`users/${ME}/publicKeys/ratchet`)?.signedPreKeyId).toBe(before);
    expect((await ratchetKeyStatus(ME)).unclaimedPreKeys).toBe(ONE_TIME_PREKEY_BATCH);

    // The three that survived are still published AND still answerable.
    const secrets = await loadPreKeySecrets(ME);
    for (const path of survivors) {
      const id = path.split('/').pop()!;
      expect(mockDocs.has(path)).toBe(true);
      expect(secrets!.oneTimePreKeys.has(id)).toBe(true);
    }
  });

  it('never throws when the network is down', async () => {
    // A device that cannot publish simply cannot be reached over the ratchet
    // yet. It must not block sign-in or take the app down.
    mockOutage.read = true;
    await expect(ensureRatchetKeysPublished(ME)).resolves.toBeUndefined();
  });
});

describe('fetching a peer bundle', () => {
  it('returns null when the peer has not published a ratchet identity', async () => {
    // An old client, not an error — this is what tells the caller to use the
    // existing static-DH path.
    expect(await fetchPeerPreKeyBundle(ME, PEER)).toBeNull();
  });

  it('throws rather than reporting "no ratchet" when the lookup fails', async () => {
    // The distinction this project has already had to fix once: treating an
    // unreachable server as "peer has no forward secrecy" is a silent
    // downgrade.
    await publishRatchetKeys(PEER);
    mockOutage.read = true;
    await expect(fetchPeerPreKeyBundle(ME, PEER)).rejects.toThrow(PreKeyBundleUnavailableError);
  });

  it('returns a usable bundle including a claimed one-time prekey', async () => {
    await publishRatchetKeys(PEER);
    const bundle = await fetchPeerPreKeyBundle(ME, PEER);
    expect(bundle).not.toBeNull();
    expect(bundle!.bundle.oneTimePreKey).toBeDefined();
    expect(mockDocs.get(`users/${PEER}/oneTimePreKeys/${bundle!.bundle.oneTimePreKey!.id}`)?.claimed).toBe(true);
  });

  it('records that a prekey was claimed but never by whom', async () => {
    // A claimedBy field would hand the server a log of who started talking to
    // whom, for no benefit — the owner finds the secret by id locally.
    await publishRatchetKeys(PEER);
    const bundle = await fetchPeerPreKeyBundle(ME, PEER);
    const claimed = mockDocs.get(`users/${PEER}/oneTimePreKeys/${bundle!.bundle.oneTimePreKey!.id}`)!;
    expect(Object.keys(claimed)).not.toContain('claimedBy');
  });

  it('hands two callers different one-time prekeys', async () => {
    await publishRatchetKeys(PEER);
    const a = await fetchPeerPreKeyBundle(ME, PEER);
    const b = await fetchPeerPreKeyBundle(ME, PEER);
    expect(a!.bundle.oneTimePreKey!.id).not.toBe(b!.bundle.oneTimePreKey!.id);
  });

  it('still returns a bundle when the batch is exhausted', async () => {
    // Degradation, not failure: X3DH without a one-time prekey is still
    // authenticated and forward-secret. Failing would let anyone block
    // messaging to a user by draining their batch.
    await publishRatchetKeys(PEER);
    for (const path of [...mockDocs.keys()].filter(p => p.startsWith(`users/${PEER}/oneTimePreKeys/`))) {
      mockDocs.delete(path);
    }
    const bundle = await fetchPeerPreKeyBundle(ME, PEER);
    expect(bundle).not.toBeNull();
    expect(bundle!.bundle.oneTimePreKey).toBeUndefined();
  });

  it('gives up the contested key rather than handing out a claimed one', async () => {
    // The race two simultaneous senders create. Losing it must never end with
    // both sides holding the same one-time prekey.
    await publishRatchetKeys(PEER);
    mockRace.claimUnderneath = true;
    const bundle = await fetchPeerPreKeyBundle(ME, PEER);
    expect(bundle).not.toBeNull();
    expect(bundle!.bundle.oneTimePreKey).toBeUndefined();
  });

  it('rejects a bundle whose signed prekey was substituted', async () => {
    // The exact attack the signature exists to stop, arriving from the server.
    await publishRatchetKeys(PEER);
    const published = mockDocs.get(`users/${PEER}/publicKeys/ratchet`)!;
    mockDocs.set(`users/${PEER}/publicKeys/ratchet`, {
      ...published,
      signedPreKey: bytesToBase64(new Uint8Array(32).fill(7)),
    });
    await expect(fetchPeerPreKeyBundle(ME, PEER)).rejects.toThrow(PreKeyBundleUnavailableError);
  });
});

describe('end to end against the crypto core', () => {
  it('lets two devices derive the same secret through published keys', async () => {
    // The join this whole file exists for: what gets published has to be
    // exactly what X3DH needs, in the shape it needs.
    await publishRatchetKeys(PEER);
    _resetRatchetIdentityCache();
    const peerIdentity = await getOrCreateRatchetIdentity(PEER);

    _resetRatchetIdentityCache();
    const myIdentity = await getOrCreateRatchetIdentity(ME);
    const bundle = await fetchPeerPreKeyBundle(ME, PEER);

    const {sharedSecret, initial} = initiateX3DH(myIdentity, bundle!.bundle);
    const peerSecrets = await preKeySecretsForResponding(PEER, initial.signedPreKeyId);
    const theirs = respondX3DH(peerIdentity, peerSecrets!, initial);
    expect(bytesToBase64(theirs)).toBe(bytesToBase64(sharedSecret));
  });

  it('still answers a message built against the signed prekey it just rotated away', () => {
    // The window that makes keeping one previous generation worth the state:
    // a peer fetches the bundle, rotation happens, then their message arrives
    // naming the key that was current when they looked. Without the grace
    // copy this is a permanently undecryptable first message, reported as
    // nothing at all.
    return (async () => {
      await publishRatchetKeys(PEER);
      _resetRatchetIdentityCache();
      const peerIdentity = await getOrCreateRatchetIdentity(PEER);
      _resetRatchetIdentityCache();
      const myIdentity = await getOrCreateRatchetIdentity(ME);

      const bundle = await fetchPeerPreKeyBundle(ME, PEER);
      const {sharedSecret, initial} = initiateX3DH(myIdentity, bundle!.bundle);

      // ...rotation lands before the message is processed.
      _resetRatchetIdentityCache();
      await rotateSignedPreKey(PEER);

      const peerSecrets = await preKeySecretsForResponding(PEER, initial.signedPreKeyId);
      expect(peerSecrets).not.toBeNull();
      expect(bytesToBase64(respondX3DH(peerIdentity, peerSecrets!, initial))).toBe(
        bytesToBase64(sharedSecret),
      );
    })();
  });

  it('reports rather than guesses when the named signed prekey is long gone', async () => {
    // Two rotations later the key really is unavailable. Substituting the
    // current one would derive a different secret and fail later with a much
    // more confusing symptom than "cannot answer this handshake".
    await publishRatchetKeys(PEER);
    const first = (await loadPreKeySecrets(PEER))!.currentSignedPreKeyId;
    _resetRatchetIdentityCache();
    await rotateSignedPreKey(PEER);
    _resetRatchetIdentityCache();
    await rotateSignedPreKey(PEER);
    expect(await preKeySecretsForResponding(PEER, first)).toBeNull();
  });

  it('top-up leaves already-published keys answerable', async () => {
    // The bug this replaced: regenerating the batch on top-up replaced the
    // stored secrets, so every still-published key from the old batch became
    // unanswerable — a peer could claim one and get an undecryptable first
    // message, with nothing reporting an error anywhere.
    await publishRatchetKeys(PEER);
    const before = await loadPreKeySecrets(PEER);
    const survivingId = [...before!.oneTimePreKeys.keys()][0];

    _resetRatchetIdentityCache();
    await topUpOneTimePreKeys(PEER, 10);

    const after = await loadPreKeySecrets(PEER);
    expect(after!.oneTimePreKeys.has(survivingId)).toBe(true);
    expect(after!.oneTimePreKeys.size).toBe(ONE_TIME_PREKEY_BATCH + 10);
    expect(after!.currentSignedPreKeyId).toBe(before!.currentSignedPreKeyId);
  });
});

describe('burning a used one-time prekey', () => {
  it('removes only the named key', async () => {
    await publishRatchetKeys(ME);
    const secrets = await loadPreKeySecrets(ME);
    const id = [...secrets!.oneTimePreKeys.keys()][0];

    await burnOneTimePreKey(ME, id);

    const after = await loadPreKeySecrets(ME);
    expect(after!.oneTimePreKeys.has(id)).toBe(false);
    expect(after!.oneTimePreKeys.size).toBe(ONE_TIME_PREKEY_BATCH - 1);
    expect(after!.currentSignedPreKeyId).toBe(secrets!.currentSignedPreKeyId);
  });

  it('is a no-op for a key this device does not hold', async () => {
    await publishRatchetKeys(ME);
    await expect(burnOneTimePreKey(ME, 'never-existed')).resolves.toBeUndefined();
    expect((await loadPreKeySecrets(ME))!.oneTimePreKeys.size).toBe(ONE_TIME_PREKEY_BATCH);
  });
});

describe('clearRatchetKeys', () => {
  it('removes the identity and prekey secrets from both stores', async () => {
    mockKeychain.available = true;
    await publishRatchetKeys(ME);
    await clearRatchetKeys(ME);
    expect(mockKeychain.store.size).toBe(0);
    expect([...mockMmkvStore.keys()].filter(k => k.startsWith('ratchet_'))).toEqual([]);
    _resetRatchetIdentityCache();
    expect(await loadPreKeySecrets(ME)).toBeNull();
  });
});

describe('trust-on-first-use for the ratchet identity', () => {
  it('reports first contact, then unchanged', async () => {
    await publishRatchetKeys(PEER);
    expect((await fetchPeerRatchetIdentity(ME, PEER)).status).toBe('first-contact');
    expect((await fetchPeerRatchetIdentity(ME, PEER)).status).toBe('unchanged');
  });

  it('reports a substituted identity as changed', async () => {
    // The attack the bundle signature does NOT catch: a server that swaps the
    // identity *and* the prekey it signs passes verification cleanly. Noticing
    // the identity moved is the only thing standing against it.
    await publishRatchetKeys(PEER);
    await fetchPeerRatchetIdentity(ME, PEER);

    const published = mockDocs.get(`users/${PEER}/publicKeys/ratchet`)!;
    mockDocs.set(`users/${PEER}/publicKeys/ratchet`, {
      ...published,
      identityKey: bytesToBase64(new Uint8Array(32).fill(9)),
    });
    expect((await fetchPeerRatchetIdentity(ME, PEER)).status).toBe('changed');
  });

  it('reports unavailable on a failed lookup, never unenrolled', async () => {
    await publishRatchetKeys(PEER);
    mockOutage.read = true;
    expect((await fetchPeerRatchetIdentity(ME, PEER)).status).toBe('unavailable');
  });

  it('does not claim a one-time prekey just to read the identity', async () => {
    // A safety-number screen the user can reopen must not drain a peer's
    // batch. This is why the read is separate from the bundle fetch.
    await publishRatchetKeys(PEER);
    const before = (await ratchetKeyStatus(PEER)).unclaimedPreKeys;
    await fetchPeerRatchetIdentity(ME, PEER);
    await fetchPeerRatchetIdentity(ME, PEER);
    expect((await ratchetKeyStatus(PEER)).unclaimedPreKeys).toBe(before);
  });

  it('surfaces the identity status alongside the bundle', async () => {
    await publishRatchetKeys(PEER);
    expect((await fetchPeerPreKeyBundle(ME, PEER))!.identityStatus).toBe('first-contact');
    expect((await fetchPeerPreKeyBundle(ME, PEER))!.identityStatus).toBe('unchanged');
  });

  it('keeps trust per local account', async () => {
    // A shared device signed into two accounts must not let one inherit the
    // other's trust history for the same contact.
    await publishRatchetKeys(PEER);
    await fetchPeerRatchetIdentity(ME, PEER);
    expect((await fetchPeerRatchetIdentity('other-account', PEER)).status).toBe('first-contact');
  });
});
