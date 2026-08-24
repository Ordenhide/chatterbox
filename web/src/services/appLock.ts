import {bytesToHex, deriveKeyFromPassphrase, hexToBytes, secureRandomBytes} from './crypto';

/**
 * PIN locks for individual chats, and for the app as a whole.
 *
 * The PIN goes through the same memory-hard scrypt used for encrypted backups
 * (crypto.ts). Mobile now does the same.
 *
 * It did not always: mobile hand-rolled an FNV-1a stretch, and this file used
 * to explain the divergence by repeating mobile's own comment — that Hermes
 * had no native crypto, a constraint browsers don't share. That claim was
 * simply false (scrypt from @noble/hashes is pure JS and was already a
 * dependency on both sides), and taking it at face value here is what let it
 * stand unexamined for as long as it did. Worth remembering: a comment
 * explaining why another module is weaker is a claim to check, not to quote.
 *
 * The stored formats still differ, and that is safe, because a PIN never
 * leaves the device it was set on: it
 * lives in localStorage here and in MMKV there, is never synced, and nothing
 * cross-platform reads it. There is no stored format the two clients have to
 * agree on, so each can use the strongest primitive its runtime offers.
 *
 * What this protects against: someone with your unlocked browser opening a
 * chat. What it does not: anyone who can read localStorage directly, since a
 * locked chat's *messages* are not additionally encrypted by the PIN — the lock
 * gates the UI, not the data. Treat it as a privacy screen, not a safe.
 */

const APP_LOCK_KEY = 'app_lock_pin_v1';
const CHAT_LOCK_PREFIX = 'chat_lock_v1';

/** Stored as "v1:<saltHex>:<hashHex>". The version prefix exists so a future
 * parameter change can be detected and re-derived rather than silently failing. */
const FORMAT = 'v1';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode / quota). The lock simply won't persist;
    // failing loudly here would break the whole settings screen.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* see write() */
  }
}

function hashPin(pin: string, salt: Uint8Array): string {
  return bytesToHex(deriveKeyFromPassphrase(pin, salt));
}

function encodePin(pin: string): string {
  // Cryptographically random, unlike the mobile implementation's Math.random()
  // salt. Salts need not be secret, but a predictable one weakens exactly the
  // precomputation resistance a salt is there to provide.
  const salt = secureRandomBytes(16);
  return `${FORMAT}:${bytesToHex(salt)}:${hashPin(pin, salt)}`;
}

/**
 * Length-independent, value-independent comparison.
 *
 * A `===` on hex strings can short-circuit on the first differing character,
 * which in principle leaks how much of a guess was correct. The exposure here
 * is small — an attacker who can time this can usually also just read
 * localStorage — but constant-time comparison costs nothing and removes the
 * question entirely.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function verifyAgainstStored(input: string, stored: string | null): boolean {
  if (!stored) return false;
  const [version, saltHex, hash] = stored.split(':');
  // An unrecognised version is rejected rather than guessed at, which forces a
  // re-set instead of silently accepting or silently locking the user out.
  if (version !== FORMAT || !saltHex || !hash) return false;
  try {
    return timingSafeEqual(hashPin(input, hexToBytes(saltHex)), hash);
  } catch {
    return false;
  }
}

// ---- Per-chat locks ---------------------------------------------------------

const chatKey = (chatId: string) => `${CHAT_LOCK_PREFIX}:${chatId}`;

export function isChatLocked(chatId: string): boolean {
  return read(chatKey(chatId)) !== null;
}

export function setChatLockPIN(chatId: string, pin: string): void {
  write(chatKey(chatId), encodePin(pin));
}

export function removeChatLock(chatId: string): void {
  remove(chatKey(chatId));
}

export function verifyChatPIN(chatId: string, input: string): boolean {
  return verifyAgainstStored(input, read(chatKey(chatId)));
}

// ---- Whole-app lock ---------------------------------------------------------

export function isAppLockEnabled(): boolean {
  return read(APP_LOCK_KEY) !== null;
}

export function setAppLockPIN(pin: string): void {
  write(APP_LOCK_KEY, encodePin(pin));
}

export function disableAppLock(): void {
  remove(APP_LOCK_KEY);
}

export function verifyAppPIN(input: string): boolean {
  return verifyAgainstStored(input, read(APP_LOCK_KEY));
}
