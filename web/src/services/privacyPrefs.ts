/**
 * The web half of the two opt-in signals — typing indicators and read
 * receipts. Mirrors src/services/privacyGuard.ts, which holds the same pair
 * for mobile.
 *
 * It exists because the mobile switches alone were a half-covering promise:
 * this client writes `typingBy` and `lastReadAt` from its own code paths, so a
 * user who turned them off on their phone kept broadcasting from their laptop.
 * A privacy setting that only covers one of a person's devices is worse than
 * none, because it is believed.
 *
 * ## Off by default, and reciprocal
 *
 * `typingBy` records when someone was at their keyboard and how long they
 * spent composing; `lastReadAt` records when they read and therefore how long
 * they took to answer. Both sit in the clear on the server, beside messages
 * that do not, and neither is needed for the app to work.
 *
 * Reciprocal — one flag governs sending yours and seeing theirs — because the
 * alternative is taking the signal without giving it, and because a send-only
 * switch cannot be described in one sentence.
 *
 * ## Still per-device
 *
 * This is localStorage, as the mobile one is MMKV: the choice does not travel
 * with the account. Someone signing in on a third device broadcasts again
 * until they set it there too. Making it account-wide would mean storing the
 * preference in `users/{uid}` — a single boolean the server can read, in
 * exchange for the timestamps it suppresses, which is probably the right trade
 * and is not this change.
 */

const TYPING_KEY = 'chatterbox:privacy:typingIndicator';
const RECEIPTS_KEY = 'chatterbox:privacy:readReceipts';

/**
 * Reads default to *off*, including when storage cannot be read at all —
 * private windows, blocked site data, an origin that throws on access. A
 * failure to learn the preference must not become a decision to broadcast.
 */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeFlag(key: string, enabled: boolean): void {
  try {
    localStorage.setItem(key, enabled ? 'true' : 'false');
  } catch {
    // A device that cannot remember the choice keeps the safe default, which
    // is the state it is already in.
  }
}

export function isTypingIndicatorEnabled(): boolean {
  return readFlag(TYPING_KEY);
}

export function setTypingIndicatorEnabled(enabled: boolean): void {
  writeFlag(TYPING_KEY, enabled);
}

export function isReadReceiptsEnabled(): boolean {
  return readFlag(RECEIPTS_KEY);
}

export function setReadReceiptsEnabled(enabled: boolean): void {
  writeFlag(RECEIPTS_KEY, enabled);
}
