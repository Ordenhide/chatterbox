/**
 * URL scheme guarding for anything handed to Linking.openURL.
 *
 * Mirrors web/src/utils/safeUrl.ts (this repo's parallel-not-shared
 * convention), with one deliberate difference: it parses the scheme by hand
 * rather than with `new URL()`, whose React Native polyfill is incomplete.
 *
 * The threat is milder here than on web — there is no page origin for
 * `javascript:` to execute in — but `Linking.openURL` will happily hand an
 * arbitrary scheme to whatever app claims it. Since a chat participant writes
 * these values (playlist links, file URIs, link previews), an unchecked one
 * can silently launch a dialler, compose an SMS, or deep-link into another
 * installed app on tap.
 *
 * `data:` stays allowed for non-executable media types because attachments
 * under MAX_INLINE_DATA_URI_CHARS are stored inline as data URIs.
 */

const SAFE_SCHEMES = new Set(['http', 'https', 'mailto']);

/** `data:` payloads that render as media. SVG is excluded — it can carry script. */
const SAFE_DATA_URI =
  /^data:(?:image\/(?!svg\b)[a-z0-9.+-]+|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|application\/pdf|application\/octet-stream)\s*[;,]/i;

/** Strips the C0 range and space, which are ignored when a scheme is resolved. */
function normalize(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0020]/g, '');
}

/**
 * Returns a URL safe to open, or null if it isn't.
 *
 * A bare host (`example.com`) is promoted to https rather than rejected —
 * without a scheme Linking.openURL would fail anyway.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = normalize(raw);
  if (!cleaned) return null;

  if (SAFE_DATA_URI.test(cleaned)) return cleaned;

  const match = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (!match) {
    // Scheme-relative "//host" has no scheme to inherit outside a browser.
    if (cleaned.startsWith('//')) return `https:${cleaned}`;
    return `https://${cleaned}`;
  }
  return SAFE_SCHEMES.has(match[1].toLowerCase()) ? cleaned : null;
}

/** True when the value is safe to open. */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  return safeExternalUrl(raw) !== null;
}
