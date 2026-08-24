import {describeIceServers, getIceServers, STUN_SERVERS} from '../rtc';
import {getStringFlag} from '../../services/featureFlags';

jest.mock('../../services/featureFlags', () => ({
  getStringFlag: jest.fn(),
}));

const mockFlags = getStringFlag as jest.MockedFunction<typeof getStringFlag>;

/** Answers the three turn_* keys from a map, empty for anything unset. */
function withFlags(values: Record<string, string>) {
  mockFlags.mockImplementation(async (key: string) => values[key] ?? '');
}

beforeEach(() => {
  mockFlags.mockReset();
});

describe('getIceServers', () => {
  it('falls back to STUN only when no TURN server is configured', async () => {
    withFlags({});
    expect(await getIceServers()).toEqual(STUN_SERVERS);
  });

  it('appends a configured TURN server after the STUN entries', async () => {
    withFlags({
      turn_url: 'turn:relay.example.com:3478',
      turn_username: 'user',
      turn_credential: 'secret',
    });
    const servers = await getIceServers();
    // STUN stays first: it is cheaper and should be tried before a relay.
    expect(servers[0]).toEqual(STUN_SERVERS[0]);
    expect(servers[servers.length - 1]).toEqual({
      urls: ['turn:relay.example.com:3478'],
      username: 'user',
      credential: 'secret',
    });
  });

  it('splits a comma-separated url list and trims it', async () => {
    withFlags({
      turn_url: 'turn:a.example.com:3478?transport=udp , turns:b.example.com:5349?transport=tcp',
      turn_username: 'user',
      turn_credential: 'secret',
    });
    const [, turn] = await getIceServers();
    expect(turn.urls).toEqual([
      'turn:a.example.com:3478?transport=udp',
      'turns:b.example.com:5349?transport=tcp',
    ]);
  });

  it('omits credentials entirely rather than sending blank ones', async () => {
    // A TURN server rejects empty credentials, so an entry carrying them
    // would always fail auth — worse than no entry at all.
    withFlags({turn_url: 'turn:relay.example.com:3478'});
    const [, turn] = await getIceServers();
    expect(turn).toEqual({urls: ['turn:relay.example.com:3478']});
    expect(turn).not.toHaveProperty('username');
    expect(turn).not.toHaveProperty('credential');
  });

  it('ignores a url that is only whitespace or commas', async () => {
    withFlags({turn_url: ' , , '});
    expect(await getIceServers()).toEqual(STUN_SERVERS);
  });

  it('falls back to STUN rather than rejecting when the flag lookup fails', async () => {
    // A call that connects over STUN may still fail across NATs; one that
    // throws here fails to start at all.
    mockFlags.mockRejectedValue(new Error('remote config unavailable'));
    expect(await getIceServers()).toEqual(STUN_SERVERS);
  });
});

describe('describeIceServers', () => {
  it('reports stun-only when nothing is configured', async () => {
    // The state the project is in until TURN is provisioned. It is
    // indistinguishable from a working setup right up until two people on
    // different mobile networks try to call each other, which is why it is
    // worth naming rather than inferring.
    withFlags({});
    expect(await describeIceServers()).toEqual({servers: STUN_SERVERS, status: 'stun-only'});
  });

  it('reports turn when a server and credentials are configured', async () => {
    withFlags({
      turn_url: 'turn:relay.example.com:3478',
      turn_username: 'user',
      turn_credential: 'secret',
    });
    expect((await describeIceServers()).status).toBe('turn');
  });

  it('distinguishes a TURN url with no credentials from a working one', async () => {
    // Almost always a half-finished setup rather than a deliberate choice:
    // the url was pasted in and the credentials never were. Reported as its
    // own state so it does not read as success.
    withFlags({turn_url: 'turn:relay.example.com:3478'});
    expect((await describeIceServers()).status).toBe('turn-anonymous');
  });

  it('treats a username without a credential as anonymous, not authenticated', async () => {
    withFlags({turn_url: 'turn:relay.example.com:3478', turn_username: 'user'});
    const described = await describeIceServers();
    expect(described.status).toBe('turn-anonymous');
    expect(described.servers[1]).not.toHaveProperty('username');
  });

  it('reports stun-only when the flag lookup fails', async () => {
    mockFlags.mockRejectedValue(new Error('remote config unavailable'));
    expect((await describeIceServers()).status).toBe('stun-only');
  });

  it('agrees with getIceServers, which is a thin wrapper over it', async () => {
    withFlags({
      turn_url: 'turn:relay.example.com:3478',
      turn_username: 'user',
      turn_credential: 'secret',
    });
    expect(await getIceServers()).toEqual((await describeIceServers()).servers);
  });
});
