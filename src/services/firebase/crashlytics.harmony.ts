/**
 * Crashlytics for HarmonyOS: deliberately inert. See ./README.md.
 *
 * Crashlytics is native-only — there is no JS SDK module for it on any
 * platform, so there is nothing to forward to here.
 *
 * The consequence is worth stating plainly: a HarmonyOS build reports no
 * crashes and no non-fatal errors anywhere. Every reportError call in the app
 * still runs and still logs in __DEV__ (see ../telemetry.ts), but nothing
 * leaves the device. Wiring this to AppGallery Connect's crash service should
 * come before any real HarmonyOS release, not after.
 */
export function getCrashlytics(): Record<string, never> {
  return {};
}

export function log(_crashlytics: unknown, _message: string): void {}
export function recordError(_crashlytics: unknown, _error: Error): void {}
export function setUserId(_crashlytics: unknown, _id: string): void {}
