import {beforeEach, describe, expect, it, vi} from 'vitest';
import {bytesToBase64} from './crypto';
import {generateKeypair} from './e2ee';

/**
 * In-memory localStorage — mirrors session.test.ts's stand-in. This
 * environment doesn't provide a persistent one, and relying on the ambient
 * implementation would make the cross-account namespacing assertions below
 * untrustworthy anyway (that's the thing under test).
 */
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

/** Stand-in for Firestore, keyed by the doc path "users/{uid}/publicKeys/e2ee". */
const firestoreDocs = new Map<string, {publicKey?: string; caps?: string[]}>();

/** Makes the next getDoc reject, standing in for a network/permission failure. */
let firestoreUnreachable = false;

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDoc: async (ref: {path: string}) => {
    if (firestoreUnreachable) throw new Error('network unreachable');
    const data = firestoreDocs.get(ref.path);
    return {exists: () => !!data, data: () => data};
  },
  setDoc: async (ref: {path: string}, data: {publicKey: string}) => {
    firestoreDocs.set(ref.path, {...firestoreDocs.get(ref.path), ...data});
  },
  serverTimestamp: () => 'TS',
}));
vi.mock('../firebase', () => ({db: {}}));

import {
  _resetKeypairCache,
  enrollmentReadiness,
  getDeviceKeypairIfEnrolled,
  fetchPeerPublicKeyChecked,
  getKeyGeneration,
  getOrCreateDeviceKeypair,
  getRecoveryPhrase,
  hasRevealedRecoveryPhrase,
  markRecoveryPhraseRevealed,
  publishPublicKey,
  restoreDeviceKeypairFromPhrase,
} from './e2eeKeys';
import {secretKeyToMnemonic} from './e2eeMnemonic';

const ME = 'me-uid';
const OTHER_ME = 'someone-else-uid'; // a second account signed into this same browser
const PEER = 'peer-uid';

function publishPeerKey(publicKey: Uint8Array) {
  firestoreDocs.set(`users/${PEER}/publicKeys/e2ee`, {publicKey: bytesToBase64(publicKey)});
}

beforeEach(() => {
  firestoreDocs.clear();
  memoryStorage.clear();
  firestoreUnreachable = false;
  _resetKeypairCache();
});

describe('getOrCreateDeviceKeypair', () => {
  it('publishes the public key on first call', async () => {
    const {publicKey} = await getOrCreateDeviceKeypair(ME);
    const stored = firestoreDocs.get(`users/${ME}/publicKeys/e2ee`);
    expect(stored?.publicKey).toBe(bytesToBase64(publicKey));
  });

  it('returns the same keypair on a second call (persisted, not regenerated)', async () => {
    const first = await getOrCreateDeviceKeypair(ME);
    _resetKeypairCache(); // drop the in-memory cache — simulates a page reload
    const second = await getOrCreateDeviceKeypair(ME);
    expect(bytesToBase64(second.secretKey)).toBe(bytesToBase64(first.secretKey));
  });

  it("keeps two accounts' keys separate in the same browser", async () => {
    // drafts.ts already namespaces localStorage by uid for exactly this
    // reason (see its own comment) — a shared browser signing into a second
    // Chatterbox account must not inherit the first account's secret key.
    const mine = await getOrCreateDeviceKeypair(ME);
    const theirs = await getOrCreateDeviceKeypair(OTHER_ME);
    expect(bytesToBase64(theirs.secretKey)).not.toBe(bytesToBase64(mine.secretKey));

    _resetKeypairCache();
    const mineAgain = await getOrCreateDeviceKeypair(ME);
    expect(bytesToBase64(mineAgain.secretKey)).toBe(bytesToBase64(mine.secretKey));
  });
});

describe('publishPublicKey / fetchPeerPublicKeyChecked', () => {
  it('reports unenrolled when the peer has never published a key', async () => {
    const {status, key} = await fetchPeerPublicKeyChecked(ME, PEER);
    expect(status).toBe('unenrolled');
    expect(key).toBeNull();
  });

  it('reports unavailable — NOT unenrolled — when the lookup fails', async () => {
    // The distinction is a plaintext leak if lost. Callers answer 'unenrolled'
    // with a cleartext send (the peer genuinely has no key to seal to); a
    // failed lookup is not that answer, it is no answer, and must never be
    // read as permission to send in clear. This previously came back as
    // 'unenrolled', so any network blip silently disabled encryption.
    firestoreUnreachable = true;
    const {status, key} = await fetchPeerPublicKeyChecked(ME, PEER);
    expect(status).toBe('unavailable');
    expect(key).toBeNull();
  });

  it('does not poison the trust cache when the lookup fails', async () => {
    // A failed fetch must not be recorded as "the key this account has seen",
    // or the next real key would look like a substitution.
    publishPeerKey(generateKeypair().publicKey);
    await fetchPeerPublicKeyChecked(ME, PEER); // first-contact, caches it
    firestoreUnreachable = true;
    await fetchPeerPublicKeyChecked(ME, PEER); // unavailable
    firestoreUnreachable = false;
    const {status} = await fetchPeerPublicKeyChecked(ME, PEER);
    expect(status).toBe('unchanged');
  });

  it('reports first-contact the first time this account sees the key, not changed', async () => {
    // Trust-on-first-use: an unseen key is not itself suspicious, or every
    // brand-new conversation would show a "key changed" warning.
    publishPeerKey(generateKeypair().publicKey);
    const {status} = await fetchPeerPublicKeyChecked(ME, PEER);
    expect(status).toBe('first-contact');
  });

  it('reports unchanged on a second fetch of the same key', async () => {
    publishPeerKey(generateKeypair().publicKey);
    await fetchPeerPublicKeyChecked(ME, PEER); // first-contact, caches it
    const {status} = await fetchPeerPublicKeyChecked(ME, PEER);
    expect(status).toBe('unchanged');
  });

  it('reports changed when the key differs from what was cached', async () => {
    publishPeerKey(generateKeypair().publicKey);
    await fetchPeerPublicKeyChecked(ME, PEER); // first-contact

    // The peer's key is substituted — by a device change, or an attacker.
    publishPeerKey(generateKeypair().publicKey);
    const {status} = await fetchPeerPublicKeyChecked(ME, PEER);
    expect(status).toBe('changed');
  });

  it('only reports changed once — the new key becomes the new baseline', async () => {
    publishPeerKey(generateKeypair().publicKey);
    await fetchPeerPublicKeyChecked(ME, PEER);
    publishPeerKey(generateKeypair().publicKey);

    const first = await fetchPeerPublicKeyChecked(ME, PEER);
    const second = await fetchPeerPublicKeyChecked(ME, PEER);
    expect(first.status).toBe('changed');
    expect(second.status).toBe('unchanged');
  });

  it('returns the actual key bytes alongside the status', async () => {
    const {publicKey} = generateKeypair();
    publishPeerKey(publicKey);
    const {key} = await fetchPeerPublicKeyChecked(ME, PEER);
    expect(key).toEqual(publicKey);
  });

  it("does not let one local account's trust history leak into another's", async () => {
    // The exact scenario the module doc warns about: account A trusts peer
    // P's key, then account B signs into the same browser. B must see this
    // as its own first-contact, not silently inherit A's "unchanged" —
    // otherwise a key substituted between A's last visit and B's first would
    // pass with no warning at all.
    publishPeerKey(generateKeypair().publicKey);
    await fetchPeerPublicKeyChecked(ME, PEER); // account A's first-contact

    const {status} = await fetchPeerPublicKeyChecked(OTHER_ME, PEER); // account B
    expect(status).toBe('first-contact');
  });

  it('publishPublicKey writes to the schema mobile also reads (users/{uid}/publicKeys/e2ee)', async () => {
    const {publicKey} = generateKeypair();
    await publishPublicKey(ME, publicKey);
    expect(firestoreDocs.get(`users/${ME}/publicKeys/e2ee`)?.publicKey).toBe(bytesToBase64(publicKey));
  });

  it('clears a capability the account published from another device', async () => {
    // The mobile app advertises `media-v1` to say it can decrypt attachment
    // *bytes*. This client cannot, so leaving that claim standing after it
    // becomes the account's active device would have senders encrypting
    // photos it renders as broken images — silently, on both ends. The write
    // merges, so the field has to be overwritten rather than left out.
    firestoreDocs.set(`users/${ME}/publicKeys/e2ee`, {
      publicKey: 'from-the-phone',
      caps: ['media-v1'],
    });

    const {publicKey} = generateKeypair();
    await publishPublicKey(ME, publicKey);

    expect(firestoreDocs.get(`users/${ME}/publicKeys/e2ee`)?.caps).toEqual([]);
  });
});

describe('getRecoveryPhrase', () => {
  it('encodes this browser\'s actual key, so the phrase can restore it', async () => {
    const {secretKey} = await getOrCreateDeviceKeypair(ME);
    expect(await getRecoveryPhrase(ME)).toBe(secretKeyToMnemonic(secretKey));
  });

  it('enrolls the account if it has no key yet, rather than failing', async () => {
    const phrase = await getRecoveryPhrase(ME);
    expect(phrase.split(' ')).toHaveLength(24);
    expect(firestoreDocs.get(`users/${ME}/publicKeys/e2ee`)).toBeDefined();
  });
});

describe('hasRevealedRecoveryPhrase / markRecoveryPhraseRevealed', () => {
  it('starts false and flips permanently once marked', () => {
    expect(hasRevealedRecoveryPhrase(ME)).toBe(false);
    markRecoveryPhraseRevealed(ME);
    expect(hasRevealedRecoveryPhrase(ME)).toBe(true);
  });

  it('tracks each account separately in a shared browser', () => {
    markRecoveryPhraseRevealed(ME);
    expect(hasRevealedRecoveryPhrase(OTHER_ME)).toBe(false);
  });
});

describe('enrollmentReadiness', () => {
  it('is safe when nothing is published anywhere — nothing to strand', async () => {
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  // The case the whole guard exists for: auto-enrolling here would overwrite
  // the published key and permanently strand history the phrase could restore.
  it('needs restore when a key is published but this browser has no local copy', async () => {
    firestoreDocs.set(`users/${ME}/publicKeys/e2ee`, {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });
    expect(await enrollmentReadiness(ME)).toBe('needs-restore');
  });

  it('is safe once this browser holds the key, even after a reload', async () => {
    await getOrCreateDeviceKeypair(ME);
    expect(await enrollmentReadiness(ME)).toBe('safe');
    _resetKeypairCache();
    expect(await enrollmentReadiness(ME)).toBe('safe');
  });

  it('is read-only — it must not enroll or publish anything itself', async () => {
    await enrollmentReadiness(ME);
    expect(firestoreDocs.get(`users/${ME}/publicKeys/e2ee`)).toBeUndefined();
    expect(localStorage.getItem(`e2ee_secret_key_v1:${ME}`)).toBeNull();
  });
});

describe('restoreDeviceKeypairFromPhrase', () => {
  it('restores the original key in a fresh browser profile', async () => {
    const original = await getOrCreateDeviceKeypair(ME);
    const phrase = secretKeyToMnemonic(original.secretKey);

    // Wipe local state only — the published key stays, as it would in reality.
    memoryStorage.clear();
    _resetKeypairCache();

    expect(await restoreDeviceKeypairFromPhrase(ME, phrase)).toEqual({success: true});
    const restored = await getOrCreateDeviceKeypair(ME);
    expect(bytesToBase64(restored.secretKey)).toBe(bytesToBase64(original.secretKey));
  });

  it('rejects a phrase that is not valid BIP39', async () => {
    expect(await restoreDeviceKeypairFromPhrase(ME, 'not a real phrase')).toEqual({
      success: false,
      reason: 'invalid-phrase',
    });
  });

  // A valid phrase for the wrong account would otherwise install a key that
  // decrypts nothing — stranding the browser exactly as it was trying not to be.
  it('rejects a valid phrase whose key does not match what is published', async () => {
    firestoreDocs.set(`users/${ME}/publicKeys/e2ee`, {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });
    const strangerPhrase = secretKeyToMnemonic(generateKeypair().secretKey);
    expect(await restoreDeviceKeypairFromPhrase(ME, strangerPhrase)).toEqual({
      success: false,
      reason: 'key-mismatch',
    });
  });

  it('accepts a phrase for an account that never finished enrolling', async () => {
    const phrase = secretKeyToMnemonic(generateKeypair().secretKey);
    expect(await restoreDeviceKeypairFromPhrase(ME, phrase)).toEqual({success: true});
  });

  it('leaves local state untouched when the phrase is rejected', async () => {
    const original = await getOrCreateDeviceKeypair(ME);
    await restoreDeviceKeypairFromPhrase(ME, 'garbage phrase');
    const after = await getOrCreateDeviceKeypair(ME);
    expect(bytesToBase64(after.secretKey)).toBe(bytesToBase64(original.secretKey));
  });

  // Views cache decrypt results by message id, not by which key decrypted them,
  // so without a bump a message that failed under the old key stays stuck
  // showing that failure even after the right key is restored.
  it('bumps the key generation on success so cached decrypt failures are retried', async () => {
    // The realistic shape of a restore-over-existing-key: this browser holds a
    // stale key of its own, while the account's real key — the one the phrase
    // encodes — was published from the user's phone. Worth pinning because it
    // is exactly the case markActiveKey does *not* cover: the active account
    // never changes, so only the explicit bump in restore keeps stale decrypt
    // failures from sticking.
    await getOrCreateDeviceKeypair(ME);
    const real = generateKeypair();
    firestoreDocs.set(`users/${ME}/publicKeys/e2ee`, {
      publicKey: bytesToBase64(real.publicKey),
    });

    const before = getKeyGeneration();
    const result = await restoreDeviceKeypairFromPhrase(ME, secretKeyToMnemonic(real.secretKey));
    expect(result).toEqual({success: true});
    expect(getKeyGeneration()).toBeGreaterThan(before);
  });

  // The guard above is only as good as the call sites that respect it, and
  // for a long time none did: nothing in the web app called
  // enrollmentReadiness at all, while five *read* paths — opening a chat,
  // decrypting its messages, the scheduled-message preview, the trash list,
  // the verify dialog — all reached for getOrCreateDeviceKeypair. Reading a
  // conversation was therefore enough to publish a new key over the account's
  // real one. getDeviceKeypairIfEnrolled is what those paths use now.
  it('reading with getDeviceKeypairIfEnrolled leaves the published key alone', async () => {
    const original = await getOrCreateDeviceKeypair(ME);
    const phrase = secretKeyToMnemonic(original.secretKey);
    const publishedBefore = firestoreDocs.get(`users/${ME}/publicKeys/e2ee`)?.publicKey;

    memoryStorage.clear(); // new browser, or cleared site data
    _resetKeypairCache();

    // A reader gets null rather than a freshly minted key...
    expect(await getDeviceKeypairIfEnrolled(ME)).toBeNull();
    // ...the account's published key is untouched...
    expect(firestoreDocs.get(`users/${ME}/publicKeys/e2ee`)?.publicKey).toBe(publishedBefore);
    // ...and the phrase the user wrote down still works.
    expect(await restoreDeviceKeypairFromPhrase(ME, phrase)).toEqual({success: true});
  });

  it('getDeviceKeypairIfEnrolled returns the key this browser already holds', async () => {
    const original = await getOrCreateDeviceKeypair(ME);
    _resetKeypairCache();
    expect((await getDeviceKeypairIfEnrolled(ME))?.secretKey).toEqual(original.secretKey);
  });

  // Found by a test that was wrong in an instructive way: this is the exact
  // disaster enrollmentReadiness exists to prevent. Auto-enrolling a browser
  // that has lost its local key republishes a brand-new key over the account's
  // real one, and the recovery phrase the user carefully wrote down is now
  // permanently useless. The guard must run *before* any getOrCreateDeviceKeypair.
  it('reports superseded when the account has replaced the key this browser holds', async () => {
    await getOrCreateDeviceKeypair(ME);
    expect(await enrollmentReadiness(ME)).toBe('safe');

    // Another device restores a different phrase and republishes.
    firestoreDocs.set(`users/${ME}/publicKeys/e2ee`, {
      publicKey: bytesToBase64(generateKeypair().publicKey),
    });

    // No _resetKeypairCache: the in-memory cache used to answer 'safe' first.
    expect(await enrollmentReadiness(ME)).toBe('superseded');
  });

  it('a phrase stops working if the browser auto-enrolls before restoring', async () => {
    const original = await getOrCreateDeviceKeypair(ME);
    const phrase = secretKeyToMnemonic(original.secretKey);

    memoryStorage.clear(); // user cleared site data; published key still stands
    _resetKeypairCache();

    // enrollmentReadiness would say needs-restore here and stop the app enrolling.
    expect(await enrollmentReadiness(ME)).toBe('needs-restore');

    // Ignoring it and enrolling anyway overwrites the published key...
    await getOrCreateDeviceKeypair(ME);
    // ...and now the real recovery phrase is rejected, forever.
    expect(await restoreDeviceKeypairFromPhrase(ME, phrase)).toEqual({
      success: false,
      reason: 'key-mismatch',
    });
  });

  it('does not bump the key generation when a restore is rejected', async () => {
    await getOrCreateDeviceKeypair(ME);
    const before = getKeyGeneration();
    await restoreDeviceKeypairFromPhrase(ME, 'garbage phrase');
    expect(getKeyGeneration()).toBe(before);
  });
});
