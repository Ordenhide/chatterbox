const mockReportError = jest.fn();
jest.mock('../telemetry', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

import {__resetGlobalErrorHandler, installGlobalErrorHandler} from '../globalErrorHandler';

type Handler = (error: unknown, isFatal?: boolean) => void;

const globalAny = global as unknown as Record<string, unknown>;
let originalErrorUtils: unknown;
let originalAddEventListener: unknown;
let originalHermes: unknown;

beforeEach(() => {
  mockReportError.mockReset();
  __resetGlobalErrorHandler();
  originalErrorUtils = globalAny.ErrorUtils;
  originalAddEventListener = globalAny.addEventListener;
  originalHermes = globalAny.HermesInternal;
});

afterEach(() => {
  globalAny.ErrorUtils = originalErrorUtils;
  globalAny.addEventListener = originalAddEventListener;
  globalAny.HermesInternal = originalHermes;
});

/** Stands in for React Native's ErrorUtils, recording what gets installed. */
function fakeErrorUtils() {
  let current: Handler | undefined = jest.fn();
  const first = current;
  return {
    utils: {
      getGlobalHandler: () => current,
      setGlobalHandler: (h: Handler) => {
        current = h;
      },
    },
    /** The handler in place after install. */
    installed: () => current,
    /** The handler that was there before — must still be called through. */
    previous: first as jest.Mock,
  };
}

describe('uncaught JS errors', () => {
  it('reports and still calls the previous handler, so the redbox survives', () => {
    const fake = fakeErrorUtils();
    globalAny.ErrorUtils = fake.utils;

    installGlobalErrorHandler();
    const boom = new Error('boom');
    fake.installed()?.(boom, false);

    expect(mockReportError).toHaveBeenCalledWith(boom, 'uncaught_error');
    expect(fake.previous).toHaveBeenCalledWith(boom, false);
  });

  it('distinguishes fatals, which read differently in Crashlytics', () => {
    const fake = fakeErrorUtils();
    globalAny.ErrorUtils = fake.utils;

    installGlobalErrorHandler();
    fake.installed()?.(new Error('dead'), true);

    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), 'uncaught_fatal');
  });
});

describe('unhandled promise rejections', () => {
  // The whole point of the rewrite: React Native has no DOM, so
  // global.addEventListener('unhandledrejection') registers and never fires.
  // Hermes' callback tracker is the only real hook.
  function fakeHermes() {
    let options: any;
    return {
      hermes: {enablePromiseRejectionTracker: (o: any) => {options = o;}},
      options: () => options,
    };
  }

  it('registers through Hermes, not through a DOM event', () => {
    const fake = fakeHermes();
    globalAny.HermesInternal = fake.hermes;
    globalAny.ErrorUtils = undefined;
    const addEventListener = jest.fn();
    globalAny.addEventListener = addEventListener;

    installGlobalErrorHandler();

    expect(fake.options()).toBeDefined();
    expect(fake.options().allRejections).toBe(true);
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('reports the rejection reason', () => {
    const fake = fakeHermes();
    globalAny.HermesInternal = fake.hermes;
    globalAny.ErrorUtils = undefined;

    installGlobalErrorHandler();
    const reason = new Error('[firestore/permission-denied] denied');
    fake.options().onUnhandled(7, reason);

    expect(mockReportError).toHaveBeenCalledWith(reason, 'unhandled_rejection');
  });

  // The bug this replaced: React Native wraps the rejection in a *new* Error
  // inside its own tracker, so the printed stack was the tracker's frames and
  // named nothing in this codebase. The rejection's own stack is the useful one.
  it('prints the rejection\'s own stack, not the tracker\'s', () => {
    const fake = fakeHermes();
    globalAny.HermesInternal = fake.hermes;
    globalAny.ErrorUtils = undefined;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    installGlobalErrorHandler();
    const reason = new Error('[firestore/permission-denied] denied');
    reason.stack = 'Error: denied\n    at listenChatsForUser (firebaseChat.ts:301:9)';
    fake.options().onUnhandled(3, reason);

    const printed = spy.mock.calls[0].join(' ');
    expect(printed).toContain('listenChatsForUser');
    expect(printed).not.toContain('promiseRejectionTrackingOptions');
    spy.mockRestore();
  });

  it('says so explicitly when the rejected value carries no stack', () => {
    const fake = fakeHermes();
    globalAny.HermesInternal = fake.hermes;
    globalAny.ErrorUtils = undefined;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    installGlobalErrorHandler();
    fake.options().onUnhandled(4, 'a bare string');

    expect(spy.mock.calls[0].join(' ')).toContain('no stack');
    spy.mockRestore();
  });

  it('does nothing when Hermes has no tracker rather than throwing', () => {
    globalAny.HermesInternal = {};
    globalAny.ErrorUtils = undefined;
    expect(() => installGlobalErrorHandler()).not.toThrow();
  });
});

describe('installation', () => {
  // Installing twice would chain the handler onto itself and double-report
  // every error, which is worse than not reporting: it inflates counts.
  it('is idempotent', () => {
    const fake = fakeErrorUtils();
    globalAny.ErrorUtils = fake.utils;

    installGlobalErrorHandler();
    const afterFirst = fake.installed();
    installGlobalErrorHandler();

    expect(fake.installed()).toBe(afterFirst);

    fake.installed()?.(new Error('once'), false);
    expect(mockReportError).toHaveBeenCalledTimes(1);
  });

  it('survives a platform with neither hook rather than throwing', () => {
    globalAny.ErrorUtils = undefined;
    globalAny.addEventListener = undefined;
    expect(() => installGlobalErrorHandler()).not.toThrow();
  });
});
