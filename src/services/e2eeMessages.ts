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
  diagnoseSealed,
  isEncryptedPayload,
  isGroupSealed,
  isSealedEnvelope,
  openEnvelope,
  sealForRecipients,
  type EnvelopeRecipient,
} from './e2ee';
import {
  fetchPeerPublicKeyChecked,
  getDeviceKeypairIfEnrolled,
  getOrCreateDeviceKeypair,
} from './e2eeKeys';
import {
  isRatchetEnvelope,
  openEnvelope as openRatchetEnvelope,
  sealText,
} from './ratchetMessages';
import {reportError, reportSealedFailure} from './errorLog';
import {decodeBody} from './messageBody';
import {saveBodies} from './messageBodyStore';

/**
 * `protection` is reported so a downgrade is never silent.
 *
 *   'ratchet' — forward-secret (services/ratchetMessages.ts)
 *   'static'  — sealed, but under the long-lived static-DH key: readable
 *               retroactively if that key is ever compromised
 *   'none'    — not sealed at all
 *
 * The caller surfaces the distinction. A conversation quietly losing forward
 * secrecy is the same class of failure as quietly losing encryption, and the
 * only difference is how hard it is to notice.
 */
export type MessageProtection = 'ratchet' | 'sender-key' | 'static' | 'none';

export type SendResult = {encrypted: boolean; protection: MessageProtection};

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
    return {encrypted: false, protection: 'none'};
  }

  try {
    // 1:1 only for now. Groups keep the fan-out path until sender keys are
    // wired up; the ratchet is a two-party protocol and has no meaning across
    // 32 members.
    if (recipientUids.length === 1) {
      const outcome = await sealText(myUserId, chatId, recipientUids[0], message.text);
      if (outcome.protection === 'ratchet') {
        await sendMessage(chatId, {...message, text: '', encrypted: outcome.envelope});
        return {encrypted: true, protection: 'ratchet'};
      }
      // Peer has published no bundle — an older client. Fall through to the
      // static path, and say so in the result.
    }

    const recipients = await collectRecipients(recipientUids);
    if (!recipients) {
      await sendMessage(chatId, message);
      return {encrypted: false, protection: 'none'};
    }

    const {secretKey} = await getOrCreateDeviceKeypair(myUserId);
    const envelope = sealForRecipients(message.text, secretKey, recipients, chatId);

    // `text` is blanked so no plaintext copy reaches Firestore. sendMessage
    // derives lastMessage.text from it, so the chat-list preview becomes empty
    // rather than leaking the body — a placeholder belongs in the UI layer.
    await sendMessage(chatId, {...message, text: '', encrypted: envelope});
    return {encrypted: true, protection: 'static'};
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

  /**
   * Records the body and hands back its text.
   *
   * Both halves are load-bearing, and both were missing.
   *
   * Recording, because this function's only caller is the background push
   * handler and a ratchet envelope opens exactly once. Opening one to build a
   * notification and then dropping the plaintext destroyed the message: the
   * key was gone by the time the chat screen tried, nothing had written the
   * body to the one store that outlives the envelope, and the message was
   * unreadable for good. That happened to every message that arrived while the
   * app was in the background, which is most of them. Awaited rather than
   * fired off, because the process this runs in can be killed the moment the
   * handler resolves. saveBodies merges and never overwrites, so a body the
   * chat screen already stored wins, and it reports its own failures.
   *
   * Decoding, because what the openers return is the *encoded* body, not the
   * text — the chat screen calls decodeBody on it and this did not. A message
   * carrying an attachment therefore produced a notification whose body was
   * the structured form: a NUL marker, then JSON, then the attachment's
   * content key in base64. Redacted on the lock screen, and still sitting in
   * the OS notification history.
   */
  const remember = async (raw: string): Promise<string> => {
    const id = String(message._id ?? '');
    if (id) await saveBodies(myUserId, chatId, new Map([[id, raw]]));
    return decodeBody(raw).text;
  };

  // Checked before the static shapes: a ratchet envelope carries its own
  // session state and must never be handed to the static-DH opener, which
  // would fail and report the message as undecryptable.
  if (isRatchetEnvelope(sealed)) {
    const outcome = await openRatchetEnvelope(sealed, myUserId, chatId);
    return outcome.status === 'ok' ? await remember(outcome.text) : null;
  }

  // The non-enrolling read. getOrCreateDeviceKeypair publishes on first
  // call, and this function's hottest caller is the *background* push
  // handler (services/firebase/push.ts): a notification arriving on a
  // reinstalled device would have minted a key and overwritten the
  // account's published one to render a preview, before the app had been
  // opened once and long before the user could reach the restore screen.
  // That is the damage enrollmentReadiness holds sign-in back to prevent,
  // done in the background by the code trying to read the messages it was
  // orphaning. A reader with no key returns null, which is the same
  // "can't decrypt" state the caller already handles.
  const keypair = await getDeviceKeypairIfEnrolled(myUserId).catch(error => {
    reportError(error, 'e2ee_decrypt_key_unavailable');
    return null;
  });
  if (!keypair) return null;

  try {
    if (isSealedEnvelope(sealed)) {
      return await remember(openEnvelope(sealed, keypair.secretKey, myUserId, chatId));
    }
    if (isEncryptedPayload(sealed)) {
      // Pre-group message: a single payload rather than an envelope.
      return await remember(decryptMessage(sealed, keypair.secretKey, chatId));
    }
    return message.text ?? '';
  } catch (error) {
    reportSealedFailure(error, diagnoseSealed(sealed, keypair.publicKey, myUserId));
    return null;
  }
}

/** True if this message was delivered under E2EE (for a lock badge in the UI). */
export function isMessageEncrypted(message: Message): boolean {
  return (
    isRatchetEnvelope(message.encrypted) ||
    isSealedEnvelope(message.encrypted) ||
    isEncryptedPayload(message.encrypted)
  );
}

/**
 * Which protection a *received* message was actually delivered under.
 *
 * Read from the envelope shape rather than a flag the sender wrote, so it
 * cannot be overstated: a message claiming forward secrecy it does not have
 * would be worse than no indicator at all.
 */
export function messageProtection(message: Message): MessageProtection {
  if (isRatchetEnvelope(message.encrypted)) return 'ratchet';
  // Group messages sealed with sender keys. Omitting this reported them as
  // 'none' — an unqualified claim that a forward-secret message had no
  // protection at all, from the one function that exists to answer that
  // question honestly.
  if (isGroupSealed(message.encrypted)) return 'sender-key';
  if (isSealedEnvelope(message.encrypted) || isEncryptedPayload(message.encrypted)) return 'static';
  return 'none';
}

/**
 * How many independently-decryptable copies a message was sealed into — the
 * real width of the fan-out described in sealForRecipients.
 *
 * Counted from the envelope rather than from the participant list, because
 * those are not always the same number and the envelope is the one that is
 * true: a member who joined after this message was sent has no copy in it and
 * cannot read it, which is exactly what the count should say.
 *
 * Pre-group messages carry a bare payload rather than an envelope, so they
 * report 1 — one copy, which is what they are. Null for anything unsealed.
 */
export function sealedKeyCount(message: Message): number | null {
  const sealed = message.encrypted;
  // A ratchet message is sealed to exactly one recipient by construction.
  if (isRatchetEnvelope(sealed)) return 1;
  // So is a sender-key message, in the sense this counts: one ciphertext for
  // the whole chat, not one per member. The number of people who can open it
  // is the size of the sender's chain distribution, which is not in the
  // message and deliberately not guessed at here.
  if (isGroupSealed(sealed)) return 1;
  if (isSealedEnvelope(sealed)) return Object.keys(sealed.copies).length;
  if (isEncryptedPayload(sealed)) return 1;
  return null;
}
