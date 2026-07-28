/**
 * Password strength check for sign-up — verbatim port of the mobile app's
 * src/services/passwordPolicy.ts (pure logic, no platform dependency, so it's
 * copied rather than reimplemented). Keep the two in sync.
 *
 * Deliberately NOT a composition-rules checker (no "must contain 1 uppercase,
 * 1 number, 1 symbol"). NIST SP 800-63B recommends against mandated
 * composition rules — they push users toward predictable patterns like
 * "Password1!" without meaningfully raising the cost of guessing, and Firebase
 * Auth's own default (length >= 6, no composition requirement) already
 * reflects this. Length is what actually matters; the blocklist catches the
 * specific, extremely common passwords that meet a length bar but are
 * guessed on the first attempt of any real credential-stuffing list.
 */

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordStrengthResult = 'ok' | 'too-short' | 'too-common' | 'too-simple';

// The ~40 passwords that top essentially every published "most common
// passwords" list (SplashData/NordPass/Have I Been Pwned frequency data).
// Not an exhaustive blocklist — that would need a real corpus and a bundle-
// size tradeoff disproportionate to this app's threat model. This catches
// the passwords an attacker tries *first*, which is the highest-value bar
// a client-side check can clear without a network call.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'letmein123', 'welcome123', 'iloveyou1', 'admin1234',
  'abc123456', 'passw0rd', 'passw0rd1', 'football1', 'baseball1', 'dragon123',
  'monkey123', 'superman1', 'trustno1', 'princess1', 'sunshine1', 'shadow123',
  'master123', 'login1234', 'starwars1', 'freedom123', 'whatever1', 'jordan23',
  'harley123', 'ranger123', 'buster123', 'michael1', 'jennifer1', 'hunter123',
  'thomas123', 'tigger123', 'batman123', 'chelsea1', 'ashley123', 'bailey123',
]);

/** True if `s` is one character repeated (e.g. "aaaaaaaa") or a run of
 * consecutive digits/letters (e.g. "12345678", "abcdefgh"). Both pass a pure
 * length check but offer no real entropy. */
function isTrivialPattern(s: string): boolean {
  if (new Set(s.toLowerCase()).size === 1) return true;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < s.length; i++) {
    const diff = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (diff !== 1) ascending = false;
    if (diff !== -1) descending = false;
  }
  return ascending || descending;
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too-short';
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'too-common';
  if (isTrivialPattern(password)) return 'too-simple';
  return 'ok';
}
