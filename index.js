/**
 * @format
 */

// Must be first: polyfills crypto.getRandomValues, which Hermes does not
// provide and which every key/nonce/salt in src/services/crypto.ts depends on.
// Importing it after any module that generates randomness at import time would
// silently fall back to a non-cryptographic source.
import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import './src/i18n';
import {enableScreens} from 'react-native-screens';
import {AppRegistry} from 'react-native';
import {registerBackgroundMessageHandler} from './src/services/firebase/push';
import App from './App';
import {name as appName} from './app.json';

enableScreens(true);

// Platform-resolved: a no-op on HarmonyOS, which has no Play Services and
// therefore no FCM. See src/services/firebase/push.harmony.ts.
registerBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);

