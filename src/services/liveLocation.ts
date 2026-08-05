/**
 * Live location sharing within a 1:1 chat.
 *
 * Modeled as one doc per active sharer under the chat, not as a chat message
 * — closer to presence/typing than to a message, so a position update never
 * spams the conversation with a new bubble. The position itself is sealed
 * with the same E2EE primitives already used for message text and media
 * URLs (`encryptMessage`/`decryptMessage` operate on arbitrary strings);
 * `expiresAt`/`updatedAt` stay plaintext since the expiry sweep
 * (functions/index.js's `sweepExpiredLiveLocations`) and read-side staleness
 * checks need them without decrypting.
 *
 * Foreground-only by design: nothing here keeps running once the screen
 * that started the watch unmounts — see the mobile UI's use of
 * `watchMyPosition` (src/utils/geolocation.ts), which the chat screen tears
 * down on blur/unmount.
 */
import {deleteDoc, doc, getFirestore, onSnapshot, serverTimestamp, setDoc} from '@react-native-firebase/firestore';
import {decryptMessage, encryptMessage, isEncryptedPayload, type EncryptedPayload} from './e2ee';
import {fetchPeerPublicKeyChecked, getOrCreateDeviceKeypair} from './e2eeKeys';

const db = getFirestore();

export interface LiveLocationPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LiveLocationShare {
  uid: string;
  position: LiveLocationPosition | null;
  expiresAt: number;
  updatedAt: number;
}

/** Firestore write ceiling regardless of how often the GPS callback fires. */
export const MIN_LOCATION_UPDATE_INTERVAL_MS = 10_000;

export function shouldSendLocationUpdate(lastSentAt: number | null, now: number): boolean {
  return lastSentAt === null || now - lastSentAt >= MIN_LOCATION_UPDATE_INTERVAL_MS;
}

const liveLocationDoc = (chatId: string, uid: string) => doc(db, 'chats', chatId, 'liveLocations', uid);

/**
 * Starts sharing this device's location with `peerUid` in `chatId` for
 * `durationMs`. Requires the peer to have already published an E2EE key —
 * unlike message text (which has to tolerate a pre-E2EE plaintext history),
 * this is new surface designed to be encrypted from the start, so it
 * refuses to fall back to plaintext the way message sending still does.
 */
export async function startSharingLocation(
  chatId: string,
  myUid: string,
  peerUid: string,
  durationMs: number,
  initialPosition: LiveLocationPosition,
): Promise<void> {
  const {key: peerPublicKey} = await fetchPeerPublicKeyChecked(peerUid);
  if (!peerPublicKey) {
    throw new Error('peer has not published an encryption key yet');
  }
  const {secretKey} = await getOrCreateDeviceKeypair(myUid);
  const encryptedPosition = encryptMessage(JSON.stringify(initialPosition), secretKey, peerPublicKey, chatId);
  await setDoc(liveLocationDoc(chatId, myUid), {
    encryptedPosition,
    expiresAt: Date.now() + durationMs,
    updatedAt: serverTimestamp(),
  });
}

/** Refreshes an already-active share with a new position. Leaves expiresAt untouched. */
export async function updateSharedLocation(
  chatId: string,
  myUid: string,
  peerUid: string,
  position: LiveLocationPosition,
): Promise<void> {
  const {key: peerPublicKey} = await fetchPeerPublicKeyChecked(peerUid);
  if (!peerPublicKey) return; // peer's key vanished mid-share — drop this tick, keep the share alive
  const {secretKey} = await getOrCreateDeviceKeypair(myUid);
  const encryptedPosition = encryptMessage(JSON.stringify(position), secretKey, peerPublicKey, chatId);
  await setDoc(liveLocationDoc(chatId, myUid), {encryptedPosition, updatedAt: serverTimestamp()}, {merge: true});
}

export async function stopSharingLocation(chatId: string, myUid: string): Promise<void> {
  await deleteDoc(liveLocationDoc(chatId, myUid));
}

/**
 * Subscribes to peerUid's live location share in this chat. Reports null
 * when there's no active share, the share has expired (even if the sweep
 * Cloud Function hasn't deleted it yet), or the position can't be decrypted
 * (wrong/rotated key) — the caller shouldn't need to distinguish those,
 * they all mean "nothing to show right now."
 */
export function listenLiveLocation(
  chatId: string,
  peerUid: string,
  mySecretKey: Uint8Array,
  callback: (share: LiveLocationShare | null) => void,
): () => void {
  return onSnapshot(
    liveLocationDoc(chatId, peerUid),
    snapshot => {
      if (!snapshot.exists) {
        callback(null);
        return;
      }
      const data = snapshot.data() as {
        encryptedPosition?: unknown;
        expiresAt?: number;
        updatedAt?: {toMillis?: () => number};
      };
      const expiresAt = data.expiresAt ?? 0;
      if (expiresAt < Date.now()) {
        callback(null);
        return;
      }

      let position: LiveLocationPosition | null = null;
      if (isEncryptedPayload(data.encryptedPosition)) {
        try {
          position = JSON.parse(decryptMessage(data.encryptedPosition as EncryptedPayload, mySecretKey, chatId));
        } catch {
          position = null;
        }
      }
      callback({uid: peerUid, position, expiresAt, updatedAt: data.updatedAt?.toMillis?.() ?? Date.now()});
    },
    () => callback(null),
  );
}
