/**
 * Callable Cloud Functions for HarmonyOS, via the pure-JS Firebase SDK.
 *
 * `getFunctions` / `httpsCallable` are the only two symbols the app uses, and
 * both have identical signatures in the JS SDK — callables are plain HTTPS
 * requests, so there is nothing platform-specific to bridge.
 */
import {getFunctions as getFunctionsJS, type Functions} from 'firebase/functions';
import {app} from './app.harmony';

export * from 'firebase/functions';

export function getFunctions(_app?: unknown, regionOrCustomDomain?: string): Functions {
  return getFunctionsJS(app, regionOrCustomDomain);
}
