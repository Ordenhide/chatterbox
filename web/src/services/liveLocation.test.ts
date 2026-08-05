import {beforeEach, describe, expect, it, vi} from 'vitest';

const mockSetDoc = vi.fn(async (..._args: unknown[]) => undefined);
const mockDeleteDoc = vi.fn(async (..._args: unknown[]) => undefined);
const mockFetchPeerPublicKeyChecked = vi.fn();
const mockGetOrCreateDeviceKeypair = vi.fn();

type MockSnapshotHandler = (snapshot: {exists: () => boolean; data: () => Record<string, unknown>}) => void;
const mockOnSnapshotHandlers: MockSnapshotHandler[] = [];

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  serverTimestamp: () => ({__isServerTimestamp: true}),
  onSnapshot: (_ref: unknown, onNext: MockSnapshotHandler) => {
    mockOnSnapshotHandlers.push(onNext);
    return () => {
      const i = mockOnSnapshotHandlers.indexOf(onNext);
      if (i >= 0) mockOnSnapshotHandlers.splice(i, 1);
    };
  },
}));
vi.mock('../firebase', () => ({db: {}}));
vi.mock('./e2eeKeys', () => ({
  fetchPeerPublicKeyChecked: (...args: unknown[]) => mockFetchPeerPublicKeyChecked(...args),
  getOrCreateDeviceKeypair: (...args: unknown[]) => mockGetOrCreateDeviceKeypair(...args),
}));

import {
  listenLiveLocation,
  MIN_LOCATION_UPDATE_INTERVAL_MS,
  shouldSendLocationUpdate,
  startSharingLocation,
  stopSharingLocation,
  updateSharedLocation,
} from './liveLocation';
import {decryptMessage, encryptMessage, generateKeypair, type EncryptedPayload} from './e2ee';

interface WritePayload {
  encryptedPosition: EncryptedPayload;
  expiresAt?: number;
  updatedAt?: unknown;
}

const CHAT_ID = 'chat1';
const ME = 'uid1';
const PEER = 'uid2';

beforeEach(() => {
  mockSetDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockFetchPeerPublicKeyChecked.mockReset();
  mockGetOrCreateDeviceKeypair.mockReset();
  mockOnSnapshotHandlers.length = 0;
});

describe('shouldSendLocationUpdate', () => {
  it('sends immediately when nothing has been sent yet', () => {
    expect(shouldSendLocationUpdate(null, Date.now())).toBe(true);
  });

  it('withholds an update within the minimum interval', () => {
    const now = 100_000;
    expect(shouldSendLocationUpdate(now, now + MIN_LOCATION_UPDATE_INTERVAL_MS - 1)).toBe(false);
  });

  it('allows an update once the minimum interval has passed', () => {
    const now = 100_000;
    expect(shouldSendLocationUpdate(now, now + MIN_LOCATION_UPDATE_INTERVAL_MS)).toBe(true);
  });
});

describe('startSharingLocation', () => {
  it('encrypts the position for the peer and writes expiresAt/updatedAt', async () => {
    const me = generateKeypair();
    const peer = generateKeypair();
    mockFetchPeerPublicKeyChecked.mockResolvedValue({key: peer.publicKey, status: 'unchanged'});
    mockGetOrCreateDeviceKeypair.mockResolvedValue(me);

    const before = Date.now();
    await startSharingLocation(CHAT_ID, ME, PEER, 900_000, {latitude: 1, longitude: 2});

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = mockSetDoc.mock.calls[0] as [unknown, WritePayload];
    expect(ref).toEqual({path: `chats/${CHAT_ID}/liveLocations/${ME}`});
    expect(payload.expiresAt).toBeGreaterThanOrEqual(before + 900_000);
    expect(payload.updatedAt).toEqual({__isServerTimestamp: true});

    const decrypted = JSON.parse(decryptMessage(payload.encryptedPosition, peer.secretKey, CHAT_ID));
    expect(decrypted).toEqual({latitude: 1, longitude: 2});
  });

  it('refuses to start when the peer has not published an encryption key', async () => {
    mockFetchPeerPublicKeyChecked.mockResolvedValue({key: null, status: 'unenrolled'});
    await expect(
      startSharingLocation(CHAT_ID, ME, PEER, 900_000, {latitude: 1, longitude: 2}),
    ).rejects.toThrow(/encryption key/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe('updateSharedLocation', () => {
  it('merge-writes a fresh encrypted position without touching expiresAt', async () => {
    const me = generateKeypair();
    const peer = generateKeypair();
    mockFetchPeerPublicKeyChecked.mockResolvedValue({key: peer.publicKey, status: 'unchanged'});
    mockGetOrCreateDeviceKeypair.mockResolvedValue(me);

    await updateSharedLocation(CHAT_ID, ME, PEER, {latitude: 3, longitude: 4});

    const [, payload, options] = mockSetDoc.mock.calls[0] as [unknown, WritePayload, {merge: boolean}];
    expect(payload.expiresAt).toBeUndefined();
    expect(options).toEqual({merge: true});
    const decrypted = JSON.parse(decryptMessage(payload.encryptedPosition, peer.secretKey, CHAT_ID));
    expect(decrypted).toEqual({latitude: 3, longitude: 4});
  });

  it('silently drops the update (keeps the share alive) if the peer key vanished mid-share', async () => {
    mockFetchPeerPublicKeyChecked.mockResolvedValue({key: null, status: 'unenrolled'});
    await expect(updateSharedLocation(CHAT_ID, ME, PEER, {latitude: 3, longitude: 4})).resolves.toBeUndefined();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe('stopSharingLocation', () => {
  it('deletes the share document', async () => {
    await stopSharingLocation(CHAT_ID, ME);
    expect(mockDeleteDoc).toHaveBeenCalledWith({path: `chats/${CHAT_ID}/liveLocations/${ME}`});
  });
});

describe('listenLiveLocation', () => {
  function emit(snapshot: {exists: () => boolean; data: () => Record<string, unknown>}) {
    mockOnSnapshotHandlers[0](snapshot);
  }

  it('decrypts a live share and reports it', () => {
    const me = generateKeypair();
    const peer = generateKeypair();
    const payload = encryptMessage(JSON.stringify({latitude: 5, longitude: 6}), peer.secretKey, me.publicKey, CHAT_ID);
    const callback = vi.fn();

    listenLiveLocation(CHAT_ID, PEER, me.secretKey, callback);
    emit({
      exists: () => true,
      data: () => ({encryptedPosition: payload, expiresAt: Date.now() + 60_000, updatedAt: {toMillis: () => 12345}}),
    });

    expect(callback).toHaveBeenCalledWith({
      uid: PEER,
      position: {latitude: 5, longitude: 6},
      expiresAt: expect.any(Number),
      updatedAt: 12345,
    });
  });

  it('reports null when there is no doc', () => {
    const callback = vi.fn();
    listenLiveLocation(CHAT_ID, PEER, generateKeypair().secretKey, callback);
    emit({exists: () => false, data: () => ({})});
    expect(callback).toHaveBeenCalledWith(null);
  });

  it('treats a past expiresAt as null even though the doc still exists (pre-sweep)', () => {
    const me = generateKeypair();
    const peer = generateKeypair();
    const payload = encryptMessage(JSON.stringify({latitude: 5, longitude: 6}), peer.secretKey, me.publicKey, CHAT_ID);
    const callback = vi.fn();

    listenLiveLocation(CHAT_ID, PEER, me.secretKey, callback);
    emit({exists: () => true, data: () => ({encryptedPosition: payload, expiresAt: Date.now() - 1000, updatedAt: {}})});

    expect(callback).toHaveBeenCalledWith(null);
  });

  it('reports a null position (not a thrown error) when decryption fails', () => {
    const me = generateKeypair();
    const mallory = generateKeypair();
    const peer = generateKeypair();
    const payload = encryptMessage(JSON.stringify({latitude: 5, longitude: 6}), mallory.secretKey, peer.publicKey, CHAT_ID);
    const callback = vi.fn();

    listenLiveLocation(CHAT_ID, PEER, me.secretKey, callback);
    expect(() =>
      emit({exists: () => true, data: () => ({encryptedPosition: payload, expiresAt: Date.now() + 60_000, updatedAt: {}})}),
    ).not.toThrow();

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({uid: PEER, position: null}));
  });
});
