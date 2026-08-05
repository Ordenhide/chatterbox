import {describe, expect, it, vi} from 'vitest';

// storage.ts initialises Firebase Storage at import time; stub the SDK so these
// pure-function tests stay hermetic (no Firebase init / network).
vi.mock('firebase/app', () => ({getApp: () => ({})}));
vi.mock('firebase/storage', () => ({
  getStorage: () => ({}),
  ref: () => ({}),
  uploadBytesResumable: () => ({}),
  getDownloadURL: async () => '',
  deleteObject: async () => undefined,
}));
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  getDoc: async () => ({exists: () => false, data: () => ({})}),
  serverTimestamp: () => ({}),
  setDoc: async () => undefined,
}));
vi.mock('../firebase', () => ({db: {}}));

import {
  describeUploadError,
  encodeInlineMedia,
  extensionForMime,
  MAX_INLINE_BYTES,
  MAX_INLINE_DATA_URI_CHARS,
} from './storage';

const blobOf = (bytes: number, type = 'audio/webm') =>
  new Blob([new Uint8Array(bytes)], {type});

describe('MAX_INLINE_DATA_URI_CHARS', () => {
  it('caps inline audio at ~60s of 32kbps recording, matching the mobile client exactly', () => {
    // A purely relative test (e.g. "MAX_INLINE_BYTES derives correctly from
    // MAX_INLINE_DATA_URI_CHARS") would still pass if this constant drifted
    // from src/services/inlineAudio.ts's copy — only a pinned absolute value
    // on both sides catches that.
    expect(MAX_INLINE_DATA_URI_CHARS).toBe(320_000);
    expect(MAX_INLINE_BYTES).toBe(239_904);
  });
});

describe('extensionForMime', () => {
  it('maps Safari-recorded audio to m4a', () => {
    // Safari's MediaRecorder only produces audio/mp4 — labelling it .webm was
    // the old bug this guards against.
    expect(extensionForMime('audio/mp4')).toBe('m4a');
    expect(extensionForMime('audio/mp4;codecs=mp4a.40.2')).toBe('m4a');
  });

  it('handles Chrome/Firefox webm with a codecs parameter', () => {
    expect(extensionForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionForMime('audio/webm')).toBe('webm');
  });

  it('falls back to webm for anything unrecognised', () => {
    expect(extensionForMime('')).toBe('webm');
    expect(extensionForMime('audio/flac')).toBe('webm');
  });
});

describe('encodeInlineMedia', () => {
  it('encodes a small clip as a decodable data URI carrying its mime type', async () => {
    const uri = await encodeInlineMedia(blobOf(1024, 'audio/webm'));
    expect(uri).toMatch(/^data:audio\/webm;base64,/);
  });

  it('preserves the mime type so the browser can decode Safari recordings', async () => {
    const uri = await encodeInlineMedia(blobOf(1024, 'audio/mp4'));
    expect(uri).toMatch(/^data:audio\/mp4;base64,/);
  });

  it('refuses a clip larger than the inline budget', async () => {
    expect(await encodeInlineMedia(blobOf(MAX_INLINE_BYTES + 1))).toBeNull();
  });

  it('accepts a clip exactly at the budget', async () => {
    expect(await encodeInlineMedia(blobOf(MAX_INLINE_BYTES))).not.toBeNull();
  });

  it('never returns a URI that would overflow a Firestore document', async () => {
    // The real constraint: Firestore caps a document at 1 MiB. A URI at the
    // byte budget must still leave room for the rest of the message.
    const uri = await encodeInlineMedia(blobOf(MAX_INLINE_BYTES));
    expect(uri!.length).toBeLessThanOrEqual(MAX_INLINE_DATA_URI_CHARS);
    expect(uri!.length).toBeLessThan(1024 * 1024);
  });
});

describe('describeUploadError', () => {
  it('distinguishes a rules rejection from a lost connection', () => {
    expect(describeUploadError({code: 'storage/unauthorized'})).toBe('chat.uploadDenied');
    expect(describeUploadError({code: 'storage/retry-limit-exceeded'})).toBe('chat.uploadNetwork');
  });

  it('reports quota separately — it means billing, not a broken rule', () => {
    expect(describeUploadError({code: 'storage/quota-exceeded'})).toBe('chat.uploadQuota');
  });

  it('falls back to the generic message for an unknown or absent code', () => {
    expect(describeUploadError({})).toBe('chat.uploadFailed');
    expect(describeUploadError(null)).toBe('chat.uploadFailed');
  });
});
