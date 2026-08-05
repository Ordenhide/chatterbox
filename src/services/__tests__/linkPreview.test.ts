// Jest hoists jest.mock() factories above imports and only lets them close
// over variables prefixed with `mock` (case-insensitive).
const mockKeypair = jest.fn();
const mockPeerKey = jest.fn();

jest.mock('../e2eeKeys', () => ({
  getOrCreateDeviceKeypair: (...a: unknown[]) => mockKeypair(...a),
  fetchPeerPublicKeyChecked: (...a: unknown[]) => mockPeerKey(...a),
}));

import {generateKeypair} from '../e2ee';
import {INERT_ARTIFACT_CRYPTO, makeArtifactCrypto} from '../e2eeArtifacts';
import {
  buildLinkPreviewPatch,
  extractFirstUrl,
  hasPreviewContent,
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
