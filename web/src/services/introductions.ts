/**
 * Telling the other side who you are, without telling the server. Mirrors
 * src/services/introductions.ts on mobile — see that file for the reasoning;
 * this one is a reimplementation, not shared code, and the two must agree on
 * the field, the scope and the checks or a name sealed on a phone will not
 * open in a browser.
 */
import {bytesToBase64, base64ToBytes} from './crypto';
import {
  decryptMessage,
  encryptMessage,
  isEncryptedPayload,
  type EncryptedPayload,
} from './e2ee';
import {fetchPeerPublicKeyChecked, getDeviceKeypairIfEnrolled} from './e2eeKeys';
import type {ChatRoom} from '../types';

/** The field on the chat document. */
export const INTRO_FIELD = 'introBy';

/**
 * A name is one line, and short. Not about storage: this string is chosen by
 * the other party and rendered as a chat title, so an unbounded one or an
 * embedded newline is a layout attack rather than a name.
 */
export const MAX_INTRO_LENGTH = 48;

export function tidyIntroduction(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_INTRO_LENGTH);
}

/** Seals your own name for the holder of `peerKeyBase64`. */
export function sealIntroduction(
  name: string,
  mySecretKey: Uint8Array,
  peerKeyBase64: string,
  chatId: string,
): EncryptedPayload | null {
  const tidy = tidyIntroduction(name || '');
  if (!tidy || !peerKeyBase64 || !chatId) return null;
  try {
    return encryptMessage(tidy, mySecretKey, base64ToBytes(peerKeyBase64), chatId);
  } catch (error) {
    console.warn('sealIntroduction failed:', error);
    return null;
  }
}

/**
 * Opens an introduction, or returns null.
 *
 * `peerPublicKey` is the key this peer has published. An envelope whose
 * `senderKey` is anything else is discarded without being decrypted: every
 * participant can write the chat document, so the slot alone proves nothing
 * about who filled it.
 */
export function openIntroduction(
  intro: unknown,
  mySecretKey: Uint8Array,
  peerPublicKey: Uint8Array | null,
  chatId: string,
): string | null {
  if (!isEncryptedPayload(intro) || !peerPublicKey) return null;
  if (intro.senderKey !== bytesToBase64(peerPublicKey)) return null;
  try {
    return tidyIntroduction(decryptMessage(intro, mySecretKey, chatId)) || null;
  } catch {
    // A key rotation leaves older introductions unreadable. Showing the uid
    // beats showing a decryption error where a name goes.
    return null;
  }
}

/** Every readable introduction across a set of chats, keyed by chat id. */
export async function openIntroductions(
  chats: ChatRoom[],
  myUid: string,
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  if (!myUid || chats.length === 0) return names;

  try {
    // Non-enrolling: opening a chat list must never publish a fresh key over
    // the one this account already has.
    const keypair = await getDeviceKeypairIfEnrolled(myUid);
    if (!keypair) return names;

    await Promise.all(
      chats.map(async chat => {
        const participants = chat?.participants || [];
        if (participants.length !== 2) return;
        const peer = participants.find(uid => uid !== myUid);
        if (!peer) return;
        const intro = (chat as {introBy?: Record<string, unknown>}).introBy?.[peer];
        if (!intro) return;

        const {key} = await fetchPeerPublicKeyChecked(myUid, peer);
        const opened = openIntroduction(intro, keypair.secretKey, key, chat.id);
        if (opened) names[chat.id] = opened;
      }),
    );
  } catch (error) {
    console.warn('openIntroductions failed:', error);
  }
  return names;
}
