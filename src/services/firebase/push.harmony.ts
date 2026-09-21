/**
 * Background push for HarmonyOS: not implemented. See ./README.md.
 *
 * Firebase Cloud Messaging cannot work here at any layer. It depends on Google
 * Play Services to hold the device's connection to Google's servers, and
 * HarmonyOS has no Play Services and never will.
 *
 * This is the one part of the port with no swap available — the replacement is
 * Huawei Push Kit, a different service with its own token lifecycle, payload
 * format and console. It has to be built as a feature, not substituted as an
 * implementation, which is why this is an empty function rather than an
 * attempt at one.
 *
 * Until then a HarmonyOS build receives no push notifications. Messages still
 * arrive over the Firestore listener while the app is open; what is missing is
 * being told about them when it is not.
 */
export function registerBackgroundMessageHandler(): void {}

/** Nothing to reveal: no notification was ever posted. See above. */
export async function revealNotificationsAfterUnlock(_userId: string): Promise<void> {}

/* Foreground messaging: unavailable, for the same reason as above. These exist
 * so the import in App.tsx resolves; the code calling them is gated to
 * `Platform.OS === 'android'` and never reaches HarmonyOS. */
export function getMessaging(): Record<string, never> {
  return {};
}
export async function getToken(_messaging: unknown): Promise<string> {
  throw new Error('FCM is unavailable on HarmonyOS — see push.harmony.ts');
}
export function onMessage(_messaging: unknown, _handler: unknown): () => void {
  return () => {};
}
export function onTokenRefresh(_messaging: unknown, _handler: unknown): () => void {
  return () => {};
}

/**
 * Permission, for the same reason the rest of these exist: the import has to
 * resolve. NOT_DETERMINED is the honest answer — there is no notification
 * permission to ask for, because there is no notification transport.
 */
export const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
} as const;
export async function requestPermission(_messaging: unknown): Promise<number> {
  return AuthorizationStatus.NOT_DETERMINED;
}
