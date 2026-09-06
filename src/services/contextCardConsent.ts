/**
 * Consent for context cards, which look names up on Wikipedia.
 *
 * Modelled on services/aiConsent.ts — same fail-closed default, same
 * per-device storage, same reason for keeping the guard in a service rather
 * than in the screen. What differs is where the disclosure appears: an AI
 * feature is invoked by a tap, so it can ask in the moment. Context cards run
 * on their own whenever a thread is open, and an alert that interrupts you for
 * opening a conversation would be worse than the feature is good. So the
 * disclosure lives beside the switch in Profile, and turning it *on* is the
 * moment of consent.
 *
 * ## What it was doing before this existed
 *
 * The card fetch read the last fifteen messages of every thread you opened,
 * pulled capitalised phrases out of their decrypted text, and sent each one to
 * en.wikipedia.org with the device's IP. Nothing gated it, and — because the
 * cards themselves are behind SHOW_NATIVE_ONLY_FEATURES, which is off — none
 * of it was ever displayed. An end-to-end encrypted app was handing a third
 * party the proper nouns out of private conversations in exchange for nothing
 * at all.
 *
 * Off by default, and not synced: a decision made on one device must not put
 * another device's conversations on the wire without the person holding it
 * ever seeing the disclosure.
 */
import {mmkvStorage} from './storageMMKV';

const STORAGE_KEY = 'cb.contextCards.consent.v1';

/** In-memory mirror so the per-message guard doesn't hit storage each time. */
let cached: boolean | null = null;

/** True when this device has an explicit, un-revoked grant. */
export async function hasContextCardConsent(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    cached = (await mmkvStorage.getItem(STORAGE_KEY)) === 'granted';
  } catch {
    // A storage error must never read as "allowed" for something that puts
    // words from private messages on the network.
    cached = false;
  }
  return cached;
}

export async function grantContextCardConsent(): Promise<void> {
  cached = true;
  try {
    await mmkvStorage.setItem(STORAGE_KEY, 'granted');
  } catch {
    // Nothing persisted; the grant lapses on restart, which errs safely.
  }
}

export async function revokeContextCardConsent(): Promise<void> {
  cached = false;
  try {
    await mmkvStorage.removeItem(STORAGE_KEY);
  } catch {
    /* the in-memory flag still blocks lookups for this session */
  }
}

/** Test seam — resets the memoised value. */
export function __resetContextCardConsentCache(): void {
  cached = null;
}
