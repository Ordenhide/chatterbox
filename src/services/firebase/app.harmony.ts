/**
 * Firebase app initialisation for HarmonyOS. See ./README.md.
 *
 * On iOS and Android, React Native Firebase initialises the default app from
 * the native config files (GoogleService-Info.plist / google-services.json)
 * before any JavaScript runs, so nothing in `src/` ever calls `initializeApp`.
 * HarmonyOS has no native Firebase SDK and therefore no such bootstrap — the
 * JS SDK has to be told the project's identity explicitly, from the same
 * config the rest of the app already carries.
 *
 * Every other *.harmony.ts module in this directory imports `app` from here, so
 * initialisation happens exactly once regardless of which service is touched
 * first.
 */
import {getApp, getApps, initializeApp, type FirebaseApp} from 'firebase/app';
import {firebaseConfig} from '../../firebaseConfig';

/**
 * `authDomain` is absent from src/firebaseConfig.ts because the native SDKs
 * never needed it — they read it from the plist/json. The JS SDK does need it
 * to complete auth redirects, and it is derivable from the project id, which is
 * how the Firebase console generates it in the first place.
 */
const harmonyConfig = {
  ...firebaseConfig,
  authDomain: `${firebaseConfig.projectId}.firebaseapp.com`,
};

// getApps().length rather than a module-scope boolean: Metro can evaluate a
// module more than once across a fast-refresh cycle, and initializeApp throws
// on a duplicate default app.
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(harmonyConfig);
