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
 * Debug App Check tokens are not written down here.
 *
 * Two fixed ones used to be, for a real convenience: left auto-generated, the
 * SDK mints a new token on every fresh install or data wipe, and each one has
 * to be registered in Firebase Console > App Check > Manage debug tokens
 * before App Check-gated calls work again — including plain email/password
 * reauth, since changePassword and account deletion both route through it.
 *
 * The cost was worse than the annoyance. A registered debug token bypasses App
 * Check completely: anyone holding the string can attest as this app and call
 * the production backend from a script. Writing it in the source made the
 * control that is supposed to stop scripted abuse only as strong as the repo,
 * and it stayed true for every developer, every fork, and every future day the
 * repo is opened up.
 *
 * So the provider auto-generates. On a fresh install, look for
 * "Enter this debug secret into the allow list" in the native log, register
 * that token, and delete it again when you are done with that simulator.

/**
 * Initialises the default Firebase app and App Check. Returns the app's name
 * for logging.
 *
 * Genuinely safe to call more than once, which it previously was not: the
 * `getApps().length` check below only makes the *app* idempotent, while
 * initializeAppCheck would run again. That did not matter while App.tsx's
 * effect was the only caller. It does now that
 * index.js calls this at module scope to get the native SDK warming before
 * React renders, and App.tsx still calls it for its own error path.
 */
let initializedName: string | null = null;

export function initFirebase(): string {
  if (initializedName) return initializedName;

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
    },
    apple: {
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
    },
  });
  initializeAppCheck(app, {provider: appCheckProvider, isTokenAutoRefreshEnabled: true});

  initializedName = app.name;
  return app.name;
}
