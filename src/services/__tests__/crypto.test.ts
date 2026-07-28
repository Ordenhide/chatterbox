import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToUtf8,
  decryptWithKey,
  decryptWithPassphrase,
  encryptWithKey,
  encryptWithPassphrase,
  generateKeyHex,
  hexToBytes,
  secureRandomBytes,
  utf8ToBytes,
} from '../crypto';

describe('encoding helpers', () => {
  it('round-trips hex', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 127, 128, 255]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });

  it('round-trips base64 at every padding length', () => {
    for (let len = 0; len < 40; len++) {
      const bytes = secureRandomBytes(len);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    }
  });

  it('round-trips non-ASCII utf8', () => {
    for (const text of ['hello', '你好世界', 'emoji 🎈🔐', 'mixed 中文 and ascii']) {
      expect(bytesToUtf8(utf8ToBytes(text))).toBe(text);
    }
  });
});

describe('secureRandomBytes', () => {
  it('returns the requested length', () => {
    expect(secureRandomBytes(32)).toHaveLength(32);
  });

  it('does not repeat across calls', () => {
    const a = bytesToHex(secureRandomBytes(32));
    const b = bytesToHex(secureRandomBytes(32));
    expect(a).not.toBe(b);
  });

  it('generateKeyHex produces 32 bytes of hex', () => {
    const key = generateKeyHex();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('passphrase encryption', () => {
  it('round-trips', () => {
    const secret = JSON.stringify({messages: ['hi', '你好'], n: 42});
    const packed = encryptWithPassphrase(secret, 'correct horse battery staple');
    expect(decryptWithPassphrase(packed, 'correct horse battery staple')).toBe(secret);
  });

  it('does not leak plaintext into the ciphertext', () => {
    // Compared as raw bytes: ciphertext is not valid UTF-8, so it must not be
    // run through bytesToUtf8 (which correctly rejects arbitrary binary).
    const needle = utf8ToBytes('SENSITIVE_TOKEN_VALUE');
    const haystack = base64ToBytes(encryptWithPassphrase('SENSITIVE_TOKEN_VALUE', 'pw'));
    let found = false;
    for (let i = 0; i + needle.length <= haystack.length && !found; i++) {
      found = needle.every((b, j) => haystack[i + j] === b);
    }
    expect(found).toBe(false);
  });

  it('rejects a wrong passphrase instead of returning garbage', () => {
    const packed = encryptWithPassphrase('secret', 'right-passphrase');
    expect(() => decryptWithPassphrase(packed, 'wrong-passphrase')).toThrow();
  });

  it('detects tampering (authenticated encryption)', () => {
    const packed = encryptWithPassphrase('secret message', 'pw');
    const bytes = base64ToBytes(packed);
    bytes[bytes.length - 1] ^= 0xff; // flip a bit in the ciphertext/tag
    expect(() => decryptWithPassphrase(bytesToBase64(bytes), 'pw')).toThrow();
  });

  it('produces different ciphertext each time (random salt+nonce)', () => {
    const a = encryptWithPassphrase('same input', 'same passphrase');
    const b = encryptWithPassphrase('same input', 'same passphrase');
    expect(a).not.toBe(b);
    // ...but both still decrypt correctly.
    expect(decryptWithPassphrase(a, 'same passphrase')).toBe('same input');
    expect(decryptWithPassphrase(b, 'same passphrase')).toBe('same input');
  });

  it('rejects truncated input', () => {
    expect(() => decryptWithPassphrase('AAAA', 'pw')).toThrow();
  });
});

describe('key encryption', () => {
  it('round-trips', () => {
    const key = secureRandomBytes(32);
    const packed = encryptWithKey('a message', key);
    expect(decryptWithKey(packed, key)).toBe('a message');
  });

  it('fails with the wrong key', () => {
    const packed = encryptWithKey('a message', secureRandomBytes(32));
    expect(() => decryptWithKey(packed, secureRandomBytes(32))).toThrow();
  });

  it('rejects wrong key sizes', () => {
    expect(() => encryptWithKey('x', secureRandomBytes(16))).toThrow(/32 bytes/);
    expect(() => decryptWithKey('AAAA', secureRandomBytes(16))).toThrow(/32 bytes/);
  });
});

describe('regression: the old XOR scheme is not reproduced', () => {
  // The previous implementation XOR'd each char with (hash(passphrase)+i*31)&0xff.
  // Known-plaintext recovery of that keystream is trivial; these assertions
  // guard against anyone reintroducing a deterministic, unauthenticated scheme.
  it('is non-deterministic for identical inputs', () => {
    const outputs = new Set(
      Array.from({length: 5}, () => encryptWithPassphrase('{"users":[]}', 'chatterbox')),
    );
    expect(outputs.size).toBe(5);
  });

  it('ciphertext length is not equal to plaintext length', () => {
    const plaintext = 'x'.repeat(100);
    const packed = base64ToBytes(encryptWithPassphrase(plaintext, 'pw'));
    // salt(16) + nonce(24) + ciphertext(100) + poly1305 tag(16)
    expect(packed.length).toBe(16 + 24 + 100 + 16);
  });
});
