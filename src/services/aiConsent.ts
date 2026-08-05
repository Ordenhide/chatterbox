/**
 * Consent for AI features that send content off the device.
 *
 * Mirrors web/src/services/aiConsent.ts — same key, same fail-closed
 * behaviour, same reasoning — with one deliberate difference: the mobile
 * store (MMKV) is exposed through an async wrapper, so the guard is async
 * too. Every AI service here is already async, so that costs nothing.
 *
 * Summarising a chat, translating a message and transcribing a voice note all
 * decrypt on this device and send the **plaintext** to a Cloud Function, which
 * forwards it to Cloudflare Workers AI. That is the one place this app's
 * end-to-end encryption is opened on purpose, so it is gated behind an
 * explicit, revocable disclosure.
 *
 * Consent is per device by design: syncing it would let a new phone silently
 * inherit a decision made on another device, so the person holding the device
 * now sending their messages away would never see the disclosure.
 *
 * The check lives here rather than in the screens so a future call site cannot
 * bypass it by forgetting to ask first.
 */
import {mmkvStorage} from './storageMMKV';

const STORAGE_KEY = 'cb.ai.consent.v1';

/** In-memory mirror so repeated guards don't hit storage on every call. */
let cached: boolean | null = null;

/** Thrown by AI calls when the user has not accepted the disclosure. */
export class AiConsentRequiredError extends Error {
  readonly code = 'ai-consent-required';
  constructor() {
    super('AI consent required');
    this.name = 'AiConsentRequiredError';
  }
}

export function isAiConsentError(error: unknown): boolean {
  return (error as {code?: string})?.code === 'ai-consent-required';
}

/** True when this device has an explicit, un-revoked grant. */
export async function hasAiConsent(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    cached = (await mmkvStorage.getItem(STORAGE_KEY)) === 'granted';
  } catch {
    // Failing closed is the only safe default for something that transmits
    // decrypted messages: a storage error must never read as "allowed".
    cached = false;
  }
  return cached;
}

export async function grantAiConsent(): Promise<void> {
  cached = true;
  try {
    await mmkvStorage.setItem(STORAGE_KEY, 'granted');
  } catch {
    // Nothing persisted; the grant lapses when the app restarts, which errs
    // in the safe direction.
  }
}

export async function revokeAiConsent(): Promise<void> {
  cached = false;
  try {
    await mmkvStorage.removeItem(STORAGE_KEY);
  } catch {
    /* the in-memory flag still blocks sends for this session */
  }
}

/** Guard for every call that transmits decrypted content. */
export async function assertAiConsent(): Promise<void> {
  if (!(await hasAiConsent())) throw new AiConsentRequiredError();
}

/** Test seam — resets the memoised value. */
export function __resetAiConsentCache(): void {
  cached = null;
}
