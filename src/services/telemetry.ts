import {
  getAnalytics,
  logEvent,
  setUserId as setAnalyticsUserId,
} from './firebase/analytics';
import {
  getCrashlytics,
  log as crashLog,
  recordError,
  setUserId as setCrashlyticsUserId,
} from './firebase/crashlytics';
import type {SealedFailure} from './e2ee';

const telemetryEnabled = !__DEV__;
const analytics = telemetryEnabled ? getAnalytics() : null;
const crashlytics = telemetryEnabled ? getCrashlytics() : null;

export async function trackEvent(name: string, params?: Record<string, any>) {
  if (!telemetryEnabled || !analytics) return;
  try {
    await logEvent(analytics, name, params);
  } catch {
    // Ignore analytics failures to avoid blocking UX.
  }
}

export async function trackScreen(screenName: string) {
  if (!telemetryEnabled) return;
  await trackEvent('screen_view', {screen_name: screenName});
}

export async function setTelemetryUser(userId: string | null) {
  if (!telemetryEnabled) return;
  try {
    if (analytics) {
      await setAnalyticsUserId(analytics, userId || null);
    }
  } catch {
    // Ignore analytics failures.
  }
  try {
    if (crashlytics) {
      await setCrashlyticsUserId(crashlytics, userId || '');
    }
  } catch {
    // Ignore crashlytics failures.
  }
}

export function logBreadcrumb(message: string) {
  if (!telemetryEnabled || !crashlytics) return;
  crashLog(crashlytics, message);
}

/**
 * A failure the code anticipated, handled, and has already told the user
 * about — recorded as a breadcrumb rather than an error.
 *
 * The distinction is not cosmetic. reportError calls Crashlytics'
 * recordError, which opens an issue; a wrong-key decrypt is not an issue,
 * it is end-to-end encryption behaving exactly as designed on a device that
 * does not hold the key. Filing it anyway had two costs: a steady stream of
 * non-crashes from every user with an un-restored second device, and — the
 * one that matters — burying 'corrupt' among them, which is the failure
 * that means real damage and the only one worth waking up for. In dev it is
 * the difference between a red full-screen overlay stacked over a state the
 * UI is already explaining in words, and a line in the log.
 */
export function reportHandled(error: unknown, context: string) {
  if (__DEV__) {
    console.log(`[handled] ${context}:`, error);
  }
  if (!telemetryEnabled || !crashlytics) return;
  const detail = error instanceof Error ? error.message : String(error);
  crashLog(crashlytics, `${context}: ${detail}`);
}

/**
 * Reports a decrypt failure at the severity its *cause* deserves.
 *
 * The caller has already diagnosed it — diagnoseSealed can tell "sealed to a
 * key this device doesn't hold" from "the ciphertext is damaged" using the
 * addressing alone. That answer used to be computed for the placeholder text
 * and then thrown away, so every failure reached telemetry as the same
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
  // Ahead of the telemetry guard on purpose. Telemetry is off by default, and
  // Crashlytics is not wired up on a debug build at all, so every error handed
  // to reportError used to vanish leaving nothing anywhere — precisely when
  // someone is trying to find out why something failed. Chasing a send that
  // reported "couldn't be encrypted" meant adding a temporary console.error to
  // see the cause, then taking it out again. Dev-only, so release builds are
  // unchanged.
  if (__DEV__) {
    console.error(`[reportError] ${context ?? 'no context'}:`, error);
  }
  if (!telemetryEnabled || !crashlytics) return;
  if (context) {
    crashLog(crashlytics, context);
  }
  const err = error instanceof Error ? error : new Error(String(error));
  recordError(crashlytics, err);
}

