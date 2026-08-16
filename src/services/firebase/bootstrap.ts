/**
 * App initialisation and App Check, behind the seam. See ./README.md.
 *
 * App.tsx used to import `@react-native-firebase/app` and `/app-check`
 * directly. It sits outside `src/`, so the ESLint guard — which is scoped to
 * this project's source — never saw it, and the HarmonyOS bundle quietly kept
 * pulling React Native Firebase in through the entry point even after all 49
 * files in `src/` had been moved onto the seam.
 */
import {getApp, getApps, initializeApp} from '@react-native-firebase/app';
import {ReactNativeFirebaseAppCheckProvider, initializeAppCheck} from '@react-native-firebase/app-check';
import {firebaseConfig} from '../../firebaseConfig';

/**
 * Fixed rather than auto-generated debug tokens.
 *
 * Left auto-generated, the SDK mints a new random token on every fresh
 * install or data wipe, and each one has to be re-registered in Firebase
 * Console > App Check > Manage debug tokens before App Check-gated calls work
 * again — including plain email/password reauth, since changePassword and
 * account deletion both route through App Check. That breaks on every fresh
 * simulator with no error pointing back here. A fixed token is registered once
 * per platform, ever.
 */
const DEBUG_APP_CHECK_TOKEN_ANDROID = '6c53c9a1-98b6-432f-96b2-a37aaa69bc30';
const DEBUG_APP_CHECK_TOKEN_APPLE = '77904aef-75a2-4069-98a2-00c7bc76e80b';

/**
 * Initialises the default Firebase app and App Check. Safe to call more than
 * once; returns the app's name for logging.
 */
export function initFirebase(): string {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
  const app = getApp();

  // Attests that requests to Firestore/Storage/Functions come from this real,
  // unmodified build, blocking scripted abuse of the backend. Release builds
  // use Play Integrity (Android) / App Attest (iOS), which require enabling
  // App Check for this app in the Firebase Console first.
  const appCheckProvider = new ReactNativeFirebaseAppCheckProvider();
  appCheckProvider.configure({
    android: {
      provider: __DEV__ ? 'debug' : 'playIntegrity',
      debugToken: __DEV__ ? DEBUG_APP_CHECK_TOKEN_ANDROID : undefined,
    },
    apple: {
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      debugToken: __DEV__ ? DEBUG_APP_CHECK_TOKEN_APPLE : undefined,
    },
  });
  initializeAppCheck(app, {provider: appCheckProvider, isTokenAutoRefreshEnabled: true});

  return app.name;
}
