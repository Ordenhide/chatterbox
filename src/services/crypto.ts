/**
 * Cryptographic primitives for Chatterbox.
 *
 * Everything here is built on @noble/* — pure-JS, audited, no native code — so
 * it behaves identically on iOS, Android, macOS and (via the same source) can
 * be ported to the web client without a second implementation to keep in sync.
 *
 * Randomness comes from `crypto.getRandomValues`, which React Native's Hermes
 * does NOT provide; `react-native-get-random-values` polyfills it and must be
 * imported before anything here runs (see index.js).
 *
 * Deliberate choices:
 *  - XChaCha20-Poly1305 for AEAD. The 24-byte nonce is large enough to generate
 *    randomly per message without birthday-bound concerns, which removes the
 *    "must never reuse a counter" footgun that AES-GCM carries.
 *  - scrypt for passphrase derivation. Memory-hard, so it degrades an attacker's
 *    GPU/ASIC advantage in a way PBKDF2 does not.
 *  - X25519 for key agreement (see e2ee.ts).
 */
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {scrypt} from '@noble/hashes/scrypt.js';
import {randomBytes} from '@noble/hashes/utils.js';

export const NONCE_BYTES = 24;
export const KEY_BYTES = 32;
export const SALT_BYTES = 16;

/**
 * scrypt cost parameters. N=2^15 with r=8 costs roughly 32 MB and ~100ms on a
 * modern phone — high enough to make offline guessing expensive, low enough
 * that unlocking a backup doesn't feel broken on older hardware.
 */
export const SCRYPT_PARAMS = {N: 2 ** 15, r: 8, p: 1, dkLen: KEY_BYTES} as const;

export function secureRandomBytes(length: number): Uint8Array {
  return randomBytes(length);
}

/** Random 32-byte key, hex-encoded. Suitable for MMKV's `encryptionKey`. */
export function generateKeyHex(): string {
  return bytesToHex(secureRandomBytes(KEY_BYTES));
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hex string has odd length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Base64 without depending on a global `btoa` (absent on Hermes) or Buffer
// (absent in the browser) — one implementation that works in both runtimes.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64[b2 & 63];
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((clean[i + 2] ? B64.indexOf(clean[i + 2]) : 0) << 6) |
      (clean[i + 3] ? B64.indexOf(clean[i + 3]) : 0);
    if (p < len) out[p++] = (n >> 16) & 0xff;
    if (p < len) out[p++] = (n >> 8) & 0xff;
    if (p < len) out[p++] = n & 0xff;
  }
  return out;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new Uint8Array(
    unescape(encodeURIComponent(text))
      .split('')
      .map(c => c.charCodeAt(0)),
  );
}

export function bytesToUtf8(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(binary));
}

/** Derives a 32-byte key from a passphrase. Slow by design. */
export function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Uint8Array {
  return scrypt(utf8ToBytes(passphrase), salt, SCRYPT_PARAMS);
}

/**
 * Authenticated encryption. Returns salt‖nonce‖ciphertext, base64-encoded.
 *
 * Poly1305 authenticates, so tampering is detected on decrypt rather than
 * silently producing garbage plaintext — the property the previous XOR scheme
 * lacked entirely.
 */
export function encryptWithPassphrase(plaintext: string, passphrase: string): string {
  const salt = secureRandomBytes(SALT_BYTES);
  const nonce = secureRandomBytes(NONCE_BYTES);
  const key = deriveKeyFromPassphrase(passphrase, salt);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(utf8ToBytes(plaintext));

  const packed = new Uint8Array(salt.length + nonce.length + ciphertext.length);
  packed.set(salt, 0);
  packed.set(nonce, salt.length);
  packed.set(ciphertext, salt.length + nonce.length);
  return bytesToBase64(packed);
}

/** Throws if the passphrase is wrong or the payload was tampered with. */
export function decryptWithPassphrase(packedBase64: string, passphrase: string): string {
  const packed = base64ToBytes(packedBase64);
  if (packed.length < SALT_BYTES + NONCE_BYTES + 16) {
    throw new Error('ciphertext is too short to be valid');
  }
  const salt = packed.subarray(0, SALT_BYTES);
  const nonce = packed.subarray(SALT_BYTES, SALT_BYTES + NONCE_BYTES);
  const ciphertext = packed.subarray(SALT_BYTES + NONCE_BYTES);
  const key = deriveKeyFromPassphrase(passphrase, salt);
  // Poly1305 verification failure surfaces here as a thrown error.
  return bytesToUtf8(xchacha20poly1305(key, nonce).decrypt(ciphertext));
}

/** AEAD with a key you already hold (no KDF). Returns nonce‖ciphertext. */
export function encryptWithKey(plaintext: string, key: Uint8Array): string {
  if (key.length !== KEY_BYTES) throw new Error(`key must be ${KEY_BYTES} bytes`);
  const nonce = secureRandomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(utf8ToBytes(plaintext));
  const packed = new Uint8Array(nonce.length + ciphertext.length);
  packed.set(nonce, 0);
  packed.set(ciphertext, nonce.length);
  return bytesToBase64(packed);
}

export function decryptWithKey(packedBase64: string, key: Uint8Array): string {
  if (key.length !== KEY_BYTES) throw new Error(`key must be ${KEY_BYTES} bytes`);
  const packed = base64ToBytes(packedBase64);
  if (packed.length < NONCE_BYTES + 16) throw new Error('ciphertext is too short to be valid');
  const nonce = packed.subarray(0, NONCE_BYTES);
  const ciphertext = packed.subarray(NONCE_BYTES);
  return bytesToUtf8(xchacha20poly1305(key, nonce).decrypt(ciphertext));
}
