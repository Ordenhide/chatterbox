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

