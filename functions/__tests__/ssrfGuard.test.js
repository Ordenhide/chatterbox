const {isPrivateOrReservedIp} = require('../ssrfGuard');

describe('isPrivateOrReservedIp', () => {
  test.each([
    ['169.254.169.254', true], // cloud metadata endpoint
    ['127.0.0.1', true],
    ['10.0.0.5', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.1.1', true],
    ['100.64.0.1', true], // CGNAT
    ['0.0.0.0', true],
    ['224.0.0.1', true], // multicast
  ])('blocks private/reserved IPv4 %s', (ip, expected) => {
    expect(isPrivateOrReservedIp(ip)).toBe(expected);
  });

  test.each([
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['172.15.0.1', false], // just outside 172.16.0.0/12
    ['172.32.0.1', false], // just outside 172.16.0.0/12
    ['93.184.216.34', false],
  ])('allows public IPv4 %s', (ip, expected) => {
    expect(isPrivateOrReservedIp(ip)).toBe(expected);
  });

  test.each([
    ['::1', true], // loopback
    ['fe80::1', true], // link-local
    ['fc00::1', true], // unique-local
    ['fd12:3456:789a::1', true], // unique-local
    ['::ffff:127.0.0.1', true], // IPv4-mapped loopback
    ['::ffff:169.254.169.254', true], // IPv4-mapped metadata
  ])('blocks private/reserved IPv6 %s', (ip, expected) => {
    expect(isPrivateOrReservedIp(ip)).toBe(expected);
  });

  test.each([
    ['2606:4700:4700::1111', false], // public (Cloudflare)
    ['::ffff:8.8.8.8', false], // IPv4-mapped public
  ])('allows public IPv6 %s', (ip, expected) => {
    expect(isPrivateOrReservedIp(ip)).toBe(expected);
  });

  test('blocks unresolvable/unknown input', () => {
    expect(isPrivateOrReservedIp('not-an-ip')).toBe(true);
  });
});
