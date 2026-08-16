/**
 * Analytics for HarmonyOS: deliberately inert. See ./README.md.
 *
 * There is no portable implementation to forward to. The JS SDK's analytics
 * module is browser-only — it loads gtag.js and needs a DOM — and Google
 * Analytics has no HarmonyOS client. So this satisfies the calls
 * ../telemetry.ts makes and does nothing with them.
 *
 * That is a real functional gap, not an oversight: a HarmonyOS build reports no
 * product analytics until it is pointed at something that exists there
 * (AppGallery Connect's own analytics being the obvious candidate). Nothing in
 * the product depends on it, which is why the port can proceed without it.
 *
 * Silent rather than throwing, and resolving rather than rejecting, because
 * telemetry must never be able to break a screen.
 */
export function getAnalytics(_app?: unknown): Record<string, never> {
  return {};
}

export async function logEvent(
  _analytics: unknown,
  _name: string,
  _params?: Record<string, unknown>,
): Promise<void> {}

export async function setUserId(_analytics: unknown, _id: string | null): Promise<void> {}

export async function logScreenView(
  _analytics: unknown,
  _params?: Record<string, unknown>,
): Promise<void> {}
