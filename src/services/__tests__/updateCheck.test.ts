/**
 * `up-to-date` and `error` must never be confused — a network failure that
 * silently reported "you're current" would be a false all-clear on the one
 * thing this feature exists to tell someone truthfully.
 */
import {checkForUpdate} from '../updateCheck';
import {ANDROID_VERSION_CODE} from '../../config/appVersion';

type Reply = {status: number; body?: unknown} | 'network-error';

let reply: Reply = {status: 200, body: {versionCode: 3, versionName: '1.2'}};
const realFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = (async () => {
    const current = reply;
    if (current === 'network-error') throw new TypeError('Network request failed');
    return {
      ok: current.status >= 200 && current.status < 300,
      status: current.status,
      json: async () => current.body,
    };
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('checkForUpdate', () => {
  it('reports up-to-date when the manifest version is not ahead', async () => {
    reply = {status: 200, body: {versionCode: ANDROID_VERSION_CODE, versionName: 'current'}};
    expect(await checkForUpdate()).toEqual({status: 'up-to-date'});
  });

  it('reports up-to-date when the manifest version is behind (never claims a downgrade)', async () => {
    reply = {status: 200, body: {versionCode: 1, versionName: '1.0'}};
    expect(await checkForUpdate()).toEqual({status: 'up-to-date'});
  });

  it('reports the new version name when the manifest is ahead', async () => {
    reply = {status: 200, body: {versionCode: ANDROID_VERSION_CODE + 1, versionName: 'next'}};
    expect(await checkForUpdate()).toEqual({status: 'update-available', versionName: 'next'});
  });

  it('is an error, not up-to-date, on a network failure', async () => {
    reply = 'network-error';
    expect(await checkForUpdate()).toEqual({status: 'error'});
  });

  it('is an error, not up-to-date, on a non-2xx status', async () => {
    reply = {status: 500};
    expect(await checkForUpdate()).toEqual({status: 'error'});
  });

  it('is an error, not up-to-date, on a malformed body', async () => {
    reply = {status: 200, body: {oops: true}};
    expect(await checkForUpdate()).toEqual({status: 'error'});
  });

  it('is an error, not up-to-date, on an unparseable body', async () => {
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      }) as unknown as Response) as unknown as typeof fetch;
    expect(await checkForUpdate()).toEqual({status: 'error'});
  });
});
