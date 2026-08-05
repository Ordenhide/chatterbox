/**
 * Consent for AI features that send content off the device.
 *
 * This app end-to-end encrypts messages and, as of the artifact work, the
 * shared lists/playlists/countdowns too. The AI features are the one place
 * that envelope is deliberately opened: summarising a chat, translating a
 * message and transcribing a voice note all decrypt on this device and then
 * send the **plaintext** to a Cloud Function, which forwards it to Cloudflare
 * Workers AI. Nothing about that is visible from the UI today, and the people
 * it affects are the ones paying for Pro.
 *
 * So it is gated: nothing leaves until the user has been told plainly what
 * leaves, and the consent is revocable at any time.
 *
 * ## Why this is stored per device, not per account
 *
 * Consent is an informed decision made by a person sitting in front of a
 * particular device. Syncing it would mean a new phone silently inherits a
 * choice made months ago on a laptop — the user would never see the
 * disclosure on the device that is now sending their messages away. Asking
 * again on each device is the point, not an oversight.
 *
 * ## Why the check lives here rather than in the UI
 *
 * services/ai.ts calls `assertAiConsent()` itself, so a future call site
 * cannot bypass the gate by forgetting to check first. The UI catches the
 * thrown error and shows the disclosure; the service is what actually
 * enforces it.
 */

const STORAGE_KEY = 'cb.ai.consent.v1';

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
export function hasAiConsent(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'granted';
  } catch {
    // Private mode / storage disabled: treat as not consented. Failing closed
    // is the only safe default for something that transmits plaintext.
    return false;
  }
}

export function grantAiConsent(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'granted');
  } catch {
    /* nothing to persist to; the caller stays un-consented next load */
  }
}

export function revokeAiConsent(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Guard for every call that transmits decrypted content. */
export function assertAiConsent(): void {
  if (!hasAiConsent()) throw new AiConsentRequiredError();
}
