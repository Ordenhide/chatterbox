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

  // ── Addresses that *wrap* an IPv4 address ────────────────────────────────
  //
  // The reason the implementation parses to bytes. Every one of these was
  // treated as an ordinary public address by prefix matching, because none of
  // them *starts* with anything recognisable — the private address is in the
  // middle. Two wrap the cloud metadata endpoint, where one successful read
  // returns a service-account token.
  test.each([
    ['64:ff9b::a9fe:a9fe', true], // NAT64 -> 169.254.169.254 (metadata)
    ['64:ff9b::7f00:1', true], // NAT64 -> 127.0.0.1
    ['64:ff9b:1::a9fe:a9fe', true], // local-use NAT64 -> metadata
    ['2002:a9fe:a9fe::', true], // 6to4 -> 169.254.169.254
    ['2002:7f00:1::', true], // 6to4 -> 127.0.0.1
    ['2002:c0a8:1::', true], // 6to4 -> 192.168.0.1
    ['::ffff:7f00:1', true], // IPv4-mapped loopback, hex form
    ['::ffff:a9fe:a9fe', true], // IPv4-mapped metadata, hex form
    ['::127.0.0.1', true], // IPv4-compatible (deprecated)
  ])('sees through IPv4 embedded in %s', (ip, expected) => {
    expect(isPrivateOrReservedIp(ip)).toBe(expected);
  });

  it('still allows a 6to4 address wrapping a public IPv4', () => {
    // 2002::/16 is not blanket-reserved — only what it wraps decides.
    // 2002:0808:0808:: wraps 8.8.8.8.
    expect(isPrivateOrReservedIp('2002:808:808::')).toBe(false);
  });

  test.each([
    ['fec0::1', true], // site-local, deprecated but routable on some hosts
    ['ff02::1', true], // multicast
    ['100::1', true], // discard-only
    ['2001:db8::1', true], // documentation
  ])('blocks reserved IPv6 %s', (ip, expected) => {
    expect(isPrivateOrReservedIp(ip)).toBe(expected);
  });

  test.each([
    ['198.18.0.1', true], // benchmarking
    ['198.19.255.255', true], // benchmarking, upper end
    ['192.0.0.1', true], // IETF protocol assignments
    ['192.88.99.1', true], // 6to4 relay anycast
    ['192.0.2.1', true], // documentation
    ['203.0.113.1', true], // documentation
    ['255.255.255.255', true], // broadcast
    ['240.0.0.1', true], // reserved
  ])('blocks reserved IPv4 %s', (ip, expected) => {
    expect(isPrivateOrReservedIp(ip)).toBe(expected);
  });

  test.each([
    ['198.17.255.255', false], // just below 198.18.0.0/15
    ['198.20.0.1', false], // just above 198.18.0.0/15
    ['192.0.1.1', false], // just outside 192.0.0.0/24
    ['100.128.0.1', false], // just above CGNAT
    ['100.63.255.255', false], // just below CGNAT
  ])('allows public IPv4 next to a reserved range: %s', (ip, expected) => {
    expect(isPrivateOrReservedIp(ip)).toBe(expected);
  });

  test.each([
    ['not-an-ip', true],
    ['', true],
    ['999.1.1.1', true],
    ['::gggg', true],
    ['1.2.3', true],
  ])('blocks anything it cannot parse: %s', (value, expected) => {
    // Asked before a request is made, so "I do not recognise this" must mean no.
    expect(isPrivateOrReservedIp(value)).toBe(expected);
  });
});
