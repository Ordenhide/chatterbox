/**
 * @format
 */

// Must be first: polyfills crypto.getRandomValues, which Hermes does not
// provide and which every key/nonce/salt in src/services/crypto.ts depends on.
// Importing it after any module that generates randomness at import time would
// silently fall back to a non-cryptographic source.
import 'react-native-get-random-values';
import 'react-native-gesture-handler';
// Installed before anything that could fail. Reporting still needs Firebase,
// which initialises inside App — so a failure earlier than that is dropped
// rather than queued; catching everything from here on is the tradeoff, and
// the alternative (installing after init) misses startup entirely.
import {installGlobalErrorHandler} from './src/services/globalErrorHandler';
import './src/i18n';
import {enableScreens} from 'react-native-screens';
import {AppRegistry} from 'react-native';
import {registerBackgroundMessageHandler} from './src/services/firebase/push';
import {initFirebase} from './src/services/firebase/bootstrap';
import App from './App';
import {name as appName} from './app.json';

installGlobalErrorHandler();

/**
 * Started here rather than in App's useEffect, which is where it used to live.
 *
 * Measured on device: the app's first render happened at t=0 and the auth
 * state did not arrive until +827ms, which the launch screen then had to wait
 * out. An effect runs *after* React has rendered the whole tree, so the native
 * SDK was not even beginning to restore the persisted session until everything
 * else was already done. At module scope it warms during bundle evaluation and
 * overlaps the mount instead of following it.
 *
 * Wrapped because a throw here would take the whole entry point with it;
 * installGlobalErrorHandler above is already in place to receive it. App.tsx
 * still calls initFirebase for its own error path — it is idempotent now.
 */
try {
  initFirebase();
} catch (error) {
  console.error('[firebase] early init failed:', error);
}

enableScreens(true);

// Platform-resolved: a no-op on HarmonyOS, which has no Play Services and
// therefore no FCM. See src/services/firebase/push.harmony.ts.
registerBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);

