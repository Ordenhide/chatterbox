/**
 * OS-backed secret store for HarmonyOS: unavailable. See ./secureKeyStore.ts.
 *
 * `react-native-keychain` has no HarmonyOS port, and — as with biometrics —
 * there is no pure-JS fallback to reach for: a hardware-backed key store is
 * fundamentally an OS capability, not a network API.
 *
 * Reporting "unavailable" is the honest answer rather than a workaround. It is
 * the same answer the iOS/Android implementation gives on a build where the
 * native module isn't linked, so e2eeKeys.ts's existing fallback already
 * covers it: the device secret key stays in the (encrypted) MMKV store, which
 * is exactly where it lives today. Nothing downstream needs new handling.
 *
 * HarmonyOS does have its own equivalent (@ohos.security.huks / the asset
 * store) — this is where a real implementation would go if that is ever built
 * as a native RNOH TurboModule.
 */

const SERVICE_PREFIX = 'com.chatterbox.e2ee.secretKey';

export function secretKeyService(userId: string): string {
  return `${SERVICE_PREFIX}.${userId}`;
}

export function isSecureStoreAvailable(): boolean {
  return false;
}

export async function getSecret(_service: string): Promise<string | null> {
  return null;
}

export async function setSecretVerified(_service: string, _secret: string): Promise<boolean> {
  return false;
}

export async function removeSecret(_service: string): Promise<void> {
  // No store to remove from.
}
