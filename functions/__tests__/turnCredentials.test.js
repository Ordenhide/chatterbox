const {extractIceServers} = require('../turnCredentials');

describe('extractIceServers', () => {
  test('returns the iceServers array from a valid response', () => {
    const iceServers = [
      {urls: ['stun:stun.cloudflare.com:3478']},
      {urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c'},
    ];
    expect(extractIceServers({iceServers})).toBe(iceServers);
  });

  test.each([
    [undefined],
    [null],
    [{}],
    [{iceServers: null}],
    [{iceServers: 'not-an-array'}],
    [{iceServers: []}],
  ])('throws on a malformed response %p', response => {
    expect(() => extractIceServers(response)).toThrow(/iceServers/);
  });
});
