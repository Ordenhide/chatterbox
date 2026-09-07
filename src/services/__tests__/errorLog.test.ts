/**
 * reportError is the only channel the app has for an error it caught and
 * handled, and since Crashlytics was removed it is the only one there is:
 * nothing goes anywhere off the device. What it must still do is surface the
 * error in development, because otherwise a reported error vanishes without a
 * trace on exactly the build someone is using when they want to know why
 * something failed.
 *
 * No firebase stubs here any more. There is nothing left to stub.
 */
import {reportError, reportSealedFailure} from '../errorLog';

describe('reportError', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('surfaces the error and its context', () => {
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
 * The severity split. A decrypt failure arrives here already diagnosed,
 * and the two diagnoses want opposite handling: 'wrong-key' is the protocol
 * doing its job on a device that does not hold the key — the UI has already
 * said so in words and offered the recovery phrase — while 'corrupt' means
 * the key was right and the ciphertext is damaged. Collapsing them was the
 * bug: the routine one drowned out the one worth acting on, which arrived
 * indistinguishable from the noise.
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
