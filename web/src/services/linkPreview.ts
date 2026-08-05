/**
 * Link previews, fetched once by the sender and sealed into the message.
 *
 * ## Why this exists
 *
 * The old design had every *viewer* call the `fetchLinkPreview` Cloud Function
 * as the bubble rendered, with only an in-memory cache in front of it. So a
 * link shared in a private chat was reported to the server by both people, on
 * every reload, forever. Messages themselves are end-to-end encrypted, which
 * made that the widest remaining hole in the app's own claim: the server never
 * learns what you said, but it learned every link you shared *and* that the
 * other person opened the chat and looked at it.
 *
 * Now the sender resolves the preview once, at send time, and the result is
 * encrypted into the message with the same X25519/XChaCha20 primitives the
 * text uses. The recipient renders from the sealed copy and never asks the
 * server about the link at all. Server-side visibility drops from "every
 * viewer, every load" to "once, by the person who chose to paste the link" —
 * which is the shape Signal settled on, and for the same reason.
 *
 * ## Backward compatibility
 *
 * The ciphertext lives in a *new* field, `encryptedLinkPreview`, next to the
 * plaintext `linkPreview` the mobile client has always written (see
 * ChatScreen's addLinkPreview). Older messages keep their plaintext field and
 * keep rendering; nothing is migrated. When there's no peer key to encrypt to
 * — a group chat, or a peer who never enrolled — the write falls back to the
 * plaintext field rather than failing, exactly as the message path does.
 *
 * Messages sent before this change carry no stored preview, so their cards
 * disappear. That is the intended trade: re-fetching them on view is the
 * behaviour being removed.
 */
import type {ArtifactCrypto} from './e2eeArtifacts';
import {isSafeExternalUrl} from '../utils/safeUrl';

export interface LinkPreviewData {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
}

/** Matches ChatPane's URL_RE and the mobile client's extractUrl. */
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
 * link (see utils/safeUrl) all yield null instead of a card.
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

// ---- Per-device preference --------------------------------------------------

const STORAGE_KEY = 'cb.linkPreview.v1';

/**
 * Mirrors the stored value so a storage failure falls back to the last known
 * choice rather than silently reverting to the default and resuming fetches
 * for someone who turned them off.
 */
let cached = true;

/**
 * On by default: previews are what people expect from a chat app, and the
 * remaining exposure (one fetch, by the sender) is small enough not to warrant
 * a broken-looking default. Off is for people who want the server to learn
 * nothing at all.
 *
 * Per device, like AI consent (see aiConsent.ts) — a preference about what
 * this device sends shouldn't be inherited silently by a new one.
 */
export function isLinkPreviewEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) cached = stored !== 'off';
  } catch {
    /* keep the last known value */
  }
  return cached;
}

export function setLinkPreviewEnabled(enabled: boolean): void {
  cached = enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* the in-memory value still applies for this session */
  }
}

/** Test seam — drops the memoised value. */
export function __resetLinkPreviewCache(): void {
  cached = true;
}
