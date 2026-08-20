/**
 * Auth for HarmonyOS, via the pure-JS Firebase SDK. See ./README.md.
 *
 * Same modular surface as React Native Firebase — signInWithEmailAndPassword,
 * onAuthStateChanged, EmailAuthProvider and so on — so no call site changes.
 */
import * as firebaseAuth from 'firebase/auth';
import {getAuth as getAuthJS, initializeAuth, type Auth, type Persistence} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {app} from './app.harmony';

export * from 'firebase/auth';

/**
 * Sessions have to be told where to live.
 *
 * React Native Firebase persists the session natively, so signing in once
 * survives a restart with no configuration. The JS SDK defaults to
 * `browserLocalPersistence` (localStorage), which does not exist here — the
 * session would then live only in memory and every cold start would land on
 * the sign-in screen.
 *
 * `getReactNativePersistence` is the SDK's own answer, but it is reachable
 * only through the package's `react-native` export condition
 * (@firebase/auth's dist/rn build). Metro selects that condition; Node and
 * TypeScript select the default one, where the symbol does not exist — so it
 * cannot be imported by name without breaking `tsc`, and is looked up off the
 * namespace instead.
 *
 * UNVERIFIED: whether RNOH's resolver preserves the `react-native` condition
 * for `platform=harmony` has not been confirmed on device. If it does not,
 * `factory` is undefined, the guard below drops to in-memory persistence, and
 * the visible symptom is having to sign in again after every app restart —
 * degraded, not broken.
 */
type PersistenceFactory = (storage: unknown) => Persistence;
const factory = (firebaseAuth as unknown as {getReactNativePersistence?: PersistenceFactory})
  .getReactNativePersistence;

let auth: Auth;
try {
  auth = initializeAuth(app, factory ? {persistence: factory(AsyncStorage)} : undefined);
} catch {
  // initializeAuth throws if auth was already initialised for this app, which
  // happens across a fast-refresh cycle. Adopt the existing instance.
  auth = getAuthJS(app);
}

/** Shadows the re-export so callers get the persistence-configured instance. */
export function getAuth(_app?: unknown): Auth {
  return auth;
}

export type {Auth};
