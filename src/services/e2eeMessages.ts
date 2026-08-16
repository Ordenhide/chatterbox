/**
 * E2EE send/receive wrapper — the one message path.
 *
 * Wraps the existing plaintext send path rather than replacing it, so it can
 * fall back safely when a recipient hasn't enrolled a key yet.
 *
 * Sealing is always fan-out (see sealForRecipients in e2ee.ts): a 1:1 chat is
 * simply the one-recipient case, so there is no separate direct-message code
 * path to keep in step with the group one. Messages sealed before group support
 * carry a bare payload instead of an envelope, and resolveMessageText still
 * reads those — there is no migration.
 */
import {Message} from '../types';
import {sendMessage} from './firebaseChat';
import {
  decryptMessage,
  isEncryptedPayload,
  isSealedEnvelope,
  openEnvelope,
  sealForRecipients,
  type EnvelopeRecipient,
} from './e2ee';
import {fetchPeerPublicKeyChecked, getOrCreateDeviceKeypair} from './e2eeKeys';
import {reportError} from './telemetry';

export type SendResult = {encrypted: boolean};

/**
 * Collects the public key of every recipient, or null if any of them has not
 * enrolled.
 *
 * All-or-nothing on purpose: a partially-sealed message would be readable by
 * some members and silently blank for the rest, which is worse than a message
 * everyone can read. Falling back to plaintext for the whole message keeps the
 * conversation consistent, and the caller can surface the distinction.
 *
 * Throws — rather than returning null — when a key simply could not be looked
 * up. Null here means "this peer has no key", which the caller answers with
 * plaintext, and a failed lookup is not that: it is no answer at all. Mapping
 * both onto null is how a network failure turns into an unencrypted message,
 * and a sustained one (captive portal, blocked region) into an unencrypted
 * conversation.
 */
async function collectRecipients(uids: string[]): Promise<EnvelopeRecipient[] | null> {
  const recipients: EnvelopeRecipient[] = [];
  for (const uid of uids) {
    const {key, status} = await fetchPeerPublicKeyChecked(uid);
    if (status === 'unavailable') {
      throw new Error(`e2ee: peer key unavailable for ${uid}`);
    }
    if (!key) return null;
    recipients.push({uid, publicKey: key});
  }
  return recipients;
}

/**
 * Sends `message`, sealing its text when every recipient has published a key.
 *
 * `recipientUids` is everyone in the chat except the sender. The sender is
 * deliberately excluded — X25519's symmetry lets them open any copy, so giving
 * them one of their own would just be a wasted ciphertext.
 */
export async function sendTextMessage(
  chatId: string,
  message: Message,
  myUserId: string,
  recipientUids: string[],
): Promise<SendResult> {
  if (!message.text || recipientUids.length === 0) {
    await sendMessage(chatId, message);
    return {encrypted: false};
  }

  try {
    const recipients = await collectRecipients(recipientUids);
    if (!recipients) {
      await sendMessage(chatId, message);
      return {encrypted: false};
    }

    const {secretKey} = await getOrCreateDeviceKeypair(myUserId);
    const envelope = sealForRecipients(message.text, secretKey, recipients, chatId);

    // `text` is blanked so no plaintext copy reaches Firestore. sendMessage
    // derives lastMessage.text from it, so the chat-list preview becomes empty
    // rather than leaking the body — a placeholder belongs in the UI layer.
    await sendMessage(chatId, {...message, text: '', encrypted: envelope});
    return {encrypted: true};
  } catch (error) {
    // Never silently downgrade to plaintext on a crypto failure: the caller
    // asked for encryption, so surface it instead of quietly sending in clear.
    reportError(error, 'e2ee_send_failed');
    throw error;
  }
}

/**
 * Returns the readable text for a message, decrypting whichever sealed shape it
 * carries. Returns null if it is sealed but this device cannot read it (wrong
 * or rotated key, or the reader was not a member when it was sent) so the UI can
 * show a distinct "can't decrypt" state rather than a blank bubble.
 */
export async function resolveMessageText(
  message: Message,
  myUserId: string,
  chatId: string,
): Promise<string | null> {
  const sealed = message.encrypted;
  if (!sealed) return message.text ?? '';

  try {
    const {secretKey} = await getOrCreateDeviceKeypair(myUserId);
    if (isSealedEnvelope(sealed)) {
      return openEnvelope(sealed, secretKey, myUserId, chatId);
    }
    if (isEncryptedPayload(sealed)) {
      // Pre-group message: a single payload rather than an envelope.
      return decryptMessage(sealed, secretKey, chatId);
    }
    return message.text ?? '';
  } catch (error) {
    reportError(error, 'e2ee_decrypt_failed');
    return null;
  }
}

/** True if this message was delivered under E2EE (for a lock badge in the UI). */
export function isMessageEncrypted(message: Message): boolean {
  return isSealedEnvelope(message.encrypted) || isEncryptedPayload(message.encrypted);
}
