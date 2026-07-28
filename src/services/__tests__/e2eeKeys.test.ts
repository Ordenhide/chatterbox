// e2eeKeys.ts touches the Firestore SDK and native MMKV storage at import
// time; stub both so these tests exercise the key-change decision logic
// (fetchPeerPublicKeyChecked) rather than any native bridge.
//
// Jest hoists jest.mock() factories above imports and only allows them to
// close over variables prefixed with `mock` (case-insensitive) — anything
// else throws "not allowed to reference any out-of-scope variables".
const mockFirestoreDocs = new Map<string, {publicKey?: string}>();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  getDoc: async (ref: {path: string}) => {
    const data = mockFirestoreDocs.get(ref.path);
    return {exists: !!data, data: () => data};
  },
  setDoc: async () => undefined,
  serverTimestamp: () => 'TS',
}));

const mockMmkvStore = new Map<string, string>();
jest.mock('../storageMMKV', () => ({
  mmkvStorage: {
    getItem: async (key: string) => mockMmkvStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockMmkvStore.set(key, value);
    },
  },
}));

// telemetry.ts pulls in @react-native-firebase/analytics, an ESM-only package
// outside this project's transformIgnorePatterns; e2eeKeys.ts only needs
// reportError() as a no-op here.
jest.mock('../telemetry', () => ({reportError: () => undefined}));

import {bytesToBase64} from '../crypto';
import {generateKeypair} from '../e2ee';
import {fetchPeerPublicKeyChecked} from '../e2eeKeys';

const PEER = 'peer-uid';
const publicKeyPath = `users/${PEER}/publicKeys/e2ee`;

function publishPeerKey(publicKey: Uint8Array) {
  mockFirestoreDocs.set(publicKeyPath, {publicKey: bytesToBase64(publicKey)});
}

beforeEach(() => {
  mockFirestoreDocs.clear();
  mockMmkvStore.clear();
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
