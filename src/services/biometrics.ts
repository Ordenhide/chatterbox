import ReactNativeBiometrics from 'react-native-biometrics';

/**
 * Biometric auth, behind a seam. See ./biometrics.harmony.ts.
 *
 * appLock.ts is the sole importer, and every call it makes is already
 * wrapped in try/catch that treats any failure as "not available" / "auth
 * failed" — the harmony variant leans on that existing resilience rather
 * than needing its own.
 */
const biometrics = new ReactNativeBiometrics();

export async function simplePrompt(promptMessage: string): Promise<boolean> {
  const result = await biometrics.simplePrompt({promptMessage});
  return result.success;
}

export async function isSensorAvailable(): Promise<boolean> {
  const {available, biometryType} = await biometrics.isSensorAvailable();
  return available && !!biometryType;
}
