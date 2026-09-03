/**
 * reportError is the only channel the app has for an error it caught and
 * handled, and `telemetryEnabled` is `!__DEV__` — so on a debug build
 * Crashlytics is not merely switched off, it is never constructed. Every
 * reported error therefore used to vanish without a trace on exactly the build
 * someone is using when they want to know why something failed; tracking one
 * down meant adding a temporary console.error and taking it out again.
 */
// Other suites reach for `jest.mock('../telemetry')` to dodge these ESM-only
// packages. This one is testing telemetry itself, so the firebase wrappers are
// stubbed instead. Nothing in them is called on this path — telemetryEnabled is
// `!__DEV__`, false under Jest — which is exactly the case under test.
jest.mock('../firebase/analytics', () => ({
  getAnalytics: () => null,
  logEvent: () => undefined,
  setUserId: () => undefined,
}));
jest.mock('../firebase/crashlytics', () => ({
  getCrashlytics: () => null,
  log: () => undefined,
  recordError: () => undefined,
  setUserId: () => undefined,
}));

import {reportError} from '../telemetry';

describe('reportError', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('surfaces the error and its context when telemetry is off', () => {
    const boom = new Error('kaboom');

    reportError(boom, 'file_upload_failed');

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('file_upload_failed'), boom);
  });

  it('still surfaces an error reported without a context', () => {
    const boom = new Error('kaboom');

    reportError(boom);

    expect(spy).toHaveBeenCalledWith(expect.any(String), boom);
  });

  // Callers pass `unknown`, and a rejected promise often carries a string or a
  // Firebase error object rather than an Error. Those must reach the console
  // intact rather than being flattened to "[object Object]".
  it('passes a non-Error through unchanged', () => {
    const rejection = {code: 'firestore/permission-denied'};

    reportError(rejection, 'setTyping');

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('setTyping'), rejection);
  });
});
