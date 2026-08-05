import {describe, expect, it} from 'vitest';
import {resolveMessageMediaUrls} from './messageMedia';
import {encryptMessage, generateKeypair} from './e2ee';

const CHAT = 'chat-abc123';

describe('resolveMessageMediaUrls', () => {
  it('returns plaintext media URLs directly', () => {
    const message = {
      image: 'https://storage.example/photo.jpg',
      video: 'https://storage.example/clip.mp4',
      audio: 'https://storage.example/voice.m4a',
      file: {uri: 'https://storage.example/doc.pdf'},
    };
    const urls = resolveMessageMediaUrls(message, null, CHAT);
    expect(urls.sort()).toEqual(
      [
        'https://storage.example/photo.jpg',
        'https://storage.example/clip.mp4',
        'https://storage.example/voice.m4a',
        'https://storage.example/doc.pdf',
      ].sort(),
    );
  });

  it('ignores empty/missing plaintext fields', () => {
    expect(resolveMessageMediaUrls({text: 'hi'}, null, CHAT)).toEqual([]);
    expect(resolveMessageMediaUrls({image: ''}, null, CHAT)).toEqual([]);
  });

  it('decrypts an encrypted media pointer when the correct secret key is available', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('https://storage.example/secret.jpg', alice.secretKey, bob.publicKey, CHAT);

    const urls = resolveMessageMediaUrls({encryptedImage: payload}, alice.secretKey, CHAT);
    expect(urls).toEqual(['https://storage.example/secret.jpg']);
  });

  it('the recipient can resolve a pointer the sender sealed, and vice versa', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('https://storage.example/secret.jpg', alice.secretKey, bob.publicKey, CHAT);

    expect(resolveMessageMediaUrls({encryptedAudio: payload}, bob.secretKey, CHAT)).toEqual([
      'https://storage.example/secret.jpg',
    ]);
  });

  it('skips an encrypted field silently when no secret key is available', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('https://storage.example/secret.jpg', alice.secretKey, bob.publicKey, CHAT);

    expect(resolveMessageMediaUrls({encryptedVideo: payload}, null, CHAT)).toEqual([]);
  });

  it('skips an encrypted field silently when decryption fails (wrong key), never throws', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const mallory = generateKeypair();
    const payload = encryptMessage('https://storage.example/secret.jpg', alice.secretKey, bob.publicKey, CHAT);

    expect(() => resolveMessageMediaUrls({encryptedFileUri: payload}, mallory.secretKey, CHAT)).not.toThrow();
    expect(resolveMessageMediaUrls({encryptedFileUri: payload}, mallory.secretKey, CHAT)).toEqual([]);
  });

  it('resolves a mix of plaintext and encrypted fields in one call', () => {
    const alice = generateKeypair();
    const bob = generateKeypair();
    const payload = encryptMessage('https://storage.example/secret.jpg', alice.secretKey, bob.publicKey, CHAT);

    const urls = resolveMessageMediaUrls(
      {audio: 'https://storage.example/voice.m4a', encryptedImage: payload},
      alice.secretKey,
      CHAT,
    );
    expect(urls.sort()).toEqual(['https://storage.example/secret.jpg', 'https://storage.example/voice.m4a'].sort());
  });

  it('returns an inline data: URI as-is — filtering it out is the caller\'s job, not this function\'s', () => {
    const urls = resolveMessageMediaUrls({image: 'data:image/jpeg;base64,abcd'}, null, CHAT);
    expect(urls).toEqual(['data:image/jpeg;base64,abcd']);
  });
});
