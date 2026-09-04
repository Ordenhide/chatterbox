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
/**
 * inet_aton, which is what a URL parser actually does with a numeric host.
 *
 * `127.1`, `2130706433`, `0x7f000001` and `017700000001` all name 127.0.0.1,
 * and a fetch will happily go there. The previous version of this guard
 * matched `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}` against the raw string, so
 * every one of those forms missed the pattern, fell past the IPv4 branch and
 * returned true. Parsing is the only way to see through notation.
 *
 * Returns the four bytes, or null when this is not a numeric host at all.
 */
function parseIPv4(host: string): [number, number, number, number] | null {
  const parts = host.split('.');
  if (parts.length === 0 || parts.length > 4) return null;

  const values: number[] = [];
  for (const part of parts) {
    let value: number;
    if (/^0[xX][0-9a-fA-F]+$/.test(part)) value = Number.parseInt(part.slice(2), 16);
    else if (/^0[0-7]+$/.test(part)) value = Number.parseInt(part.slice(1), 8);
    else if (/^[0-9]+$/.test(part)) value = Number.parseInt(part, 10);
    else return null;
    if (!Number.isFinite(value) || value < 0) return null;
    values.push(value);
  }

  // The last part absorbs the remaining bytes: a.b is a<<24|b, a.b.c is
  // a<<24|b<<16|c, and a bare number is the whole address.
  const last = values.pop() as number;
  const maxLast = 2 ** (8 * (4 - values.length));
  if (last >= maxLast) return null;
  if (values.some(v => v > 0xff)) return null;

  let n = last;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    n += values[i] * 2 ** (8 * (4 - 1 - i));
  }
  if (n > 0xffffffff) return null;
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

/** The 16 bytes of an IPv6 literal, or null. Handles `::` and IPv4 tails. */
function parseIPv6(host: string): number[] | null {
  let text = host;
  let tail: number[] | null = null;
  const lastColon = text.lastIndexOf(':');
  if (text.slice(lastColon + 1).includes('.')) {
    tail = parseIPv4(text.slice(lastColon + 1));
    if (!tail) return null;
    text = text.slice(0, lastColon + 1) + '0:0';
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  if (head.length + rest.length > 8) return null;

  const groups: number[] = [];
  const push = (list: string[]) => {
    for (const g of list) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return false;
      groups.push(Number.parseInt(g, 16));
    }
    return true;
  };
  if (!push(head)) return null;
  const zeros = 8 - head.length - rest.length;
  for (let i = 0; i < zeros; i += 1) groups.push(0);
  if (!push(rest)) return null;
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of groups) bytes.push((g >> 8) & 0xff, g & 0xff);
  if (tail) bytes.splice(12, 4, ...tail);
  return bytes;
}

function isPrivateIPv4([a, b]: [number, number, number, number]): boolean {
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/**
 * True when a host is written as an address rather than a name.
 *
 * Anything that looks like an address must *parse* as one; a hostname is left
 * alone. This is what makes the guard fail closed: `0x7f.1` is not a valid
 * address and is not a plausible hostname either, so it is refused rather
 * than handed to a fetch that might still resolve it.
 */
function looksNumeric(host: string): boolean {
  return host.split('.').every(part => /^(0[xX][0-9a-fA-F]+|[0-9]+)$/.test(part));
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
 * rebinding) isn't caught here. What this does catch is every *literal*
 * address, in whatever notation it is written, plus the well-known
 * internal-only names — and it refuses anything address-shaped that will not
 * parse, rather than assuming it is a hostname.
 *
 * link-preview-js <=4.0.0 has no SSRF protection of its own (GHSA-4gp8-rjrq-ch6q,
 * and the IPv6/loopback bypasses disclosed since), so this is the only check
 * standing between that fallback and the target.
 */
export function isSafeToFetchDirectly(url: string): boolean {
  const match = /^https?:\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(url);
  if (!match) return false;
  let host = match[1].toLowerCase();
  const bracketed = host.startsWith('[') && host.endsWith(']');
  if (bracketed) host = host.slice(1, -1);

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return false;
  }

  if (bracketed || host.includes(':')) {
    const bytes = parseIPv6(host);
    if (!bytes) return false; // address-shaped and unparseable -> refuse
    if (bytes.every(b => b === 0)) return false; // ::
    if (bytes.slice(0, 15).every(b => b === 0) && bytes[15] === 1) return false; // ::1
    if ((bytes[0] & 0xfe) === 0xfc) return false; // fc00::/7 unique-local
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return false; // fe80::/10
    // IPv4-mapped ::ffff:0:0/96 — judge the address it actually reaches.
    if (
      bytes.slice(0, 10).every(b => b === 0) &&
      bytes[10] === 0xff &&
      bytes[11] === 0xff
    ) {
      return !isPrivateIPv4([bytes[12], bytes[13], bytes[14], bytes[15]]);
    }
    return true;
  }

  if (looksNumeric(host)) {
    const v4 = parseIPv4(host);
    if (!v4) return false; // numeric-looking and unparseable -> refuse
    return !isPrivateIPv4(v4);
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
