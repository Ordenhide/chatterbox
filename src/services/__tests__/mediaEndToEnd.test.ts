/**
 * The whole attachment path, composed the way ChatScreen composes it.
 *
 * Each piece has its own tests; what those cannot catch is the seam. The
 * content key crosses a JSON boundary inside the body encoder and an AEAD
 * boundary inside the message envelope, and a key that survives neither trip
 * intact produces an attachment nobody can open — with every unit test still
 * green, because each unit did its own job correctly.
 *
 * ChatScreen is not testable, so this stands in for it: sender encrypts,
 * seals, and "uploads"; receiver opens, decrypts, and gets the original bytes.
 */
import {
  bytesSource,
  collectingSink,
  decryptMedia,
  encryptMedia,
  MediaIntegrityError,
} from '../mediaCrypto';
import {decodeBody, encodeBody} from '../messageBody';
import {generateKeypair, openEnvelope, sealForRecipients} from '../e2ee';

const CHAT_ID = 'chat-1';

function pattern(length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = (i * 97 + 13) & 0xff;
  return out;
}

/** The sender's half: encrypt bytes, then seal the key inside the body. */
async function send(
  photo: Uint8Array,
  caption: string,
  senderSecret: Uint8Array,
  recipients: {uid: string; publicKey: Uint8Array}[],
) {
  const objectSink = collectingSink();
  const info = await encryptMedia(bytesSource(photo), objectSink, {mime: 'image/jpeg'});
  const body = encodeBody({text: caption, media: {image: info}});
  return {
    /** What Cloud Storage would hold. */
    object: objectSink.result(),
    /** What Firestore would hold. */
    encrypted: sealForRecipients(body, senderSecret, recipients, CHAT_ID),
  };
}

/** The receiver's half: open the body, then decrypt the object it points at. */
async function receive(
  message: {object: Uint8Array; encrypted: ReturnType<typeof sealForRecipients>},
  uid: string,
  secretKey: Uint8Array,
) {
  const body = decodeBody(openEnvelope(message.encrypted, secretKey, uid, CHAT_ID)!);
  const info = body.media?.image;
  if (!info) return {text: body.text, photo: null};

  const sink = collectingSink();
  await decryptMedia(bytesSource(message.object), sink, info);
  return {text: body.text, photo: sink.result()};
}

describe('an encrypted attachment, end to end', () => {
  it('arrives intact with its caption', async () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const photo = pattern(50_000);

    const message = await send(photo, 'look at this', alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
    ]);
    const received = await receive(message, 'bob', bob.secretKey);

    expect(received.text).toBe('look at this');
    expect(received.photo).toEqual(photo);
  });

  it('never puts the plaintext bytes on the wire', async () => {
    // The point of the whole exercise. If this fails, everything else in this
    // file is decoration.
    const alice = generateKeypair();
    const bob = generateKeypair();
    const photo = pattern(10_000);

    const message = await send(photo, '', alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
    ]);

    expect(message.object).not.toEqual(photo);
    // And no window of the ciphertext matches any window of the plaintext.
    const haystack = Buffer.from(message.object).toString('binary');
    const needle = Buffer.from(photo.subarray(0, 64)).toString('binary');
    expect(haystack.includes(needle)).toBe(false);
  });

  it('keeps the content key out of the stored message', async () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    // A caption long enough that finding it by chance in base64 is not a
    // thing that happens — a two-character one matches almost any ciphertext.
    const caption = 'meet-me-at-midnight';
    const message = await send(pattern(1000), caption, alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
    ]);

    // Everything Firestore would hold, as the server sees it.
    const stored = JSON.stringify(message.encrypted);
    expect(stored).not.toContain('chatterbox-media-v1');
    expect(stored).not.toContain('nonceBase');
    expect(stored).not.toContain(caption);
  });

  it('delivers to every member of a group', async () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const carol = generateKeypair();
    const photo = pattern(5000);

    const message = await send(photo, 'group photo', alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
      {uid: 'carol', publicKey: carol.publicKey},
    ]);

    expect((await receive(message, 'bob', bob.secretKey)).photo).toEqual(photo);
    expect((await receive(message, 'carol', carol.secretKey)).photo).toEqual(photo);
  });

  it('is unreadable to someone who was not a recipient', async () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const mallory = generateKeypair();

    const message = await send(pattern(5000), 'private', alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
    ]);

    // No copy addressed to mallory, so there is no key and thus no photo.
    expect(() => openEnvelope(message.encrypted, mallory.secretKey, 'mallory', CHAT_ID)).toThrow();
  });

  it('refuses an object the server swapped for another', async () => {
    // The server holds the object and can replace it. It cannot produce one
    // that authenticates under a key it has never seen.
    const alice = generateKeypair();
    const bob = generateKeypair();

    const real = await send(pattern(5000), 'real', alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
    ]);
    const fake = await send(pattern(5000), 'fake', alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
    ]);

    await expect(
      receive({object: fake.object, encrypted: real.encrypted}, 'bob', bob.secretKey),
    ).rejects.toThrow(MediaIntegrityError);
  });

  it('refuses an object the server truncated', async () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const message = await send(pattern(5000), '', alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
    ]);

    await expect(
      receive(
        {object: message.object.subarray(0, 2000), encrypted: message.encrypted},
        'bob',
        bob.secretKey,
      ),
    ).rejects.toThrow(MediaIntegrityError);
  });

  it('survives a message with an attachment and no caption', async () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const photo = pattern(3000);

    const message = await send(photo, '', alice.secretKey, [
      {uid: 'bob', publicKey: bob.publicKey},
    ]);
    const received = await receive(message, 'bob', bob.secretKey);

    expect(received.text).toBe('');
    expect(received.photo).toEqual(photo);
  });

  it('leaves a plain text message on exactly the old wire format', async () => {
    // The compatibility claim, checked against the real envelope rather than
    // just the encoder: a text message must be indistinguishable from one an
    // already-deployed client would have produced.
    const alice = generateKeypair();
    const bob = generateKeypair();
    const recipients = [{uid: 'bob', publicKey: bob.publicKey}];

    const viaBody = sealForRecipients(
      encodeBody({text: 'hello'}),
      alice.secretKey,
      recipients,
      CHAT_ID,
    );
    expect(openEnvelope(viaBody, bob.secretKey, 'bob', CHAT_ID)).toBe('hello');
  });
});
