import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import {connectFunctionsEmulator, getFunctions} from 'firebase/functions';

/**
 * Firebase config for the WEB SDK.
 *
 * These values mirror the mobile app's src/firebaseConfig.ts (same Firebase
 * project, so the web client shares the same users/chats/messages data). The
 * `appId` here is the mobile app's ID as a starting point — for a proper web
 * deployment you should register a **Web app** in the Firebase Console
 * (Project settings → Your apps → Add app → Web) and drop its config in via
 * the VITE_FIREBASE_* env vars (see web/.env.example). Auth + Firestore work
 * with the api key + auth domain + project id regardless. (This client never
 * initialises Analytics — nothing here does; see src/services/errorLog.ts.)
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

// No region override — matches the mobile client's getFunctions() default,
// which resolves to the functions' actual deployed region (us-central1).
export const functions = getFunctions(app);

/**
 * Local-only escape hatch for testing Cloud Functions against
 * `firebase emulators:start` instead of the real deployed backend.
 *
 * Auth stays real/production even with this on: only Functions and Firestore
 * point locally (the Firestore half is wired below, once `db` exists). That
 * means sign-in works normally with a real account, but that account's
 * chats/profile/moments will look empty here — the local Firestore emulator
 * starts with no data of its own. Fine for exercising a function end to end,
 * not for testing against real chat data.
 *
 * Double-gated on DEV **and** an explicit opt-in, and `import.meta.env.DEV`
 * is statically false in a production build, so this whole block is dropped
 * at build time and can never ship enabled.
 */
const USE_EMULATORS = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
if (USE_EMULATORS) {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

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

// Must connect before the app's first Firestore read/write. Safe here: every
// other module imports `db` from this file rather than calling makeDb()
// itself, and ES module evaluation order guarantees this line runs to
// completion before any importer can act on the value.
if (USE_EMULATORS) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.warn(
    '[dev] Connected to local Firebase emulators (Functions :5001, Firestore :8080). ' +
      'Auth is still real/production, so this account’s chats/profile will look empty here.',
  );
}
