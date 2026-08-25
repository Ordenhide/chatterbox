const net = require('net');

/**
 * Whether an IP is anything other than an ordinary public internet address.
 *
 * Used by the link-preview fetch (index.js, safeFetchUrl) to stop a
 * user-supplied URL reaching internal infrastructure. The address that matters
 * most is 169.254.169.254: on GCP that is the instance metadata server, and a
 * single successful read from it returns a service-account access token. There
 * is no partial version of that failure — it is the whole project.
 *
 * ## Why this parses to bytes instead of matching prefixes
 *
 * The previous version compared string prefixes, which is correct for the
 * addresses people actually think of as private and silently wrong for the
 * ones that *contain* them. `2002:a9fe:a9fe::` is a 6to4 address wrapping
 * 169.254.169.254, and `64:ff9b::a9fe:a9fe` is the NAT64 form of the same
 * thing; neither starts with anything the old checks looked for, so both were
 * treated as ordinary public addresses. So were 198.18.0.0/15 and 192.0.0.0/24.
 *
 * Whether those were *reachable* is a separate question, and honestly: on Cloud
 * Functions they very likely were not, because NAT64 and 6to4 have to be routed
 * by the host network and generally are not. That is an argument for calling
 * this defence in depth rather than a fixed exploit — but not for leaving it,
 * since the cost of the check is a few microseconds and the cost of being wrong
 * about the routing is the entire project.
 *
 * Parsing to bytes also removes a whole category of near-misses: `fec0::/10`
 * needed four separate string prefixes to cover, and `::ffff:7f00:1` is the
 * same address as `::ffff:127.0.0.1` written differently.
 *
 * Unparseable input returns true. This is asked before a request is made, so
 * "I do not recognise this" has to mean no.
 */

/** Bytes of an IPv4 address, or null. */
function parseIPv4(ip) {
  if (net.isIP(ip) !== 4) return null;
  return ip.split('.').map(Number);
}

/**
 * Bytes of an IPv6 address, or null.
 *
 * Written out rather than taken from a library because the embedded-IPv4
 * forms are exactly what this guard exists to see through, and a parser that
 * quietly mishandles them would reintroduce the bug it is here to fix.
 */
function parseIPv6(ip) {
  if (net.isIP(ip) !== 6) return null;

  let text = ip;
  // A trailing dotted quad (::ffff:127.0.0.1) is two more 16-bit groups.
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const quad = parseIPv4(tail);
    if (!quad) return null;
    const hi = ((quad[0] << 8) | quad[1]).toString(16);
    const lo = ((quad[2] << 8) | quad[3]).toString(16);
    text = `${text.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];

  const groups =
    halves.length === 2
      ? [...head, ...Array(8 - head.length - rest.length).fill('0'), ...rest]
      : head;
  if (groups.length !== 8) return null;

  const bytes = [];
  for (const group of groups) {
    const value = parseInt(group, 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff) return null;
    bytes.push(value >> 8, value & 0xff);
  }
  return bytes;
}

/** True when `bytes` starts with `prefix`, matching `bits` of it. */
function inRange(bytes, prefix, bits) {
  const wholeBytes = bits >> 3;
  for (let i = 0; i < wholeBytes; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  const remaining = bits & 7;
  if (remaining === 0) return true;
  const mask = 0xff << (8 - remaining) & 0xff;
  return (bytes[wholeBytes] & mask) === (prefix[wholeBytes] & mask);
}

/** Every IPv4 range that is not an ordinary public address. */
const RESERVED_V4 = [
  [[0, 0, 0, 0], 8], // "this network"
  [[10, 0, 0, 0], 8], // private
  [[100, 64, 0, 0], 10], // CGNAT
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link-local, incl. cloud metadata
  [[172, 16, 0, 0], 12], // private
  [[192, 0, 0, 0], 24], // IETF protocol assignments
  [[192, 0, 2, 0], 24], // documentation
  [[192, 88, 99, 0], 24], // 6to4 relay anycast
  [[192, 168, 0, 0], 16], // private
  [[198, 18, 0, 0], 15], // benchmarking
  [[198, 51, 100, 0], 24], // documentation
  [[203, 0, 113, 0], 24], // documentation
  [[224, 0, 0, 0], 4], // multicast
  [[240, 0, 0, 0], 4], // reserved, incl. 255.255.255.255
];

function v6(...groups) {
  const bytes = [];
  for (let i = 0; i < 8; i++) {
    const value = groups[i] || 0;
    bytes.push(value >> 8, value & 0xff);
  }
  return bytes;
}

/** IPv6 ranges that are non-public in their own right. */
const RESERVED_V6 = [
  [v6(0, 0, 0, 0, 0, 0, 0, 0), 128], // unspecified
  [v6(0, 0, 0, 0, 0, 0, 0, 1), 128], // loopback
  [v6(0x100), 64], // discard-only
  [v6(0x2001, 0x0db8), 32], // documentation
  [v6(0xfc00), 7], // unique-local
  [v6(0xfe80), 10], // link-local
  [v6(0xfec0), 10], // site-local (deprecated, still routable on some hosts)
  [v6(0xff00), 8], // multicast
];

/**
 * IPv6 ranges that *wrap* an IPv4 address, with where the embedded address
 * starts. These are the ones prefix matching misses: the wrapper looks public
 * while the address inside it is not.
 */
const EMBEDS_V4 = [
  [v6(0, 0, 0, 0, 0, 0xffff), 96, 12], // IPv4-mapped
  [v6(0, 0, 0, 0, 0, 0, 0, 0), 96, 12], // IPv4-compatible (deprecated)
  [v6(0x64, 0xff9b), 96, 12], // NAT64
  [v6(0x64, 0xff9b, 1), 48, 12], // local-use NAT64
  [v6(0x2002), 16, 2], // 6to4
];

function isPrivateOrReservedIp(ip) {
  const v4 = parseIPv4(ip);
  if (v4) {
    return RESERVED_V4.some(([prefix, bits]) => inRange(v4, prefix, bits));
  }

  const bytes = parseIPv6(ip);
  if (!bytes) return true; // unparseable or unknown family -> block

  for (const [prefix, bits, offset] of EMBEDS_V4) {
    if (!inRange(bytes, prefix, bits)) continue;
    const embedded = bytes.slice(offset, offset + 4).join('.');
    // ::/96 also matches ::1 and ::, which the reserved list handles; an
    // embedded 0.0.0.1 is caught by 0.0.0.0/8 regardless.
    return isPrivateOrReservedIp(embedded);
  }

  return RESERVED_V6.some(([prefix, bits]) => inRange(bytes, prefix, bits));
}

module.exports = {isPrivateOrReservedIp};
