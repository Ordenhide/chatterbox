/**
 * The plaintext that goes inside a sealed message.
 *
 * ## Why this exists
 *
 * Attachment content keys have to reach exactly the people who can read the
 * message, with exactly the message's own protection. The tempting shape — a
 * second sealed field next to the body — would have meant a second envelope,
 * a second fallback decision, and a media key that quietly kept using the
 * static path after the body moved to the ratchet.
 *
 * Putting the key *inside* the body instead means media inherits whatever the
 * body already gets: the double ratchet in a 1:1 chat, sender keys in a group,
 * fan-out when a peer is on an older client. One transport decision, made in
 * one place, and forward secrecy that arrived for text applies to photos for
 * free rather than needing its own design.
 *
 * ## Staying compatible with what is already deployed
 *
 * Sealed bodies in the wild are bare UTF-8 strings. A client that has already
 * shipped will hand whatever it decrypts straight to the message list, so a
 * new encoding cannot simply be switched on.
 *
 * So a text-only message still encodes to exactly the string it always did —
 * byte-identical, no marker, nothing to misread. Only a message that actually
 * carries media uses the structured form, and that form starts with a NUL, a
 * byte no previous sender could emit and no text input produces.
 *
 * The one hole in "no text input produces it" is a user pasting the marker
 * itself. {@link encodeBody} closes it: text that begins with the marker is
 * forced down the structured path, so it round-trips as text instead of being
 * decoded as a header. A reader can therefore trust the marker completely.
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
