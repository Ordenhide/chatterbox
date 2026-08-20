/**
 * Biometric auth for HarmonyOS: unavailable. See ./biometrics.ts.
 *
 * `react-native-biometrics` has no HarmonyOS port anywhere, and unlike
 * Firebase there is no pure-JS fallback to reach for — biometric
 * authentication is fundamentally a native OS capability (Face ID / Touch ID
 * / fingerprint), not a network API.
 *
 * Reporting "unavailable" is the honest answer, not a workaround: it's
 * exactly what appLock.ts's own try/catch already produces on a real device
 * where the sensor genuinely isn't there, so nothing downstream needs new
 * handling for this case — isBiometricsAvailable() returning false already
 * hides the biometric-unlock option from the UI.
 *
 * HarmonyOS does have its own biometric API (@ohos.userIAM.userAuth) — this
 * is where a real implementation would go if that's ever built as a native
 * RNOH TurboModule.
 */
export async function simplePrompt(_promptMessage: string): Promise<boolean> {
  return false;
}

export async function isSensorAvailable(): Promise<boolean> {
  return false;
}
