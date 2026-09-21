/**
 * Attachment uploads that survive the app being killed mid-transfer.
 *
 * ## Why this exists
 *
 * Sending an attachment used to be: upload the bytes, then build the message
 * from the URL the upload returned. That ordering is what made an interrupted
 * send unrecoverable. Firebase's `putFile` task lives only in the process that
 * started it — `@react-native-firebase/storage` exposes `pause()`/`resume()`
 * but no way to rebuild a task from a persisted session URI — so killing the
 * app took the transfer with it. And because the message did not exist yet,
 * it took the message too: the file, the encryption work and the send all
 * vanished with no record that any of it had been attempted, and the
 * already-encrypted scratch file was left orphaned in the cache directory
 * where nothing would ever collect it.
 *
 * So the order is inverted. The message is built first, with its media URL
 * still missing, and recorded in the outbox — the same durable queue offline
 * text sends already use — *before* a single byte is uploaded. The upload
 * becomes a step that completing the queued item performs.
 *
 * ## Two halves, and why both are needed
 *
 * This record is the bookkeeping: it keeps the *send* alive across a crash.
 * {@link ./resumableUpload} is the transport, and it keeps the *bytes* alive
 * — it drives Cloud Storage's resumable protocol directly instead of
 * `putFile`, so the upload has a session URL that outlives the process.
 *
 * `sessionUrl` is where the two meet, and it is the reason this record is
 * written more than once: it is stored the moment the session is opened,
 * before any bytes move. A session URL held only in memory would be lost by
 * the same crash it exists to survive, and the next attempt would start a
 * fresh session and re-send the whole file — the exact behaviour both halves
 * are here to stop.
 */
import type {MediaSlot} from './messageBody';

/**
 * An attachment whose bytes are on this device but not yet in Storage.
 *
 * Travels with the outbox entry for the message waiting on it, so both are
 * persisted and recovered together.
 */
export type PendingUpload = {
  /** Local file to upload: the encrypted scratch copy, or the picked file. */
  path: string;
  /** Name to store it under. Random when encrypted, so the bucket listing
   * does not publish the document's own filename. */
  objectName: string;
  /** Which of the message's media fields the resulting URL fills. */
  slot: MediaSlot;
  /**
   * Whether `path` is ours to delete once the upload lands.
   *
   * False when the bytes go up unencrypted, because `path` is then the URI the
   * picker handed over — which may belong to a document provider, and deleting
   * it is not ours to do. True for a scratch copy this app encrypted.
   */
  ownsPath: boolean;
  /** The object's content type, which the upload session is opened with. */
  mime: string;
  /**
   * The resumable session this upload is using, once one has been opened.
   *
   * Stored before any bytes are sent, so a crash leaves behind the one thing
   * that makes the transferred bytes recoverable. Absent means no session has
   * been opened yet; present means the next attempt should ask that session
   * how much arrived rather than starting over. See ./resumableUpload.
   */
  sessionUrl?: string;
};

/**
 * Puts an uploaded object's URL into the message field that was waiting for it.
 *
 * Returns a new message; the input is not modified, so a failed send leaves
 * the queued copy exactly as it was rather than half-filled.
 *
 * The `file` slot is the odd one out: its URL lives at `file.uri` alongside
 * the name, type and size the picker reported, rather than in a field of its
 * own. Missing that is how a file attachment would arrive with its metadata
 * intact and nothing to download.
 */
export function applyUploadedUrl<T extends Record<string, any>>(
  message: T,
  slot: MediaSlot,
  url: string,
): T {
  if (slot === 'file') {
    return {...message, file: {...(message.file ?? {}), uri: url}};
  }
  return {...message, [slot]: url};
}
