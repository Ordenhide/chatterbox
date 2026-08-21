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
import App from './App';
import {name as appName} from './app.json';

installGlobalErrorHandler();

enableScreens(true);

// Platform-resolved: a no-op on HarmonyOS, which has no Play Services and
// therefore no FCM. See src/services/firebase/push.harmony.ts.
registerBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);

