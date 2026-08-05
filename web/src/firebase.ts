import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import {getFunctions} from 'firebase/functions';

/**
 * Firebase config for the WEB SDK.
 *
 * These values mirror the mobile app's src/firebaseConfig.ts (same Firebase
 * project, so the web client shares the same users/chats/messages data). The
 * `appId` here is the mobile app's ID as a starting point — for a proper web
 * deployment you should register a **Web app** in the Firebase Console
 * (Project settings → Your apps → Add app → Web) and drop its config in via
 * the VITE_FIREBASE_* env vars (see web/.env.example). Auth + Firestore work
 * with the api key + auth domain + project id regardless; the web appId mainly
 * matters for Analytics.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAnDnGSww6_zdLEszsVM9tlpxZTDftBxi0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'chatterbox-e5d10.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'chatterbox-e5d10',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'chatterbox-e5d10.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '916000207469',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:916000207469:ios:5b98744019cfb032dd0564',
};

const app = initializeApp(firebaseConfig);

/**
 * App Check (matches the mobile app). Enabled only when a reCAPTCHA v3 site key
 * is provided via VITE_RECAPTCHA_V3_SITE_KEY — so if your Firebase project has
 * App Check *enforcement* on, register a web reCAPTCHA v3 provider in the
 * console and set that env var. Without it we skip App Check (works while
 * enforcement is in "monitor" mode). Set VITE_APPCHECK_DEBUG_TOKEN=true for
 * local development against an enforced project.
 */
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY;
if (recaptchaKey) {
  if (import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  }
  // Loaded lazily so the App Check SDK isn't in the initial bundle when unused.
  import('firebase/app-check')
    .then(({initializeAppCheck, ReCaptchaV3Provider}) => {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch(err => console.warn('App Check init failed:', err));
}

export {app};
export const auth = getAuth(app);

/**
 * Local-only escape hatch for exercising the phone-linking flow.
 *
 * Phone auth on the web needs a reCAPTCHA token. This project has no reCAPTCHA
 * Enterprise config for PHONE_PROVIDER, so the SDK falls back to reCAPTCHA v2
 * ("Failed to initialize reCAPTCHA Enterprise config" in the console) and the
 * backend rejects that token with auth/invalid-app-credential. That makes the
 * flow impossible to drive locally or from a test browser, which reCAPTCHA
 * treats as a bot and escalates to an image challenge.
 *
 * With this on, the SDK skips app verification, so the *fictional* numbers
 * registered under Authentication → Sign-in method → Phone → "Numbers for
 * testing" work end to end. It grants nothing for real numbers: the backend
 * still refuses to send an SMS to anything that isn't whitelisted.
 *
 * Double-gated on DEV **and** an explicit opt-in, and `import.meta.env.DEV` is
 * statically false in a production build, so this whole block is dropped at
 * build time and can never ship enabled.
 */
if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLE_APP_VERIFICATION === 'true') {
  auth.settings.appVerificationDisabledForTesting = true;
  console.warn(
    '[dev] appVerificationDisabledForTesting is ON — phone auth accepts only the ' +
      'test numbers configured in the Firebase console. Never set this outside local dev.',
  );
}
// No region override — matches the mobile client's getFunctions() default,
// which resolves to the functions' actual deployed region (us-central1).
export const functions = getFunctions(app);

/**
 * Firestore with **offline persistence** (IndexedDB): the app opens with cached
 * data when offline, and writes queue and sync on reconnect.
 * `persistentMultipleTabManager` keeps multiple open tabs consistent. Falls back
 * to the in-memory default where IndexedDB is unavailable (e.g. private mode).
 */
function makeDb(): Firestore {
  // `ignoreUndefinedProperties` makes writes silently drop `undefined` fields
  // instead of throwing — matching the mobile SDK, so optional fields left blank
  // (e.g. a countdown with no emoji, a track with no artist) save cleanly.
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()}),
      ignoreUndefinedProperties: true,
    });
  } catch (err) {
    console.warn('Firestore persistence unavailable, using memory cache:', err);
    try {
      return initializeFirestore(app, {ignoreUndefinedProperties: true});
    } catch {
      return getFirestore(app);
    }
  }
}

export const db = makeDb();
