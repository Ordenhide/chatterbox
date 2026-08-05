/**
 * URL scheme guarding for anything that reaches an `href`.
 *
 * Several link targets in this app are written by the *other* participant —
 * a playlist track URL is a free-text field, and a file message's `uri` comes
 * from whatever the sender's client wrote. Firestore rules let any chat
 * participant write those, so without a scheme check one participant can
 * store `javascript:…` and have it execute in the other's origin the moment
 * they click. That is script execution with the victim's Firebase session,
 * which is a particularly poor trade in an app that end-to-end encrypts the
 * message bodies.
 *
 * `data:` cannot simply be banned: attachments under MAX_INLINE_BYTES are
 * stored inline as `data:<mime>;base64,…`, so blocking it outright would
 * break every small file, image and voice message. It is allowed only for
 * media types that browsers do not execute — `image/svg+xml` is excluded
 * precisely because SVG can carry <script>.
 */

/** Schemes safe to navigate to. */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/**
 * `data:` payloads that render as media rather than as a document. SVG is
 * deliberately absent — it is an executable document format.
 */
const SAFE_DATA_URI =
  /^data:(?:image\/(?!svg\b)[a-z0-9.+-]+|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|application\/pdf|application\/octet-stream)\s*[;,]/i;

/**
 * Browsers ignore ASCII whitespace and control characters inside a scheme, so
 * `java\nscript:alert(1)` navigates just like `javascript:alert(1)`. Strip
 * them before parsing or the check is trivially bypassed.
 */
function normalize(raw: string): string {
  // \u0000-\u0020 covers NUL through space: tabs, newlines and the C0 range
  // browsers silently drop when resolving a scheme.
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0020]/g, '');
}

/**
 * Returns a URL safe to put in an `href`, or null if it isn't.
 *
 * A value with no scheme at all (`example.com`) is treated as `https://` —
 * as a bare `href` it would otherwise resolve as a relative app path, which
 * is never what someone pasting a link meant.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = normalize(raw);
  if (!cleaned) return null;

  if (SAFE_DATA_URI.test(cleaned)) return cleaned;

  // Scheme-relative ("//evil.com") inherits the page scheme and is a real URL;
  // everything else without a scheme is treated as a bare host.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(cleaned);
  if (!hasScheme && !cleaned.startsWith('//')) {
    return safeExternalUrl(`https://${cleaned}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned, window.location.origin);
  } catch {
    return null;
  }
  return SAFE_SCHEMES.has(parsed.protocol) ? parsed.href : null;
}

/** True when the value is safe to link to. */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  return safeExternalUrl(raw) !== null;
}
