/**
 * E2EE send/receive wrapper — the "one message path" prototype.
 *
 * Wraps the existing plaintext send path rather than replacing it, so the
 * feature can be switched on per-chat and falls back safely when the peer
 * hasn't enrolled a key yet. Nothing here is wired into the UI: enabling it
 * means calling `sendTextMessage` instead of `sendMessage` from ChatScreen,
 * and running incoming messages through `resolveMessageText` on render.
 *
 * Only 1:1 text is covered. Images, audio, files, link previews, transcriptions
 * and the `lastMessage` chat-list preview all remain plaintext — see the
 * caveats block in e2ee.ts before treating any of this as shipped security.
 */
import {Message} from '../types';
import {sendMessage} from './firebaseChat';
import {decryptMessage, encryptMessage, isEncryptedPayload} from './e2ee';
import {fetchPeerPublicKey, getOrCreateDeviceKeypair} from './e2eeKeys';
import {reportError} from './telemetry';

export type SendResult = {encrypted: boolean};

/**
 * Sends `message`, encrypting its text when both sides have published a key.
 *
 * Falls back to plaintext (returning `{encrypted: false}`) when the peer has
 * not enrolled — an unreadable message would be worse than a plaintext one,
 * and the caller can surface the distinction in the UI.
 */
export async function sendTextMessage(
  chatId: string,
  message: Message,
  myUserId: string,
  peerUserId: string,
): Promise<SendResult> {
  if (!message.text) {
    await sendMessage(chatId, message);
    return {encrypted: false};
  }

  try {
    const peerPublicKey = await fetchPeerPublicKey(peerUserId);
    if (!peerPublicKey) {
      await sendMessage(chatId, message);
      return {encrypted: false};
    }

    const {secretKey} = await getOrCreateDeviceKeypair(myUserId);
    const payload = encryptMessage(message.text, secretKey, peerPublicKey, chatId);

    // `text` is blanked so no plaintext copy reaches Firestore. sendMessage
    // derives lastMessage.text from it, so the chat-list preview becomes empty
    // rather than leaking the body — a placeholder belongs in the UI layer.
    await sendMessage(chatId, {...message, text: '', encrypted: payload});
    return {encrypted: true};
  } catch (error) {
    // Never silently downgrade to plaintext on a crypto failure: the caller
    // asked for encryption, so surface it instead of quietly sending in clear.
    reportError(error, 'e2ee_send_failed');
    throw error;
  }
}

/**
 * Returns the readable text for a message, decrypting when it carries an
 * envelope. Returns null if it is encrypted but this device cannot read it
 * (wrong/rotated key, or a message predating enrolment) so the UI can show a
 * distinct "can't decrypt" state rather than a blank bubble.
 */
export async function resolveMessageText(
  message: Message,
  myUserId: string,
  chatId: string,
): Promise<string | null> {
  if (!isEncryptedPayload(message.encrypted)) {
    return message.text ?? '';
  }
  try {
    const {secretKey} = await getOrCreateDeviceKeypair(myUserId);
    return decryptMessage(message.encrypted, secretKey, chatId);
  } catch (error) {
    reportError(error, 'e2ee_decrypt_failed');
    return null;
  }
}

/** True if this message was delivered under E2EE (for a lock badge in the UI). */
export function isMessageEncrypted(message: Message): boolean {
  return isEncryptedPayload(message.encrypted);
}
