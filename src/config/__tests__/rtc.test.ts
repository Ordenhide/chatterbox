const mockCall = jest.fn();

jest.mock('../../services/firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => (...args: unknown[]) => mockCall(...args),
}));

import {describeIceServers, getIceServers, STUN_SERVERS} from '../rtc';

beforeEach(() => {
  mockCall.mockReset();
});

describe('getIceServers', () => {
  it('returns the minted servers when TURN is configured', async () => {
    const iceServers = [
      {urls: ['stun:stun.cloudflare.com:3478']},
      {urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c'},
    ];
    mockCall.mockResolvedValue({data: {iceServers}});
    expect(await getIceServers()).toEqual(iceServers);
  });

  it('falls back to STUN only when the function rejects', async () => {
    mockCall.mockRejectedValue(new Error('failed-precondition'));
    expect(await getIceServers()).toEqual(STUN_SERVERS);
  });
});

describe('describeIceServers', () => {
  it('reports turn when the function returns a server list', async () => {
    mockCall.mockResolvedValue({
      data: {iceServers: [{urls: ['turn:turn.cloudflare.com:3478'], username: 'u', credential: 'c'}]},
    });
    expect((await describeIceServers()).status).toBe('turn');
  });

  it('reports stun-only when TURN is unconfigured (failed-precondition)', async () => {
    // The state the project is in until TURN is provisioned. It is
    // indistinguishable from a working setup right up until two people on
    // different mobile networks try to call each other, which is why it is
    // worth naming rather than inferring.
    mockCall.mockRejectedValue(Object.assign(new Error('TURN is not configured.'), {
      code: 'functions/failed-precondition',
    }));
    expect(await describeIceServers()).toEqual({servers: STUN_SERVERS, status: 'stun-only'});
  });

  it('reports stun-only on any other failure (network, auth) rather than throwing', async () => {
    // A call that connects over STUN may still fail across NATs; one that
    // throws here fails to start at all.
    mockCall.mockRejectedValue(new Error('network error'));
    expect(await describeIceServers()).toEqual({servers: STUN_SERVERS, status: 'stun-only'});
  });

  it('reports stun-only rather than turn on a malformed response', async () => {
    mockCall.mockResolvedValue({data: {iceServers: []}});
    expect(await describeIceServers()).toEqual({servers: STUN_SERVERS, status: 'stun-only'});
  });

  it('agrees with getIceServers, which is a thin wrapper over it', async () => {
    const iceServers = [{urls: ['turn:turn.cloudflare.com:3478'], username: 'u', credential: 'c'}];
    mockCall.mockResolvedValue({data: {iceServers}});
    expect(await getIceServers()).toEqual((await describeIceServers()).servers);
  });
});
