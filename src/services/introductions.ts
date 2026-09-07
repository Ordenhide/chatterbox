/**
 * Telling the other side who you are, without telling the server.
 *
 * `users/{uid}` used to carry a display name that anyone knowing the uid could
 * read. The email and the photo went first (see upsertUserProfile); the name
 * is the last of the three, and it is the one that cannot simply be deleted —
 * a chat list of eight-character uids is not usable.
 *
 * So it moves. When you accept someone's invite you already hold their public
 * key — the invite carried it — so your name is sealed to that key and written
 * onto the chat as `introBy: {<your uid>: <ciphertext>}`. The inviter's client
 * opens it; the server stores a blob it cannot read, and there is no longer a
 * document anywhere mapping a uid to a person's name.
 *
 * ## One direction, on purpose
 *
 * Only the accepter introduces themselves. That is the asymmetry of an invite:
 * the inviter does not know who will open the link, so being told is useful,
 * while the accepter already knows who they are contacting and names them
 * themselves (the "what to call them" field on the invite screen). A second
 * ciphertext going the other way would be a name the recipient did not ask
 * for.
 *
 * ## What is checked before it is shown
 *
 * Chat documents are writable by every participant, so an introduction is
 * attacker-supplied text until proved otherwise. Two things are required
 * before it is rendered: the envelope's `senderKey` must be the peer's
 * *published* key, which is what stops a third party in a group from writing
 * a name in someone else's slot; and the text is trimmed to one line and a
 * bounded length, because it lands in a title, not in a message body.
 *
 * The name is never written back to the server — not into `nameBy`, which is
 * for labels the user chose. It is decrypted on each pass, which costs one
 * X25519 per conversation and is cached inside e2ee.ts anyway.
 */
import {base64ToBytes, bytesToBase64} from './crypto';
import {
  decryptMessage,
  encryptMessage,
  isEncryptedPayload,
  type EncryptedPayload,
} from './e2ee';
import {fetchPeerPublicKeyChecked, getDeviceKeypairIfEnrolled} from './e2eeKeys';
import {reportError} from './errorLog';
import type {ChatRoom} from '../types';

/** The field on the chat document. */
export const INTRO_FIELD = 'introBy';

/**
 * A name is one line, and short. The cap is not about storage — it is that
 * this string is chosen by the other party and rendered as a chat title, so a
 * thousand characters or an embedded newline would be a layout attack rather
 * than a name.
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
    const peerKey = base64ToBytes(peerKeyBase64);
    return encryptMessage(tidy, mySecretKey, peerKey, chatId);
  } catch (error) {
    reportError(error, 'introduction_seal_failed');
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
    const opened = tidyIntroduction(decryptMessage(intro, mySecretKey, chatId));
    return opened || null;
  } catch {
    // A key rotation leaves older introductions unreadable. Showing the uid
    // beats showing a decryption error where a name goes.
    return null;
  }
}

/**
 * Every readable introduction across a set of chats, keyed by chat id.
 *
 * Returns an empty map rather than throwing when this device has no key: an
 * unenrolled device has no way to read any of them, and a chat list is not the
 * place to discover that.
 */
export async function openIntroductions(
  chats: ChatRoom[],
  myUid: string,
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  if (!myUid || chats.length === 0) return names;

  try {
    // Non-enrolling: opening a chat list must never be the thing that
    // publishes a fresh key over the one this account already has.
    const keypair = await getDeviceKeypairIfEnrolled(myUid);
    if (!keypair) return names;

    await Promise.all(
      chats.map(async chat => {
        const participants = chat.participants || [];
        if (participants.length !== 2) return;
        const peer = participants.find(uid => uid !== myUid);
        if (!peer) return;
        const intro = (chat as {introBy?: Record<string, unknown>}).introBy?.[peer];
        if (!intro) return;

        const {key} = await fetchPeerPublicKeyChecked(peer);
        const opened = openIntroduction(intro, keypair.secretKey, key, chat.id);
        if (opened) names[chat.id] = opened;
      }),
    );
  } catch (error) {
    reportError(error, 'introductions_open_failed');
  }
  return names;
}
