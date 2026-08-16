/**
 * Background push registration, behind the seam. See ./README.md.
 *
 * index.js called setBackgroundMessageHandler directly at module scope. That
 * file is the bundle entry, so it is evaluated on every platform including
 * HarmonyOS — where the messaging module does not exist.
 */
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';

/**
 * Registers the background message handler.
 *
 * Must run at module scope in the entry file, before React renders: Firebase
 * warns if a background message arrives with no handler registered, and on a
 * cold start triggered *by* a notification that can happen immediately.
 */
export function registerBackgroundMessageHandler(): void {
  setBackgroundMessageHandler(getMessaging(), async () => {});
}

/**
 * Foreground messaging, re-exported so App.tsx can name this module instead of
 * the vendor.
 *
 * The block using these is already gated to `Platform.OS === 'android'`, so it
 * never *runs* elsewhere — but a bare import is enough to pull React Native
 * Firebase into a bundle for a platform that has no such module, which is what
 * the guard is there to prevent.
 */
export {getMessaging, getToken, onMessage, onTokenRefresh} from '@react-native-firebase/messaging';
