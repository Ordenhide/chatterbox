// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockKeypair = jest.fn();
const mockPeerKey = jest.fn();

jest.mock('../e2eeKeys', () => ({
  getOrCreateDeviceKeypair: (...a: unknown[]) => mockKeypair(...a),
  getDeviceKeypairIfEnrolled: (...a: unknown[]) => mockKeypair(...a),
  fetchPeerPublicKeyChecked: (...a: unknown[]) => mockPeerKey(...a),
}));

import {generateKeypair} from '../e2ee';
import {INERT_ARTIFACT_CRYPTO, makeArtifactCrypto} from '../e2eeArtifacts';
import {
  buildLinkPreviewPatch,
  extractFirstUrl,
  hasPreviewContent,
  isSafeToFetchDirectly,
  normalizePreview,
  parsePreview,
  serializePreview,
  type LinkPreviewData,
} from '../linkPreview';

const CHAT = 'chat1';
const alice = generateKeypair();
const bob = generateKeypair();

const PREVIEW: LinkPreviewData = {
  url: 'https://example.com/article',
  title: 'A very identifying headline',
  description: 'About something personal',
  image: 'https://example.com/cover.png',
};

beforeEach(() => {
  mockKeypair.mockReset().mockResolvedValue(alice);
  mockPeerKey.mockReset().mockResolvedValue({key: bob.publicKey, status: 'ok'});
});

describe('extractFirstUrl', () => {
  it('finds a link inside a sentence', () => {
    expect(extractFirstUrl('look at https://example.com/x it is good')).toBe('https://example.com/x');
  });

  it('takes only the first, so one message means at most one fetch', () => {
    expect(extractFirstUrl('https://a.example https://b.example')).toBe('https://a.example');
  });

  it('returns null for text with no link, and for no text', () => {
    expect(extractFirstUrl('just talking')).toBeNull();
    expect(extractFirstUrl('')).toBeNull();
    expect(extractFirstUrl(undefined)).toBeNull();
  });

  it('ignores schemes the preview fetcher would refuse anyway', () => {
    expect(extractFirstUrl('ftp://example.com/x')).toBeNull();
    expect(extractFirstUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('isSafeToFetchDirectly', () => {
  // Regression coverage for the gap link-preview-js <=4.0.0 leaves open on
  // its own (GHSA-4gp8-rjrq-ch6q): this must catch the same request shapes
  // functions/ssrfGuard.js's isPrivateOrReservedIp blocks server-side.

  it('allows an ordinary public https URL', () => {
    expect(isSafeToFetchDirectly('https://example.com/article')).toBe(true);
  });

  it.each([
    ['http://127.0.0.1/admin', 'IPv4 loopback'],
    ['http://127.5.5.5/', 'IPv4 loopback range'],
    ['http://0.0.0.0/', 'IPv4 unspecified'],
    ['http://169.254.169.254/computeMetadata/v1/', 'cloud metadata endpoint'],
    ['http://10.0.0.5/', 'IPv4 private (10/8)'],
    ['http://172.16.0.1/', 'IPv4 private (172.16/12)'],
    ['http://172.31.255.255/', 'IPv4 private (172.16/12) upper bound'],
    ['http://192.168.1.1/', 'IPv4 private (192.168/16)'],
    ['http://100.64.0.1/', 'IPv4 CGNAT'],
    ['http://224.0.0.1/', 'IPv4 multicast/reserved'],
    ['http://localhost/', 'localhost hostname'],
    ['http://foo.localhost/', 'subdomain of localhost'],
    ['http://router.local/', '.local hostname'],
    ['http://service.internal/', '.internal hostname'],
    ['http://[::1]/', 'IPv6 loopback'],
    ['http://[fe80::1]/', 'IPv6 link-local (fe80::/10)'],
    ['http://[febf::1]/', 'IPv6 link-local (fe80::/10) upper bound'],
    ['http://[fc00::1]/', 'IPv6 unique-local (fc00::/7)'],
    ['http://[fd12:3456::1]/', 'IPv6 unique-local (fc00::/7)'],
    ['http://[::ffff:127.0.0.1]/', 'IPv4-mapped IPv6 loopback'],
    ['http://[::ffff:169.254.169.254]/', 'IPv4-mapped IPv6 metadata endpoint'],
  ])('blocks %s (%s)', url => {
    expect(isSafeToFetchDirectly(url)).toBe(false);
  });

  it('allows an IPv4-mapped IPv6 address whose embedded address is public', () => {
    expect(isSafeToFetchDirectly('http://[::ffff:93.184.216.34]/')).toBe(true);
  });

  /**
   * The forms the previous guard missed, and why it missed all of them.
   *
   * It matched /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/ against the raw host
   * string. Every address below names 127.0.0.1 or 192.168.1.1 and every one
   * of them fails that pattern, so each fell past the IPv4 branch to the
   * `return true` at the end — the guard's only answer for "I did not
   * recognise this" was to allow it. A URL parser applies inet_aton and goes
   * to the loopback regardless of how the host was spelled.
   */
  it.each([
    ['http://127.1/', 'two-part IPv4 — the last part absorbs three bytes'],
    ['http://127.0.1/', 'three-part IPv4'],
    ['http://2130706433/', '127.0.0.1 as a single decimal integer'],
    ['http://0x7f000001/', '127.0.0.1 in hex'],
    ['http://017700000001/', '127.0.0.1 in octal'],
    ['http://0/', '0.0.0.0 as a bare zero'],
    ['http://3232235777/', '192.168.1.1 as a decimal integer'],
    ['http://0xc0a80101/', '192.168.1.1 in hex'],
    ['http://[::ffff:7f00:1]/', 'IPv4-mapped loopback written in hex groups'],
    ['http://[0:0:0:0:0:0:0:1]/', '::1 written out in full'],
    ['http://[::0:1]/', '::1 with an explicit zero group'],
  ])('blocks %s (%s)', url => {
    expect(isSafeToFetchDirectly(url)).toBe(false);
  });

  // Fail closed. The old guard's fallthrough was `return true`, so an
  // unrecognised host was assumed to be a public hostname. Anything shaped
  // like an address now has to parse as one.
  it.each([
    ['http://0x7f.1/', 'hex part in a host too short to be an address'],
    ['http://999.999.999.999/', 'out of range'],
    ['http://[:::1]/', 'malformed IPv6'],
    ['http://[gggg::1]/', 'non-hex IPv6 groups'],
    ['http://[1:2:3:4:5:6:7]/', 'too few IPv6 groups without ::'],
  ])('refuses %s rather than assuming it is a hostname (%s)', url => {
    expect(isSafeToFetchDirectly(url)).toBe(false);
  });

  it('still leaves ordinary hostnames and public addresses alone', () => {
    expect(isSafeToFetchDirectly('https://sub.domain.co.uk/x')).toBe(true);
    expect(isSafeToFetchDirectly('http://8.8.8.8/')).toBe(true);
    expect(isSafeToFetchDirectly('http://93.184.216.34/')).toBe(true);
    expect(isSafeToFetchDirectly('http://[2606:2800:220:1:248:1893:25c8:1946]/')).toBe(true);
  });

  it('rejects anything that is not an http(s) URL', () => {
    expect(isSafeToFetchDirectly('not a url')).toBe(false);
    expect(isSafeToFetchDirectly('ftp://example.com/x')).toBe(false);
  });
});

describe('hasPreviewContent', () => {
  it('is false for a preview that is only the URL — not worth a card', () => {
    expect(hasPreviewContent({url: 'https://example.com'})).toBe(false);
    expect(hasPreviewContent({url: 'https://example.com', title: null, image: null})).toBe(false);
  });

  it('is true as soon as there is anything to show', () => {
    expect(hasPreviewContent({url: 'https://example.com', title: 'Hi'})).toBe(true);
    expect(hasPreviewContent({url: 'https://example.com', image: 'https://example.com/i.png'})).toBe(true);
  });

  it('is false for nothing at all', () => {
    expect(hasPreviewContent(null)).toBe(false);
    expect(hasPreviewContent(undefined)).toBe(false);
  });
});

describe('parsePreview / normalizePreview', () => {
  it('round-trips a preview', () => {
    expect(parsePreview(serializePreview(PREVIEW))).toEqual(PREVIEW);
  });

  it('returns null for junk rather than throwing into the render', () => {
    expect(parsePreview('not json')).toBeNull();
    expect(parsePreview('')).toBeNull();
    expect(parsePreview(null)).toBeNull();
    expect(parsePreview('123')).toBeNull();
    expect(parsePreview('{"title":"no url"}')).toBeNull();
  });

  // The preview arrives from another client, so its URL is attacker-controlled
  // in the same way message text is — see utils/safeUrl.
  it('rejects a preview whose URL is not safe to open', () => {
    expect(normalizePreview({url: 'javascript:alert(1)', title: 'Click me'})).toBeNull();
    expect(normalizePreview({url: 'data:text/html,<script>alert(1)</script>', title: 'x'})).toBeNull();
  });

  it('normalises empty strings to null so they do not render as blank rows', () => {
    expect(normalizePreview({url: 'https://example.com', title: '', description: 'd'})).toEqual({
      url: 'https://example.com',
      title: null,
      description: 'd',
      image: null,
    });
  });

  it('drops non-string fields instead of trusting them', () => {
    expect(normalizePreview({url: 'https://example.com', title: {evil: true}, image: 42})).toEqual({
      url: 'https://example.com',
      title: null,
      description: null,
      image: null,
    });
  });
});

describe('buildLinkPreviewPatch', () => {
  // The point of the whole change: this client always fetched the preview
  // once, but it used to write the result to Firestore in the clear.
  it('seals the preview so no part of it is stored in the clear', async () => {
    const crypto = await makeArtifactCrypto('alice', 'bob', CHAT);
    const patch = buildLinkPreviewPatch(PREVIEW, crypto);

    expect(patch.encryptedLinkPreview).toBeTruthy();
    expect(patch.linkPreview).toBeUndefined();

    const wire = JSON.stringify(patch);
    expect(wire).not.toContain('A very identifying headline');
    expect(wire).not.toContain('About something personal');
    expect(wire).not.toContain('example.com');
  });

  it('is readable by the recipient, and only the recipient', async () => {
    const mine = await makeArtifactCrypto('alice', 'bob', CHAT);
    const patch = buildLinkPreviewPatch(PREVIEW, mine);

    mockKeypair.mockResolvedValue(bob);
    mockPeerKey.mockResolvedValue({key: alice.publicKey, status: 'ok'});
    const theirs = await makeArtifactCrypto('bob', 'alice', CHAT);
    expect(parsePreview(theirs.open('', patch.encryptedLinkPreview))).toEqual(PREVIEW);

    const mallory = generateKeypair();
    mockKeypair.mockResolvedValue(mallory);
    mockPeerKey.mockResolvedValue({key: alice.publicKey, status: 'ok'});
    const intruder = await makeArtifactCrypto('mallory', 'alice', CHAT);
    expect(parsePreview(intruder.open('', patch.encryptedLinkPreview))).toBeNull();
  });

  // A group chat, or a peer who never enrolled a key: previews still work,
  // they just stay visible to the server exactly as they were before.
  it('falls back to the plaintext field when there is nobody to encrypt to', () => {
    const patch = buildLinkPreviewPatch(PREVIEW, INERT_ARTIFACT_CRYPTO);
    expect(patch.linkPreview).toEqual(PREVIEW);
    expect(patch.encryptedLinkPreview).toBeUndefined();
  });
});
