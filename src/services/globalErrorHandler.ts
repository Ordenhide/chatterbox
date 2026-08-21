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

  hermes.enablePromiseRejectionTracker({
    // Matches React Native's own setting: report every rejection that reaches
    // the end of a turn without a handler, not only those that never get one.
    allRejections: true,
    onUnhandled: (id, rejection) => {
      reportError(rejection, 'unhandled_rejection');

      // Installing a tracker replaces React Native's, so its redbox is gone
      // and this is the only thing left that will tell a developer anything.
      //
      // What it prints matters more than that it prints. React Native's own
      // handler wraps the rejection in a *new* Error created inside
      // promiseRejectionTrackingOptions.js, so the stack it shows is the
      // tracker's own frames -- which is why a permission-denied here read as
      // "ExceptionsManager.handleException" and named nothing in this codebase.
      // The rejection itself still carries the stack from where it was thrown,
      // so print that instead: it points at the actual failing call.
      if (__DEV__) {
        const stack = (rejection as {stack?: string} | null)?.stack;
        console.error(
          `Unhandled promise rejection (id: ${id}): ${String(
            (rejection as {message?: string} | null)?.message ?? rejection,
          )}`,
          stack ? `\n${stack}` : '(no stack on the rejected value)',
        );
      }
    },
    onHandled: id => {
      if (__DEV__) {
        console.warn(
          `Promise rejection handled late (id: ${id}) -- the earlier report for ` +
            'this id was premature and can be ignored.',
        );
      }
    },
  });
}

/** Test seam — lets a suite install into a fresh global. */
export function __resetGlobalErrorHandler(): void {
  installed = false;
}

