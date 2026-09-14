/**
 * Verbatim port of the mobile app's src/services/messageBody.ts.
 *
 * Must stay byte-identical below the header: this is the wire format of a
 * sealed body, so a divergence means one client writes a body the other reads
 * as plain text — which, for a message carrying an attachment, means showing
 * the reader a NUL marker and a JSON header instead of their message, and
 * losing the attachment key inside it.
 */
import {isMediaKeyInfo, type MediaKeyInfo} from './mediaCrypto';

/**
 * Leading marker for the structured form. The NUL is what makes it
 * unforgeable-by-accident: valid message text does not start with one.
 */
const MARKER = '\u0000cbx-body-1\u0000';

/** Which attachment slot a content key belongs to. */
export type MediaSlot = 'image' | 'video' | 'audio' | 'file';

export const MEDIA_SLOTS: readonly MediaSlot[] = ['image', 'video', 'audio', 'file'];

export type MessageBody = {
  text: string;
  /** Content keys for this message's attachments, by slot. */
  media?: Partial<Record<MediaSlot, MediaKeyInfo>>;
};

function hasAnyMedia(media: MessageBody['media']): boolean {
  if (!media) return false;
  return MEDIA_SLOTS.some(slot => media[slot] !== undefined);
}

/**
 * Encodes a body for sealing.
 *
 * Returns the bare text whenever it can, both for compatibility and because
 * the structured form costs several hundred bytes per attachment and there is
 * no reason to spend them on a message that has none.
 */
export function encodeBody(body: MessageBody): string {
  const media = hasAnyMedia(body.media) ? body.media : undefined;
  if (!media && !body.text.startsWith(MARKER)) return body.text;

  const payload: MessageBody = media ? {text: body.text, media} : {text: body.text};
  return MARKER + JSON.stringify(payload);
}

/**
 * Decodes a sealed body. Never throws: this runs on remote input, and a
 * message that arrives malformed should render as an unreadable message
 * rather than take down the chat list.
 *
 * A structured payload that fails to parse degrades to empty text with no
 * media, which shows the reader an empty message — visible, and safe.
 */
export function decodeBody(encoded: string): MessageBody {
  if (!encoded.startsWith(MARKER)) return {text: encoded};

  try {
    const parsed = JSON.parse(encoded.slice(MARKER.length)) as unknown;
    if (!parsed || typeof parsed !== 'object') return {text: ''};

    const raw = parsed as {text?: unknown; media?: unknown};
    const text = typeof raw.text === 'string' ? raw.text : '';

    const media: Partial<Record<MediaSlot, MediaKeyInfo>> = {};
    if (raw.media && typeof raw.media === 'object') {
      const rawMedia = raw.media as Record<string, unknown>;
      for (const slot of MEDIA_SLOTS) {
        const candidate = rawMedia[slot];
        // Validated rather than cast. A malformed key here would otherwise
        // surface as a crash deep in the decryptor, on a path fed by whatever
        // the sender chose to put in the field.
        if (isMediaKeyInfo(candidate)) media[slot] = candidate;
      }
    }

    return hasAnyMedia(media) ? {text, media} : {text};
  } catch {
    return {text: ''};
  }
}

/** True when `encoded` uses the structured form. Exported for tests and logs. */
export function isStructuredBody(encoded: string): boolean {
  return encoded.startsWith(MARKER);
}
