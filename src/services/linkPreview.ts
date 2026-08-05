/**
 * Link previews, fetched once by the sender and sealed into the message.
 *
 * Mirrors web/src/services/linkPreview.ts — same fields, same fallbacks, same
 * reasoning — with one difference: the on/off preference already lives in
 * privacyGuard.ts (`isLinkPreviewEnabled`) on this platform, so it isn't
 * duplicated here.
 *
 * ## Why this exists
 *
 * This client already fetched the preview once, at send time, rather than on
 * every view — but it wrote the result to the message document in the clear.
 * So a chat whose text was end-to-end encrypted still handed the server the
 * title, description and image URL of everything either person linked. Sealing
 * the preview closes that: the payload is encrypted with the same
 * X25519/XChaCha20 primitives the message text uses, and only the recipient's
 * device can read it back.
 *
 * ## Backward compatibility
 *
 * The ciphertext lives in a *new* field, `encryptedLinkPreview`, next to the
 * plaintext `linkPreview` written before this existed. Old messages keep
 * rendering from the plaintext field; nothing is migrated. With no peer key to
 * encrypt to — a group chat, or a peer who never enrolled — the write falls
 * back to plaintext rather than failing, exactly as the message path does.
 */
import type {ArtifactCrypto} from './e2eeArtifacts';
import {isSafeExternalUrl} from '../utils/safeUrl';

export interface LinkPreviewData {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
}

/** Matches the web client's URL_RE. */
const URL_RE = /(https?:\/\/[^\s]+)/i;

export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(URL_RE);
  return match ? match[0] : null;
}

/** A preview with nothing but the URL isn't worth a card, or a round trip. */
export function hasPreviewContent(preview: LinkPreviewData | null | undefined): boolean {
  return !!(preview && (preview.title || preview.description || preview.image));
}

export function serializePreview(preview: LinkPreviewData): string {
  return JSON.stringify({
    url: preview.url,
    title: preview.title ?? null,
    description: preview.description ?? null,
    image: preview.image ?? null,
  });
}

/**
 * Parses a sealed preview back into a card's worth of data.
 *
 * Everything here arrives from another client, so it is validated rather than
 * trusted: malformed JSON, a missing URL, or a URL whose scheme isn't safe to
 * open (see utils/safeUrl) all yield null instead of a card.
 */
export function parsePreview(json: string | null | undefined): LinkPreviewData | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  return normalizePreview(raw);
}

/** Same validation as parsePreview, for a preview that was never serialized. */
export function normalizePreview(raw: unknown): LinkPreviewData | null {
  if (!raw || typeof raw !== 'object') return null;
  const {url, title, description, image} = raw as Record<string, unknown>;
  if (typeof url !== 'string' || !isSafeExternalUrl(url)) return null;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {url, title: str(title), description: str(description), image: str(image)};
}

/**
 * The fields to persist for a preview: the sealed one when a peer key was
 * available, the plaintext one otherwise. Callers spread the result, so
 * exactly one of the two is ever written.
 *
 * Split out from the send path so the "does it actually get encrypted"
 * question is answerable by a unit test with a fake crypto, rather than only
 * by reading Firestore.
 */
export function buildLinkPreviewPatch(
  preview: LinkPreviewData,
  crypto: ArtifactCrypto,
): Record<string, unknown> {
  const sealed = crypto.seal(serializePreview(preview));
  if (sealed) return {encryptedLinkPreview: sealed};
  return {linkPreview: preview};
}
