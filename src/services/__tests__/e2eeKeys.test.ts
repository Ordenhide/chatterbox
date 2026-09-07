// e2eeKeys.ts touches the Firestore SDK and native MMKV storage at import
// time; stub both so these tests exercise the key-change decision logic
// (fetchPeerPublicKeyChecked) rather than any native bridge.
//
// Jest hoists jest.mock() factories above imports and only allows them to
// close over variables prefixed with `mock` (case-insensitive) — anything
// else throws "not allowed to reference any out-of-scope variables".
const mockFirestoreDocs = new Map<string, {publicKey?: string}>();
// Lets a test simulate the network being down for a read or a write, which is
// how the restore path's "couldn't verify" / "couldn't publish" branches are
// reached.
const mockOutage = {read: false, write: false};

jest.mock('../firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDoc: async (ref: {path: string}) => {
    if (mockOutage.read) throw new Error('network unavailable');
    const data = mockFirestoreDocs.get(ref.path);
    return {exists: () => !!data, data: () => data};
  },
  setDoc: async (
    ref: {path: string},
    data: {publicKey?: string},
    opts?: {merge?: boolean},
  ) => {
    if (mockOutage.write) throw new Error('network unavailable');
    const existing = opts?.merge ? mockFirestoreDocs.get(ref.path) : undefined;
    mockFirestoreDocs.set(ref.path, {...existing, ...data});
  },
  serverTimestamp: () => 'TS',
}));

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

/**
 * Stand-in for the OS key store. `available` flips it between a build with
 * the native module linked and one without, and `writeSucceeds` simulates the
 * case that matters most: a store that accepts a write but cannot read it
 * back, where migrating must NOT delete the only surviving copy of the key.
 */
const mockKeychain = {
  available: false,
  writeSucceeds: true,
  store: new Map<string, string>(),
};
jest.mock('../secureKeyStore', () => ({
  secretKeyService: (userId: string) => `svc.${userId}`,
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

// errorLog.ts is mocked so a deliberately-failing branch does not print
// through the suite output; e2eeKeys.ts only needs these two as no-ops here.
jest.mock('../errorLog', () => ({
  reportError: () => undefined,
  reportHandled: () => undefined,
}));

// The platform key backup (iCloud Keychain / Block Store) reaches native code
// this suite has no business booting. Mocked as a store that holds nothing, so
// these tests keep describing local key storage — and so the enrolment
// assertions below are about what enrolment writes, not about whether a
// backup happened to be available.
const mockBackupStore = new Map<string, string>();
jest.mock('../keyBackup', () => ({
  saveRecoveryPhrase: jest.fn(async (uid: string, phrase: string) => {
    mockBackupStore.set(uid, phrase);
    return true;
  }),
  loadRecoveryPhrase: jest.fn(async (uid: string) => mockBackupStore.get(uid) ?? null),
  clearRecoveryPhrase: jest.fn(async (uid: string) => {
    mockBackupStore.delete(uid);
  }),
}));

import {bytesToBase64, bytesToHex} from '../crypto';
import {generateKeypair} from '../e2ee';
import {secretKeyToMnemonic} from '../e2eeMnemonic';
import {
  _resetKeypairCache,
  adoptSeedAsDeviceKey,
  clearDeviceKeypair,
  enrollmentReadiness,
  fetchPeerPublicKeyChecked,
  getDeviceKeypairIfEnrolled,
  getKeyGeneration,
  getOrCreateDeviceKeypair,
  getRecoveryPhrase,
  hasRevealedRecoveryPhrase,
  markRecoveryPhraseRevealed,
  republishKeyIfAccountHasNone,
  restoreDeviceKeypairFromBackup,
  restoreDeviceKeypairFromPhrase,
} from '../e2eeKeys';

const PEER = 'peer-uid';
const publicKeyPath = `users/${PEER}/publicKeys/e2ee`;
const publicKeyPathFor = (userId: string) => `users/${userId}/publicKeys/e2ee`;

function publishPeerKey(publicKey: Uint8Array) {
  mockFirestoreDocs.set(publicKeyPath, {publicKey: bytesToBase64(publicKey)});
}

beforeEach(() => {
  mockBackupStore.clear();
  mockFirestoreDocs.clear();
  mockMmkvStore.clear();
  mockOutage.read = false;
  mockOutage.write = false;
  mockKeychain.available = false;
  mockKeychain.writeSucceeds = true;
  mockKeychain.store.clear();
  _resetKeypairCache();
});

describe('secret key storage / OS key store migration', () => {
  const ME = 'me-uid';
  const MMKV_KEY = `e2ee_secret_key_v1_${ME}`;
  const SERVICE = `svc.${ME}`;

  it('keeps using MMKV when the key store is unavailable', async () => {
    // The pre-Keychain build, and the HarmonyOS/unlinked case. Must behave
    // exactly as before rather than failing to enrol.
    const {secretKey} = await getOrCreateDeviceKeypair(ME);
    expect(mockMmkvStore.get(MMKV_KEY)).toBe(bytesToHex(secretKey));
    expect(mockKeychain.store.size).toBe(0);
  });

  it('puts a newly generated key in the key store, not MMKV', async () => {
    mockKeychain.available = true;
    const {secretKey} = await getOrCreateDeviceKeypair(ME);
    expect(mockKeychain.store.get(SERVICE)).toBe(bytesToHex(secretKey));
    expect(mockMmkvStore.has(MMKV_KEY)).toBe(false);
  });

  it('migrates an existing MMKV key into the key store and drops the weaker copy', async () => {
    const existing = bytesToHex(generateKeypair().secretKey);
    mockMmkvStore.set(MMKV_KEY, existing);
    mockKeychain.available = true;

    const {secretKey} = await getOrCreateDeviceKeypair(ME);

    // Same identity, moved — not a re-enrolment, which would silently orphan
    // every message this account can currently decrypt.
    expect(bytesToHex(secretKey)).toBe(existing);
    expect(mockKeychain.store.get(SERVICE)).toBe(existing);
    expect(mockMmkvStore.has(MMKV_KEY)).toBe(false);
  });

  it('KEEPS the MMKV copy when the key store cannot read the value back', async () => {
    // The property the whole migration hinges on. A store that accepts a
    // write but returns nothing on read must never cause the only surviving
    // copy of the user's identity key to be deleted — losing it means losing
    // every message they can decrypt, recoverable only from a phrase most
    // users will not have written down.
    const existing = bytesToHex(generateKeypair().secretKey);
    mockMmkvStore.set(MMKV_KEY, existing);
    mockKeychain.available = true;
    mockKeychain.writeSucceeds = false;

    const {secretKey} = await getOrCreateDeviceKeypair(ME);

    expect(bytesToHex(secretKey)).toBe(existing);
    expect(mockMmkvStore.get(MMKV_KEY)).toBe(existing);
  });

  it('still enrols into MMKV when a brand-new key cannot be stored securely', async () => {
    // A key with nowhere durable to live would be regenerated on every launch,
    // breaking decryption for everything sent in between.
    mockKeychain.available = true;
    mockKeychain.writeSucceeds = false;
    const {secretKey} = await getOrCreateDeviceKeypair(ME);
    expect(mockMmkvStore.get(MMKV_KEY)).toBe(bytesToHex(secretKey));
  });

  it('prefers the key store over a stale MMKV copy', async () => {
    const inStore = bytesToHex(generateKeypair().secretKey);
    const stale = bytesToHex(generateKeypair().secretKey);
    mockKeychain.available = true;
    mockKeychain.store.set(SERVICE, inStore);
    mockMmkvStore.set(MMKV_KEY, stale);

    const {secretKey} = await getOrCreateDeviceKeypair(ME);
    expect(bytesToHex(secretKey)).toBe(inStore);
  });

  it('reports an enrolled account as safe when its key is only in the key store', async () => {
    // enrollmentReadiness gates the "restore your key" prompt — reading only
    // MMKV would tell a migrated user they had lost a key they still have.
    mockKeychain.available = true;
    mockKeychain.store.set(SERVICE, bytesToHex(generateKeypair().secretKey));
    _resetKeypairCache();
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  it('finds a key-store key from getDeviceKeypairIfEnrolled', async () => {
    const existing = generateKeypair();
    mockKeychain.available = true;
    mockKeychain.store.set(SERVICE, bytesToHex(existing.secretKey));
    _resetKeypairCache();
    const found = await getDeviceKeypairIfEnrolled(ME);
    expect(found && bytesToHex(found.secretKey)).toBe(bytesToHex(existing.secretKey));
  });

  it('clearDeviceKeypair erases both locations', async () => {
    // Account deletion wipes MMKV wholesale, which no longer reaches the key
    // store — without this the identity key would outlive the account.
    mockKeychain.available = true;
    mockMmkvStore.set(MMKV_KEY, 'aa');
    mockKeychain.store.set(SERVICE, 'bb');
    await clearDeviceKeypair(ME);
    expect(mockMmkvStore.has(MMKV_KEY)).toBe(false);
    expect(mockKeychain.store.has(SERVICE)).toBe(false);
  });

  it('migrates the pre-scoping legacy key without ever leaving it nowhere', async () => {
    const legacy = bytesToHex(generateKeypair().secretKey);
    mockMmkvStore.set('e2ee_secret_key_v1', legacy);
    mockKeychain.available = true;

    const {secretKey} = await getOrCreateDeviceKeypair(ME);

    expect(bytesToHex(secretKey)).toBe(legacy);
    expect(mockKeychain.store.get(SERVICE)).toBe(legacy);
    expect(mockMmkvStore.has('e2ee_secret_key_v1')).toBe(false);
  });
});

describe('fetchPeerPublicKeyChecked', () => {
  it('reports unenrolled when the peer has never published a key', async () => {
    const {status, key} = await fetchPeerPublicKeyChecked(PEER);
    expect(status).toBe('unenrolled');
    expect(key).toBeNull();
  });

  it('reports first-contact the first time this device sees the key, not changed', async () => {
    // Trust-on-first-use: an unseen key is not itself suspicious, or every
    // brand-new conversation would show a "key changed" warning.
    publishPeerKey(generateKeypair().publicKey);
    const {status} = await fetchPeerPublicKeyChecked(PEER);
    expect(status).toBe('first-contact');
  });

  it('reports unchanged on a second fetch of the same key', async () => {
    publishPeerKey(generateKeypair().publicKey);
    await fetchPeerPublicKeyChecked(PEER); // first-contact, caches it
    const {status} = await fetchPeerPublicKeyChecked(PEER);
    expect(status).toBe('unchanged');
  });

  it('reports changed when the key differs from what was cached', async () => {
    publishPeerKey(generateKeypair().publicKey);
    await fetchPeerPublicKeyChecked(PEER); // first-contact

    // The peer's key is substituted — by a reinstall, or by an attacker.
    publishPeerKey(generateKeypair().publicKey);
    const {status} = await fetchPeerPublicKeyChecked(PEER);
    expect(status).toBe('changed');
  });

  it('only reports changed once — the new key becomes the new baseline', async () => {
    publishPeerKey(generateKeypair().publicKey);
    await fetchPeerPublicKeyChecked(PEER);
    publishPeerKey(generateKeypair().publicKey);

    const first = await fetchPeerPublicKeyChecked(PEER);
    const second = await fetchPeerPublicKeyChecked(PEER);
    expect(first.status).toBe('changed');
    expect(second.status).toBe('unchanged');
  });

  it('returns the actual key bytes alongside the status', async () => {
    const {publicKey} = generateKeypair();
    publishPeerKey(publicKey);
    const {key} = await fetchPeerPublicKeyChecked(PEER);
    expect(key).toEqual(publicKey);
  });
});

const ME = 'my-uid';
// A second *local* account signed into this device — distinct from PEER,
// which represents the other party in a conversation.
const OTHER_ACCOUNT = 'other-local-uid';

describe('getRecoveryPhrase', () => {
  it('generates a device keypair if needed and returns it as a mnemonic', async () => {
    const phrase = await getRecoveryPhrase(ME);
    expect(phrase.split(' ')).toHaveLength(24);
  });

  it('encodes the same key getOrCreateDeviceKeypair already returned', async () => {
    const {secretKey} = await getOrCreateDeviceKeypair(ME);
    const phrase = await getRecoveryPhrase(ME);
    expect(phrase).toBe(secretKeyToMnemonic(secretKey));
  });
});

describe('hasRevealedRecoveryPhrase / markRecoveryPhraseRevealed', () => {
  it('defaults to false for an account that has never revealed its phrase', async () => {
    expect(await hasRevealedRecoveryPhrase(ME)).toBe(false);
  });

  it('flips to true, and stays true, once marked', async () => {
    await markRecoveryPhraseRevealed(ME);
    expect(await hasRevealedRecoveryPhrase(ME)).toBe(true);
  });

  it('is scoped per account: marking one account revealed does not affect another', async () => {
    await markRecoveryPhraseRevealed(ME);
    expect(await hasRevealedRecoveryPhrase(OTHER_ACCOUNT)).toBe(false);
  });
});

describe('cross-account isolation on a shared device', () => {
  // Regression coverage for the bug this scoping was added to fix: signing
  // out of one account and into another, within the same app process, must
  // never hand the second account the first account's real secret key.
  it('does not leak the in-memory cached keypair from one account to another', async () => {
    const first = await getOrCreateDeviceKeypair(ME);
    _resetKeypairCache(); // what AuthContext.signOut now does

    const second = await getOrCreateDeviceKeypair(OTHER_ACCOUNT);
    expect(second.secretKey).not.toEqual(first.secretKey);
  });

  it('gives each account its own on-disk key, even without a cache reset', async () => {
    // Guards the storage layer itself, independent of the in-memory cache
    // fix: even if some future call site forgets to reset the cache, a
    // fresh getOrCreateDeviceKeypair for a different uid must not read
    // another account's stored key.
    const first = await getOrCreateDeviceKeypair(ME);
    const second = await getOrCreateDeviceKeypair(OTHER_ACCOUNT);
    expect(second.secretKey).not.toEqual(first.secretKey);

    _resetKeypairCache();
    const secondAgain = await getOrCreateDeviceKeypair(OTHER_ACCOUNT);
    expect(secondAgain.secretKey).toEqual(second.secretKey);
  });

  it('migrates a pre-scoping device-wide key to the first account that asks for it, then clears it', async () => {
    const legacyKeypair = generateKeypair();
    mockMmkvStore.set('e2ee_secret_key_v1', bytesToHex(legacyKeypair.secretKey));

    const migrated = await getOrCreateDeviceKeypair(ME);
    expect(migrated.secretKey).toEqual(legacyKeypair.secretKey);
    expect(mockMmkvStore.has('e2ee_secret_key_v1')).toBe(false);
  });

  it('does not let a second account inherit an already-migrated legacy key', async () => {
    const legacyKeypair = generateKeypair();
    mockMmkvStore.set('e2ee_secret_key_v1', bytesToHex(legacyKeypair.secretKey));

    const owner = await getOrCreateDeviceKeypair(ME);
    _resetKeypairCache();
    const other = await getOrCreateDeviceKeypair(OTHER_ACCOUNT);

    expect(owner.secretKey).toEqual(legacyKeypair.secretKey);
    expect(other.secretKey).not.toEqual(legacyKeypair.secretKey);
  });
});

describe('enrollmentReadiness', () => {
  // Regression coverage for the race this guards: a passive/automatic
  // enrollment trigger (sign-in, the recovery-phrase reminder) must be able
  // to tell "brand new account, safe to auto-enroll" apart from "this
  // account already has a key published elsewhere, enrolling now would
  // silently strand it" *before* calling getOrCreateDeviceKeypair.

  it('is safe for a brand new account with nothing published anywhere', async () => {
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  it('needs restore when the account has a published key but this device has no local copy', async () => {
    mockFirestoreDocs.set(publicKeyPathFor(ME), {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });
    expect(await enrollmentReadiness(ME)).toBe('needs-restore');
  });

  it('is safe once this device has enrolled (cached in memory)', async () => {
    await getOrCreateDeviceKeypair(ME);
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  it('is safe once this device has enrolled, even after the in-memory cache is dropped', async () => {
    await getOrCreateDeviceKeypair(ME);
    _resetKeypairCache(); // e.g. app restart, or AuthContext.signOut
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  it('is safe when the pre-scoping legacy key is the account key, since it is migrated not overwritten', async () => {
    // The legacy secret has to be the one behind the published key for this
    // to test migration at all. Generating an unrelated one — as this did —
    // also passed, but only because holding any key answered 'safe'; it was
    // really asserting the short-circuit, and would have kept passing if
    // migration were deleted outright.
    const legacy = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {publicKey: bytesToBase64(legacy.publicKey)});
    mockMmkvStore.set('e2ee_secret_key_v1', bytesToHex(legacy.secretKey));
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  // The state that had no answer before this: the device is enrolled, so
  // every check said 'safe', while the account's key had moved on and nothing
  // it received would open. Sending kept working, because that seals to the
  // peer's key — so the app looked healthy from the composer and was silent
  // about the one thing wrong with it.
  it('reports superseded when the account has replaced the key this device holds', async () => {
    await getOrCreateDeviceKeypair(ME);
    expect(await enrollmentReadiness(ME)).toBe('safe');

    // Another device restores a different phrase and republishes over this one.
    mockFirestoreDocs.set(publicKeyPathFor(ME), {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });

    // Deliberately no _resetKeypairCache: the in-memory cache was the first
    // and hardest short-circuit, answering 'safe' before any I/O at all.
    expect(await enrollmentReadiness(ME)).toBe('superseded');
  });

  it('reports superseded from the stored key alone, with no in-memory cache', async () => {
    await getOrCreateDeviceKeypair(ME);
    mockFirestoreDocs.set(publicKeyPathFor(ME), {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });
    _resetKeypairCache();
    expect(await enrollmentReadiness(ME)).toBe('superseded');
  });

  it('reports superseded for a legacy key the account has moved on from', async () => {
    mockFirestoreDocs.set(publicKeyPathFor(ME), {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });
    mockMmkvStore.set('e2ee_secret_key_v1', bytesToHex(generateKeypair().secretKey));
    expect(await enrollmentReadiness(ME)).toBe('superseded');
  });

  // The whole point of reporting it: there is a way out, and this is it.
  it('is safe again once the superseding phrase is restored', async () => {
    await getOrCreateDeviceKeypair(ME);
    const current = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {publicKey: bytesToBase64(current.publicKey)});
    expect(await enrollmentReadiness(ME)).toBe('superseded');

    await restoreDeviceKeypairFromPhrase(ME, secretKeyToMnemonic(current.secretKey));
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  it('is safe again after successfully restoring from a recovery phrase', async () => {
    const original = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {publicKey: bytesToBase64(original.publicKey)});
    expect(await enrollmentReadiness(ME)).toBe('needs-restore');

    const phrase = secretKeyToMnemonic(original.secretKey);
    await restoreDeviceKeypairFromPhrase(ME, phrase);
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  it('reports unknown rather than safe when the published key cannot be read', async () => {
    // Collapsing a failed read into "safe" is how a network blip turns into
    // an overwrite of the account's real key — the same mistake the restore
    // path's verification check guards against.
    mockOutage.read = true;
    expect(await enrollmentReadiness(ME)).toBe('unknown');
  });

  it('still answers safe offline once this device holds the account key', async () => {
    // Offline must not block a device that has nothing to lose by enrolling.
    await getOrCreateDeviceKeypair(ME);
    _resetKeypairCache();
    mockOutage.read = true;
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  it('does not itself enroll or publish anything — it is read-only', async () => {
    mockFirestoreDocs.set(publicKeyPathFor(ME), {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });
    await enrollmentReadiness(ME);
    expect(mockMmkvStore.has('e2ee_secret_key_v1_' + ME)).toBe(false);
  });
});

describe('restoreDeviceKeypairFromPhrase', () => {
  it('rejects a phrase that fails BIP39 validation', async () => {
    const result = await restoreDeviceKeypairFromPhrase(ME, 'not a real recovery phrase');
    expect(result).toEqual({success: false, reason: 'invalid-phrase'});
  });

  it('rejects a well-formed phrase whose key does not match what is published', async () => {
    // Someone else's key is on file for this account (e.g. a typo'd phrase,
    // or a stale phrase from before a rotation) — must not silently adopt it.
    mockFirestoreDocs.set(publicKeyPathFor(ME), {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });
    const unrelatedPhrase = secretKeyToMnemonic(generateKeypair().secretKey);

    const result = await restoreDeviceKeypairFromPhrase(ME, unrelatedPhrase);
    expect(result).toEqual({success: false, reason: 'key-mismatch'});
  });

  it('accepts a phrase whose derived key matches the published key', async () => {
    const original = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {publicKey: bytesToBase64(original.publicKey)});
    const phrase = secretKeyToMnemonic(original.secretKey);

    const result = await restoreDeviceKeypairFromPhrase(ME, phrase);
    expect(result).toEqual({success: true});

    // The restored key becomes this device's active keypair going forward.
    const active = await getOrCreateDeviceKeypair(ME);
    expect(active.secretKey).toEqual(original.secretKey);
  });

  it('accepts a phrase for an account with no published key yet (unenrolled)', async () => {
    const original = generateKeypair();
    const phrase = secretKeyToMnemonic(original.secretKey);

    const result = await restoreDeviceKeypairFromPhrase(ME, phrase);
    expect(result).toEqual({success: true});
    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))?.publicKey).toBe(
      bytesToBase64(original.publicKey),
    );
  });

  it('refuses rather than guessing when the published key cannot be read', async () => {
    // The mismatch check treats "no key published" as safe to proceed. A
    // failed read must not be collapsed into that same answer, or a wrong
    // phrase sails through whenever the network happens to be flaky.
    const unrelatedPhrase = secretKeyToMnemonic(generateKeypair().secretKey);
    mockOutage.read = true;

    const result = await restoreDeviceKeypairFromPhrase(ME, unrelatedPhrase);
    expect(result).toEqual({success: false, reason: 'verification-unavailable'});
  });

  it('changes nothing locally when the published key cannot be read', async () => {
    const existing = await getOrCreateDeviceKeypair(ME);
    const generationBefore = getKeyGeneration();
    mockOutage.read = true;

    await restoreDeviceKeypairFromPhrase(
      ME,
      secretKeyToMnemonic(generateKeypair().secretKey),
    );

    _resetKeypairCache();
    expect((await getOrCreateDeviceKeypair(ME)).secretKey).toEqual(existing.secretKey);
    expect(getKeyGeneration()).toBe(generationBefore);
  });

  it('reports publish failure without switching this device to the new key', async () => {
    // The dangerous half-applied state: local key swapped, public half never
    // published. Nothing would retry it (getOrCreateDeviceKeypair only
    // publishes on first generation), so the device would be silently
    // undecryptable to everyone. It must stay on its old key instead.
    //
    // Reaching the publish step requires passing verification first, so this
    // uses the "account has no published key" path — a device holding a local
    // key for an account whose enrollment never landed.
    const existing = await getOrCreateDeviceKeypair(ME);
    mockFirestoreDocs.clear();
    const generationBefore = getKeyGeneration();
    const phrase = secretKeyToMnemonic(generateKeypair().secretKey);
    mockOutage.write = true;

    const result = await restoreDeviceKeypairFromPhrase(ME, phrase);
    expect(result).toEqual({success: false, reason: 'publish-failed'});

    _resetKeypairCache();
    expect((await getOrCreateDeviceKeypair(ME)).secretKey).toEqual(existing.secretKey);
    expect(getKeyGeneration()).toBe(generationBefore);
  });
});

describe('getKeyGeneration', () => {
  // Screens that cache decrypt results per message id (not per key) rely on
  // this counter to know when a restore has changed the key out from under
  // them, so a message that failed under the old key gets retried instead of
  // staying stuck — see ChatScreen's decryptKeyGenerationRef.
  it('does not change just from generating this device its first keypair', async () => {
    const before = getKeyGeneration();
    await getOrCreateDeviceKeypair(ME);
    expect(getKeyGeneration()).toBe(before);
  });

  it('does not change when a restore is rejected', async () => {
    const before = getKeyGeneration();

    await restoreDeviceKeypairFromPhrase(ME, 'not a real recovery phrase');
    expect(getKeyGeneration()).toBe(before);

    mockFirestoreDocs.set(publicKeyPathFor(ME), {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });
    const unrelatedPhrase = secretKeyToMnemonic(generateKeypair().secretKey);
    await restoreDeviceKeypairFromPhrase(ME, unrelatedPhrase);
    expect(getKeyGeneration()).toBe(before);
  });

  it('increments each time a phrase is successfully restored', async () => {
    const original = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {publicKey: bytesToBase64(original.publicKey)});
    const phrase = secretKeyToMnemonic(original.secretKey);

    const before = getKeyGeneration();
    await restoreDeviceKeypairFromPhrase(ME, phrase);
    expect(getKeyGeneration()).toBe(before + 1);

    await restoreDeviceKeypairFromPhrase(ME, phrase);
    expect(getKeyGeneration()).toBe(before + 2);
  });
});

describe('getDeviceKeypairIfEnrolled', () => {
  // The bug this exists to close: ChatScreen called getOrCreateDeviceKeypair
  // just to *read*, so opening a chat with sealed messages was enough for a
  // freshly-installed second device to publish over the account's key and
  // orphan everything sealed to the first one.
  it('does not enroll or publish when this device has no key', async () => {
    expect(await getDeviceKeypairIfEnrolled(ME)).toBeNull();
    expect(mockFirestoreDocs.has(publicKeyPathFor(ME))).toBe(false);
    expect(mockMmkvStore.size).toBe(0);
  });

  it('never overwrites a key published by another device', async () => {
    const firstDevice = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {
      publicKey: bytesToBase64(firstDevice.publicKey),
    });

    expect(await getDeviceKeypairIfEnrolled(ME)).toBeNull();

    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))).toEqual({
      publicKey: bytesToBase64(firstDevice.publicKey),
    });
  });

  it('returns the key once this device actually has one', async () => {
    const enrolled = await getOrCreateDeviceKeypair(ME);
    _resetKeypairCache();

    const read = await getDeviceKeypairIfEnrolled(ME);
    expect(read).not.toBeNull();
    expect(bytesToHex(read!.secretKey)).toBe(bytesToHex(enrolled.secretKey));
  });

  it('counts the pre-scoping legacy key as enrolled without consuming it', async () => {
    const legacy = generateKeypair();
    mockMmkvStore.set('e2ee_secret_key_v1', bytesToHex(legacy.secretKey));

    const read = await getDeviceKeypairIfEnrolled(ME);
    expect(bytesToHex(read!.publicKey)).toBe(bytesToHex(legacy.publicKey));
    // Migration belongs to the writer path alone, so the reader leaves it be.
    expect(mockMmkvStore.get('e2ee_secret_key_v1')).toBe(bytesToHex(legacy.secretKey));
  });
});

describe('restoreDeviceKeypairFromBackup', () => {
  const {saveRecoveryPhrase} = require('../keyBackup');

  it('is false when the platform is holding nothing for this account', async () => {
    expect(await restoreDeviceKeypairFromBackup(ME)).toBe(false);
  });

  it('is false without a user, rather than asking the platform for ""', async () => {
    expect(await restoreDeviceKeypairFromBackup('')).toBe(false);
  });

  it('restores the key when the backup matches what is published', async () => {
    const kp = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {publicKey: bytesToBase64(kp.publicKey)});
    await saveRecoveryPhrase(ME, secretKeyToMnemonic(kp.secretKey));

    expect(await restoreDeviceKeypairFromBackup(ME)).toBe(true);
    const enrolled = await getDeviceKeypairIfEnrolled(ME);
    expect(enrolled && bytesToHex(enrolled.secretKey)).toBe(bytesToHex(kp.secretKey));
  });

  /**
   * The property that keeps automatic restore from doing damage.
   *
   * A backed-up phrase that does not match the published key means another
   * device has since replaced this identity. Republishing the old one would
   * strand everything encrypted to the new one — silently, at launch, with
   * nobody having asked. So this path must *not* pass allowKeyMismatch, and
   * must hand the case back to the caller, which asks a human.
   */
  it('refuses a backup the published key has moved on from', async () => {
    const older = generateKeypair();
    const newer = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {publicKey: bytesToBase64(newer.publicKey)});
    await saveRecoveryPhrase(ME, secretKeyToMnemonic(older.secretKey));

    expect(await restoreDeviceKeypairFromBackup(ME)).toBe(false);
    // And it left the newer key in place rather than republishing over it.
    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))?.publicKey).toBe(
      bytesToBase64(newer.publicKey),
    );
  });

  it('is false for a backup that is not a valid phrase at all', async () => {
    await saveRecoveryPhrase(ME, 'not a real recovery phrase');
    expect(await restoreDeviceKeypairFromBackup(ME)).toBe(false);
  });
});

describe('restoreDeviceKeypairFromPhrase with allowKeyMismatch', () => {
  it('still rejects a superseded phrase by default', async () => {
    const older = generateKeypair();
    const newer = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {publicKey: bytesToBase64(newer.publicKey)});

    const result = await restoreDeviceKeypairFromPhrase(
      ME,
      secretKeyToMnemonic(older.secretKey),
    );
    expect(result).toEqual({success: false, reason: 'key-mismatch'});
  });

  // The multi-device case: a later device republished over the original key,
  // so the phrase that opens the stranded history is *guaranteed* not to match
  // what's on file. Refusing it left no way out of the situation restore
  // exists for.
  it('accepts it when the user confirms, and republishes the older key', async () => {
    const older = generateKeypair();
    const newer = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {publicKey: bytesToBase64(newer.publicKey)});

    const before = getKeyGeneration();
    const result = await restoreDeviceKeypairFromPhrase(
      ME,
      secretKeyToMnemonic(older.secretKey),
      {allowKeyMismatch: true},
    );

    expect(result).toEqual({success: true});
    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))?.publicKey).toBe(
      bytesToBase64(older.publicKey),
    );
    // Bumped so screens holding per-message decrypt caches discard them and
    // retry under the restored key.
    expect(getKeyGeneration()).toBe(before + 1);
  });

  it('does not waive the checks that protect against losing data', async () => {
    // A garbled phrase is still garbled, and a failed publish still leaves the
    // device untouched — confirming a mismatch is not a licence to skip these.
    expect(
      await restoreDeviceKeypairFromPhrase(ME, 'not a real phrase', {allowKeyMismatch: true}),
    ).toEqual({success: false, reason: 'invalid-phrase'});

    const older = generateKeypair();
    mockOutage.write = true;
    expect(
      await restoreDeviceKeypairFromPhrase(ME, secretKeyToMnemonic(older.secretKey), {
        allowKeyMismatch: true,
      }),
    ).toEqual({success: false, reason: 'publish-failed'});
    expect(mockMmkvStore.size).toBe(0);
  });
});

describe('fetchPeerPublicKeyChecked distinguishes unreachable from unenrolled', () => {
  // The plaintext leak this closes: both cases used to arrive as `key: null`,
  // and the send path reads a null key as licence to send in clear. A peer who
  // genuinely has no key is a real answer; a failed lookup is not an answer at
  // all, and a *sustained* failure (captive portal, blocked region) would have
  // disabled encryption for every message with nothing shown to the user.
  it('reports unenrolled only when the server actually says so', async () => {
    const {status, key} = await fetchPeerPublicKeyChecked(PEER);
    expect(status).toBe('unenrolled');
    expect(key).toBeNull();
  });

  it('reports unavailable when the lookup fails, never unenrolled', async () => {
    publishPeerKey(generateKeypair().publicKey);
    mockOutage.read = true;

    const {status, key} = await fetchPeerPublicKeyChecked(PEER);
    expect(status).toBe('unavailable');
    expect(key).toBeNull();
  });

  it('does not poison the trust cache with a failed lookup', async () => {
    const real = generateKeypair().publicKey;
    publishPeerKey(real);
    expect((await fetchPeerPublicKeyChecked(PEER)).status).toBe('first-contact');

    // An outage in the middle of an established conversation must not be
    // mistaken for the peer's key changing — that is the substitution warning,
    // and crying wolf trains users to dismiss the real one.
    mockOutage.read = true;
    expect((await fetchPeerPublicKeyChecked(PEER)).status).toBe('unavailable');

    mockOutage.read = false;
    expect((await fetchPeerPublicKeyChecked(PEER)).status).toBe('unchanged');
  });

  it('still reports a genuine key change once reachable again', async () => {
    publishPeerKey(generateKeypair().publicKey);
    await fetchPeerPublicKeyChecked(PEER);
    publishPeerKey(generateKeypair().publicKey);
    expect((await fetchPeerPublicKeyChecked(PEER)).status).toBe('changed');
  });
});

describe('adoptSeedAsDeviceKey', () => {
  const ME = 'seed-uid';
  const SEED = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);
  const MMKV_KEY = `e2ee_secret_key_v1_${ME}`;

  it('installs the seed itself as the key, and publishes its public half', async () => {
    await adoptSeedAsDeviceKey(ME, SEED);

    expect(mockMmkvStore.get(MMKV_KEY)).toBe(bytesToHex(SEED));
    const enrolled = await getDeviceKeypairIfEnrolled(ME);
    expect(bytesToHex(enrolled!.secretKey)).toBe(bytesToHex(SEED));
    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))?.publicKey).toBe(
      bytesToBase64(enrolled!.publicKey),
    );
  });

  it('overwrites a key this device already had', async () => {
    // The lazy path's contract is "keep whatever you have". This one's is
    // "the account has exactly one key", so a device that enrolled a random
    // one first has to be corrected rather than left as it is.
    const stray = await getOrCreateDeviceKeypair(ME);
    expect(bytesToHex(stray.secretKey)).not.toBe(bytesToHex(SEED));

    await adoptSeedAsDeviceKey(ME, SEED);

    expect(bytesToHex((await getDeviceKeypairIfEnrolled(ME))!.secretKey)).toBe(bytesToHex(SEED));
    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))?.publicKey).not.toBe(
      bytesToBase64(stray.publicKey),
    );
  });

  it('bumps the key generation so cached decrypt failures are retried', async () => {
    const before = getKeyGeneration();
    await adoptSeedAsDeviceKey(ME, SEED);
    expect(getKeyGeneration()).toBeGreaterThan(before);
  });

  it('backs the phrase up to the platform store', async () => {
    await adoptSeedAsDeviceKey(ME, SEED);
    expect(mockBackupStore.get(ME)).toBe(secretKeyToMnemonic(SEED));
  });

  it('throws when the public key cannot be published', async () => {
    // Sign-in must fail rather than leave an account nobody can encrypt to.
    // Nothing would retry it: getOrCreateDeviceKeypair publishes only when it
    // generates, and by now this device holds a stored key.
    mockOutage.write = true;
    await expect(adoptSeedAsDeviceKey(ME, SEED)).rejects.toThrow();
  });

  it('can be retried after a failure, because the account is deterministic', async () => {
    mockOutage.write = true;
    await expect(adoptSeedAsDeviceKey(ME, SEED)).rejects.toThrow();

    mockOutage.write = false;
    await adoptSeedAsDeviceKey(ME, SEED);
    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))?.publicKey).toBe(
      bytesToBase64((await getDeviceKeypairIfEnrolled(ME))!.publicKey),
    );
  });

  it('leaves the right key on the device even when publishing fails', async () => {
    mockOutage.write = true;
    await expect(adoptSeedAsDeviceKey(ME, SEED)).rejects.toThrow();
    expect(mockMmkvStore.get(MMKV_KEY)).toBe(bytesToHex(SEED));
  });
});

describe('republishKeyIfAccountHasNone', () => {
  const ME = 'republish-uid';
  const SEED = new Uint8Array(32).map((_, i) => (i * 11 + 5) & 0xff);

  it('publishes the key this device holds when the account advertises none', async () => {
    // The hole it exists for: adoption wrote the key locally and then failed
    // to publish it. Nothing else retries — getOrCreateDeviceKeypair publishes
    // only on the call that generates, and this device now holds a stored key.
    mockOutage.write = true;
    await expect(adoptSeedAsDeviceKey(ME, SEED)).rejects.toThrow();
    mockOutage.write = false;
    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))).toBeUndefined();

    await republishKeyIfAccountHasNone(ME);

    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))?.publicKey).toBe(
      bytesToBase64((await getDeviceKeypairIfEnrolled(ME))!.publicKey),
    );
  });

  it('never mints a key, however unenrolled the device is', async () => {
    // This is the whole reason the automatic enrolment it replaced had to go:
    // a minted key published after the phrase-derived one leaves the account
    // advertising a key its own recovery phrase cannot match.
    await republishKeyIfAccountHasNone(ME);

    expect(await getDeviceKeypairIfEnrolled(ME)).toBeNull();
    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))).toBeUndefined();
  });

  it('leaves a key published by another device alone', async () => {
    // A published key that differs is the superseded state, and republishing
    // over it would strand everything encrypted to the newer one. That
    // decision belongs to the user, via the restore screen.
    await adoptSeedAsDeviceKey(ME, SEED);
    const otherDevice = generateKeypair();
    mockFirestoreDocs.set(publicKeyPathFor(ME), {
      publicKey: bytesToBase64(otherDevice.publicKey),
    });

    await republishKeyIfAccountHasNone(ME);

    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))?.publicKey).toBe(
      bytesToBase64(otherDevice.publicKey),
    );
  });

  it('does nothing, and reports nothing, when the lookup fails', async () => {
    // A repair no one is waiting on must not turn a network blip into a
    // publish decision made on missing information.
    await adoptSeedAsDeviceKey(ME, SEED);
    mockFirestoreDocs.delete(publicKeyPathFor(ME));
    mockOutage.read = true;

    await expect(republishKeyIfAccountHasNone(ME)).resolves.toBeUndefined();
    expect(mockFirestoreDocs.get(publicKeyPathFor(ME))).toBeUndefined();
  });
});
