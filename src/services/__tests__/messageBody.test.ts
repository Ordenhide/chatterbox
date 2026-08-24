import {bytesSource, collectingSink, encryptMedia, type MediaKeyInfo} from '../mediaCrypto';
import {decodeBody, encodeBody, isStructuredBody} from '../messageBody';

/** Mirrors the module's private marker. Written as escapes so the source
 * stays free of raw NUL bytes, which editors and diff tools mangle. */
const MARKER = '\u0000cbx-body-1\u0000';

async function someKey(): Promise<MediaKeyInfo> {
  return encryptMedia(bytesSource(new Uint8Array([1, 2, 3])), collectingSink(), {
    mime: 'image/jpeg',
  });
}

describe('encodeBody', () => {
  it('leaves a plain text message exactly as it was', () => {
    // The compatibility guarantee: what an already-shipped client decrypts and
    // renders must not change. Anything but strict equality breaks it.
    expect(encodeBody({text: 'hello'})).toBe('hello');
    expect(encodeBody({text: ''})).toBe('');
    expect(encodeBody({text: 'emoji 🎉 and "quotes"'})).toBe('emoji 🎉 and "quotes"');
  });

  it('leaves text alone when the media map is present but empty', () => {
    expect(encodeBody({text: 'hi', media: {}})).toBe('hi');
    expect(isStructuredBody(encodeBody({text: 'hi', media: {}}))).toBe(false);
  });

  it('uses the structured form when media is attached', async () => {
    const encoded = encodeBody({text: 'look', media: {image: await someKey()}});
    expect(isStructuredBody(encoded)).toBe(true);
    expect(encoded.startsWith(MARKER)).toBe(true);
  });
});

describe('round trip', () => {
  it('restores text and media keys', async () => {
    const image = await someKey();
    const video = await someKey();
    const decoded = decodeBody(encodeBody({text: 'caption', media: {image, video}}));
    expect(decoded.text).toBe('caption');
    expect(decoded.media?.image).toEqual(image);
    expect(decoded.media?.video).toEqual(video);
    expect(decoded.media?.audio).toBeUndefined();
  });

  it('restores media with no caption', async () => {
    const decoded = decodeBody(encodeBody({text: '', media: {file: await someKey()}}));
    expect(decoded.text).toBe('');
    expect(decoded.media?.file).toBeDefined();
  });

  it('round-trips text that begins with the marker itself', () => {
    // Without the forced structured path this would decode as a header,
    // and the user's own message would vanish into a parse failure.
    const hostile = MARKER + '{"text":"not mine"}';
    const decoded = decodeBody(encodeBody({text: hostile}));
    expect(decoded.text).toBe(hostile);
    expect(decoded.media).toBeUndefined();
  });

  it('round-trips text that merely contains a NUL', () => {
    const odd = 'before\u0000after';
    expect(encodeBody({text: odd})).toBe(odd);
    expect(decodeBody(odd).text).toBe(odd);
  });
});

describe('decodeBody on hostile or legacy input', () => {
  it('treats an unmarked string as plain text, whatever it looks like', () => {
    // A legacy sender's body, and also a user who typed JSON.
    expect(decodeBody('{"text":"json-looking"}').text).toBe('{"text":"json-looking"}');
    expect(decodeBody('{"text":"json-looking"}').media).toBeUndefined();
  });

  it('degrades to an empty message rather than throwing on malformed JSON', () => {
    expect(decodeBody(MARKER + '{not json').text).toBe('');
    expect(decodeBody(MARKER).media).toBeUndefined();
  });

  it('degrades when the payload is not an object', () => {
    expect(decodeBody(MARKER + '42').text).toBe('');
    expect(decodeBody(MARKER + 'null').text).toBe('');
  });

  it('drops media entries that are not valid key info', () => {
    // The sender controls this field. A bogus entry must not reach the
    // decryptor, and must not take the caption down with it.
    const encoded =
      MARKER +
      JSON.stringify({text: 'caption', media: {image: {url: 'https://evil/x'}, video: 7}});
    const decoded = decodeBody(encoded);
    expect(decoded.text).toBe('caption');
    expect(decoded.media).toBeUndefined();
  });

  it('keeps the valid slots when only some are malformed', async () => {
    const image = await someKey();
    const encoded =
      MARKER + JSON.stringify({text: '', media: {image, video: 'nope'}});
    const decoded = decodeBody(encoded);
    expect(decoded.media?.image).toEqual(image);
    expect(decoded.media?.video).toBeUndefined();
  });

  it('ignores unknown slots', async () => {
    const encoded =
      MARKER +
      JSON.stringify({text: 'x', media: {sticker: await someKey()}});
    expect(decodeBody(encoded).media).toBeUndefined();
  });

  it('coerces a non-string text to empty rather than passing it through', () => {
    const encoded = MARKER + JSON.stringify({text: {evil: true}});
    expect(decodeBody(encoded).text).toBe('');
  });
});
