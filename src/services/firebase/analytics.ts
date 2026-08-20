/**
 * Analytics, through the seam. See ./README.md.
 *
 * Only ../telemetry.ts imports this. That file is already a complete
 * abstraction — five verbs, no Firebase types in its signatures — so it is the
 * natural place a HarmonyOS build stubs analytics out, and this module exists
 * to keep the "nothing outside services/firebase touches the vendor" rule
 * absolute rather than nearly-absolute.
 */
export * from '@react-native-firebase/analytics';
