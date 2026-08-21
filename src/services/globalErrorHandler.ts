import {reportError} from './telemetry';

/**
 * Catches the two classes of failure that otherwise leave no trace.
 *
 * Everything in this app that *expects* to fail already handles it — see
 * snapshotGuard for listeners, and the try/catch around every session write in
 * AuthContext. What was missing is the floor underneath all of that: a JS error
 * thrown outside any handler, and a promise nobody attached a `.catch` to.
 *
 * The promise half is the one that matters, and React Native's handling of it
 * is easy to get wrong in two specific ways:
 *
 *  1. There is no `global.addEventListener('unhandledrejection', ...)`. That is
 *     a DOM API; React Native has no DOM, so registering it appears to work and
 *     silently never fires. Hermes exposes a callback-based tracker instead —
 *     `HermesInternal.enablePromiseRejectionTracker` — and that is the only
 *     hook there is.
 *
 *  2. React Native only enables that tracker under `__DEV__` (see
 *     Libraries/Core/polyfillPromise.js). So in a release build there is *no*
 *     rejection tracking at all: an unhandled rejection is completely silent,
 *     and a `permission-denied` from a Firestore call nobody caught looks
 *     from the outside exactly like a feature that quietly stopped working.
 *
 * Installing our own tracker replaces whatever is there, which is why the dev
 * path delegates back to React Native's options: without that, enabling
 * reporting would cost the redbox, trading one blind spot for another.
 */

/** Set once. Re-installing would chain onto our own handler and double-report. */
let installed = false;

type RejectionOptions = {
  allRejections?: boolean;
  onUnhandled?: (id: number, rejection: unknown) => void;
  onHandled?: (id: number) => void;
};

type ErrorUtilsShape = {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

type HermesShape = {
  enablePromiseRejectionTracker?: (options: RejectionOptions) => void;
};

/**
 * React Native's own tracker options, or undefined if unavailable.
 *
 * Reaching into `react-native/Libraries/...` is reaching into internals, hence
 * the try/catch: if a future version moves or renames this, the delegation
 * quietly stops and reporting carries on, rather than the whole handler
 * throwing during startup.
 */
function reactNativeRejectionOptions(): RejectionOptions | undefined {
  try {
    // Deep import with no top-level equivalent: React Native does not
    // re-export its rejection-tracking options, and this is the only way to
    // hand the redbox back its behaviour after our tracker replaces it. The
    // lint rule is right in general, which is why the require is isolated to
    // this one function and guarded.
    // eslint-disable-next-line @react-native/no-deep-imports
    const mod = require('react-native/Libraries/promiseRejectionTrackingOptions');
    return (mod?.default ?? mod) as RejectionOptions;
  } catch {
    return undefined;
  }
}

export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;

  // --- Uncaught JS errors -------------------------------------------------
  //
  // ErrorUtils is a React Native global with no type declaration. The previous
  // handler is called through afterwards rather than replaced, because it is
  // what renders the redbox in dev and triggers the native crash reporter for
  // fatals — dropping it would trade a silent failure for a different one.
  const errorUtils: ErrorUtilsShape | undefined = (global as {ErrorUtils?: ErrorUtilsShape})
    .ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      reportError(error, isFatal ? 'uncaught_fatal' : 'uncaught_error');
      previous?.(error, isFatal);
    });
  }

  // --- Unhandled promise rejections ---------------------------------------
  const hermes: HermesShape | undefined = (global as {HermesInternal?: HermesShape})
    .HermesInternal;
  if (!hermes?.enablePromiseRejectionTracker) return;

  // Only present in dev — see the note above. Undefined in release, where our
  // handler is the only one and there is nothing to delegate to.
  const rnOptions = __DEV__ ? reactNativeRejectionOptions() : undefined;

  hermes.enablePromiseRejectionTracker({
    // Matches React Native's own setting: report every rejection that reaches
    // the end of a turn without a handler, not only those that never get one.
    allRejections: true,
    onUnhandled: (id, rejection) => {
      reportError(rejection, 'unhandled_rejection');
      if (rnOptions?.onUnhandled) {
        // Restores the redbox, which our tracker just displaced.
        rnOptions.onUnhandled(id, rejection);
      } else if (__DEV__) {
        // Delegation unavailable (internals moved): say so loudly rather than
        // leaving a developer with a rejection and no visible sign of it.
        console.warn(`Unhandled promise rejection (id: ${id})`, rejection);
      }
    },
    onHandled: id => {
      rnOptions?.onHandled?.(id);
    },
  });
}

/** Test seam — lets a suite install into a fresh global. */
export function __resetGlobalErrorHandler(): void {
  installed = false;
}
