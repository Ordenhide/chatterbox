/**
 * Error reporting that never leaves the device.
 *
 * This was telemetry.ts, and it sent two things to Google: Firebase Analytics
 * events with `setUserId` set — a per-account log of which screens you opened
 * — and Crashlytics reports carrying the same account identifier. The privacy
 * policy admitted both, in the sentence saying neither is anonymous.
 *
 * Admitting it is not the same as it being acceptable here. Chatterbox's
 * argument is that there is no directory to find you in and no email address
 * on the server; a per-account behavioural log held by the company renting us
 * the servers is that argument's counterexample. Both are gone — the
 * dependencies too, not just the calls, so nothing can quietly start sending
 * again.
 *
 * What stayed is the seam. Forty-odd files hand their errors here, and the
 * distinction between the three functions is load-bearing (see below); losing
 * that would have meant either forty edits or forty silent catch blocks. It
 * logs in development and does nothing in release.
 *
 * The name is part of the guarantee. A file called telemetry.ts invites the
 * next person to put telemetry back in it.
 */
import type {SealedFailure} from './e2ee';

/**
 * A failure the code anticipated, handled, and has already told the user
 * about.
 *
 * The distinction from reportError is not cosmetic. A wrong-key decrypt is
 * not an issue — it is end-to-end encryption behaving exactly as designed on
 * a device that does not hold the key. Treating it as one buried 'corrupt'
 * among the noise, which is the failure that means real damage and the only
 * one worth looking at. In dev it is the difference between a red full-screen
 * overlay stacked over a state the UI is already explaining in words, and a
 * line in the log.
 */
export function reportHandled(error: unknown, context: string) {
  if (__DEV__) {
    console.log(`[handled] ${context}:`, error);
  }
}

/**
 * Logs a decrypt failure at the severity its *cause* deserves.
 *
 * The caller has already diagnosed it — diagnoseSealed can tell "sealed to a
 * key this device doesn't hold" from "the ciphertext is damaged" using the
 * addressing alone. That answer used to be computed for the placeholder text
 * and then thrown away, so every failure arrived here as the same
 * undifferentiated "invalid tag". Passing it through is the whole point: the
 * two need opposite responses, and only one of them is a bug.
 */
export function reportSealedFailure(error: unknown, reason: SealedFailure) {
  if (reason === 'wrong-key' || reason === 'unsupported-algorithm') {
    reportHandled(error, `e2ee_decrypt_${reason.replace(/-/g, '_')}`);
    return;
  }
  // 'corrupt' — the key was right and the body is not. 'not-sealed' —
  // openSealed threw on something diagnoseSealed cannot even recognise as
  // sealed, which means the two disagree about the format. Both are ours.
  reportError(error, `e2ee_decrypt_${reason.replace(/-/g, '_')}`);
}

export function reportError(error: unknown, context?: string) {
  // Chasing a send that reported "couldn't be encrypted" used to mean adding
  // a temporary console.error to see the cause and taking it out again, so
  // this prints in development. Release builds log nothing anywhere.
  if (__DEV__) {
    console.error(`[reportError] ${context ?? 'no context'}:`, error);
  }
}
