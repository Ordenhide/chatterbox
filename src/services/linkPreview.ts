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

/**
 * Blocks the obvious SSRF targets before ChatScreen's client-side fallback
 * fetches a URL directly with the `link-preview-js` package. That fallback
 * only runs when the safe path — the rate-limited `fetchLinkPreview` Cloud
 * Function, which resolves DNS, checks the resolved IP against
 * functions/ssrfGuard.js, and connects to that validated IP rather than the
 * hostname — is unreachable, so it's this device doing the fetch instead.
 *
 * Necessarily weaker than the server check: React Native's fetch resolves
 * DNS internally with no hook to validate the IP before connecting, so a
 * hostname that only resolves to a private address at request time (DNS
 * rebinding) isn't caught here. What this does catch — a URL whose host is
 * *literally* a loopback, private, link-local, or reserved IP, or a
 * well-known internal-only name — is the shape of attempt this fallback
 * would otherwise hand straight to the vulnerable library with no check at
 * all (link-preview-js <=4.0.0 has no SSRF protection of its own — see
 * GHSA-4gp8-rjrq-ch6q).
 */
export function isSafeToFetchDirectly(url: string): boolean {
  const match = /^https?:\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(url);
  if (!match) return false;
  let host = match[1].toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return false;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a >= 224) return false; // multicast / reserved
    return true;
  }

  if (host.includes(':')) {
    // IPv6 literal — mirrors functions/ssrfGuard.js's prefix checks.
    if (host === '::1' || host === '::') return false;
    if (/^fe[89ab]/.test(host)) return false; // fe80::/10 link-local
    if (host.startsWith('fc') || host.startsWith('fd')) return false; // fc00::/7 ULA
    if (host.startsWith('::ffff:')) {
      return isSafeToFetchDirectly(`http://${host.slice('::ffff:'.length)}`);
    }
  }

  return true;
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
