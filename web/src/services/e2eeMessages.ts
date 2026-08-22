/**
 * Sending a text message to an arbitrary chat, sealed for *that* chat's
 * current members — not the one the caller happens to be looking at.
 *
 * ChatPane's own encryptOutgoingMessage does the same seal-and-send, but it's
 * closed over the open chat's `chatId`/`participants`, so it can only ever
 * target that one conversation. Forwarding needs the general case: given some
 * other chatId, look up *its* recipients and seal for them instead. Same
 * fail-open behavior as ChatPane's version (falls back to a plaintext send
 * rather than losing the message) for the same reason — consistency with how
 * every other send on this client already handles an unreachable/unenrolled
 * peer.
 */
import {sendMessage} from './chat';
import {
  EncryptionUnavailableError,
  fetchPeerPublicKeyChecked,
  getOrCreateDeviceKeypair,
  isEncryptionUnavailable,
} from './e2eeKeys';
import {sealForRecipients, type EnvelopeRecipient} from './e2ee';

export async function sealAndSendText(
  chatId: string,
  text: string,
  me: {uid: string; name: string},
  recipientUids: string[],
): Promise<void> {
  if (recipientUids.length === 0) {
    await sendMessage(chatId, {text}, me);
    return;
  }

  try {
    const recipients: EnvelopeRecipient[] = [];
    for (const uid of recipientUids) {
      const {key, status} = await fetchPeerPublicKeyChecked(me.uid, uid);
      // Not knowing whether a peer has a key is not the same as knowing they
      // have none, and only the second may be answered with plaintext.
      if (status === 'unavailable') {
        throw new EncryptionUnavailableError(`peer key unavailable for ${uid}`);
      }
      // All-or-nothing, same reasoning as ChatPane's encryptOutgoingMessage:
      // a message sealed for only some members would be blank for the rest.
      // Reached only on a definite 'unenrolled'.
      if (!key) {
        await sendMessage(chatId, {text}, me);
        return;
      }
      recipients.push({uid, publicKey: key});
    }
    const {secretKey} = await getOrCreateDeviceKeypair(me.uid);
    const envelope = sealForRecipients(text, secretKey, recipients, chatId);
    await sendMessage(chatId, {text: '', encrypted: envelope}, me);
  } catch (err) {
    // Fails closed rather than forwarding in clear. A forward is a *copy* of
    // something the sender chose to send encrypted, so silently relaying it
    // unsealed into a different conversation is the worst version of this bug.
    // The caller (ChatPane's handleForwardPick) already catches and toasts.
    console.warn('e2ee forward failed:', err);
    throw isEncryptionUnavailable(err) ? err : new EncryptionUnavailableError();
  }
}
