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
const firestoreDocs = new Map<string, {publicKey?: string}>();

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDoc: async (ref: {path: string}) => {
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
  fetchPeerPublicKeyChecked,
  getOrCreateDeviceKeypair,
  publishPublicKey,
} from './e2eeKeys';

const ME = 'me-uid';
const OTHER_ME = 'someone-else-uid'; // a second account signed into this same browser
const PEER = 'peer-uid';

function publishPeerKey(publicKey: Uint8Array) {
  firestoreDocs.set(`users/${PEER}/publicKeys/e2ee`, {publicKey: bytesToBase64(publicKey)});
}

beforeEach(() => {
  firestoreDocs.clear();
  memoryStorage.clear();
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
});
