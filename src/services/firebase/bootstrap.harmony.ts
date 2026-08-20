/**
 * App initialisation for HarmonyOS. See ./README.md.
 *
 * Initialisation itself already happened: importing `./app` constructs the
 * default FirebaseApp from src/firebaseConfig.ts, and every other
 * *.harmony.ts module in this directory imports it. This function exists to
 * give App.tsx one shape to call on all platforms.
 *
 * App Check is **not** implemented, and cannot be. It works by asking the
 * platform to attest that requests come from a genuine, unmodified build —
 * Play Integrity on Android, App Attest on Apple. Both are OS-level services
 * with no HarmonyOS counterpart, and the JS SDK's web providers (reCAPTCHA)
 * need a DOM.
 *
 * The consequence is worth stating: a HarmonyOS build's requests carry no
 * attestation. If App Check is ever set to *enforce* on Firestore, Storage or
 * Functions, this build stops working entirely rather than degrading — so
 * enabling enforcement and shipping on HarmonyOS are mutually exclusive until
 * Huawei's own integrity API is wired into a custom App Check provider.
 */
import {app} from './app.harmony';

export function initFirebase(): string {
  return app.name;
}
