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

import {reportError, reportSealedFailure} from '../telemetry';

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

/**
 * The severity split. A decrypt failure reaches telemetry already diagnosed,
 * and the two diagnoses want opposite handling: 'wrong-key' is the protocol
 * doing its job on a device that does not hold the key — the UI has already
 * said so in words and offered the recovery phrase — while 'corrupt' means
 * the key was right and the ciphertext is damaged. Collapsing them was the
 * bug: the routine one filed a Crashlytics issue per user per second device,
 * and the one worth acting on arrived indistinguishable from the noise.
 */
describe('reportSealedFailure', () => {
  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('records an expected failure without raising it as an error', () => {
    reportSealedFailure(new Error('invalid tag'), 'wrong-key');

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('e2ee_decrypt_wrong_key'),
      expect.any(Error),
    );
  });

  it('treats "update your client" the same way — the user fixes it, not us', () => {
    reportSealedFailure(new Error('unsupported'), 'unsupported-algorithm');

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('raises a corrupt ciphertext as a real error, since the key was right', () => {
    const boom = new Error('invalid tag');

    reportSealedFailure(boom, 'corrupt');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('e2ee_decrypt_corrupt'), boom);
  });

  it('raises not-sealed too: openSealed and diagnoseSealed disagreeing is ours', () => {
    reportSealedFailure(new Error('?'), 'not-sealed');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('e2ee_decrypt_not_sealed'),
      expect.any(Error),
    );
  });
});
