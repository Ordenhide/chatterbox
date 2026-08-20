import {mmkvStorage} from './storageMMKV';
import {bytesToHex, secureRandomBytes} from './crypto';
import * as biometrics from './biometrics';

// FNV-1a over the concatenated salt+pin, run for `rounds` iterations.
// Not as strong as PBKDF2 (no native crypto available in Hermes), but with a
// random per-device salt it prevents precomputed rainbow-table attacks.
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stretchHash(salt: string, pin: string, rounds = 10_000): string {
  let state = salt + pin;
  let h1 = fnv1a(state);
  let h2 = fnv1a(pin + salt);
  for (let i = 0; i < rounds; i++) {
    h1 = fnv1a(h1.toString(36) + state + i.toString());
    h2 = fnv1a(h2.toString(36) + state.split('').reverse().join('') + i.toString());
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function randomSalt(): string {
  // Was Math.random(), which is not a CSPRNG — its output is predictable from
  // observed values, so salts generated close together were guessable. Salts
  // need not be secret, but a predictable one gives back exactly the
  // precomputation resistance the salt exists to provide. secureRandomBytes is
  // the same CSPRNG the E2EE keys already use.
  return bytesToHex(secureRandomBytes(16));
}

// Stored format: "v2:<salt>:<hash>"
function encodePin(pin: string): string {
  const salt = randomSalt();
  return `v2:${salt}:${stretchHash(salt, pin)}`;
}

function verifyPinAgainstStored(input: string, stored: string): boolean {
  if (stored.startsWith('v2:')) {
    const [, salt, hash] = stored.split(':');
    return stretchHash(salt, input) === hash;
  }
  // Legacy format (unsalted) — always reject and force re-set.
  return false;
}

export function isAppLockEnabled(): boolean {
  return mmkvStorage.getBoolean('app_lock_enabled') ?? false;
}

export async function getAppLockPIN(): Promise<string | null> {
  return mmkvStorage.getItem('app_lock_pin');
}

export async function setAppLockPIN(pin: string): Promise<void> {
  await mmkvStorage.setItem('app_lock_pin', encodePin(pin));
  mmkvStorage.setBoolean('app_lock_enabled', true);
}

export async function disableAppLock(): Promise<void> {
  await mmkvStorage.removeItem('app_lock_pin');
  mmkvStorage.setBoolean('app_lock_enabled', false);
}

export async function verifyPIN(input: string): Promise<boolean> {
  const stored = await mmkvStorage.getItem('app_lock_pin');
  if (stored === null) return false;
  const ok = verifyPinAgainstStored(input, stored);
  if (ok && !stored.startsWith('v2:')) {
    // Migrate legacy hash to salted format on successful verify.
    await mmkvStorage.setItem('app_lock_pin', encodePin(input));
  }
  return ok;
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    return await biometrics.simplePrompt('Unlock Chatterbox');
  } catch {
    return false;
  }
}

export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    return await biometrics.isSensorAvailable();
  } catch {
    return false;
  }
}

export function setBiometricsEnabled(enabled: boolean): void {
  mmkvStorage.setBoolean('biometrics_enabled', enabled);
}

export function isBiometricsEnabled(): boolean {
  return mmkvStorage.getBoolean('biometrics_enabled') ?? false;
}

export async function setChatLockPIN(chatId: string, pin: string): Promise<void> {
  await mmkvStorage.setItem(`chat_lock_${chatId}`, encodePin(pin));
  mmkvStorage.setBoolean(`chat_locked_${chatId}`, true);
}

export async function removeChatLock(chatId: string): Promise<void> {
  await mmkvStorage.removeItem(`chat_lock_${chatId}`);
  mmkvStorage.setBoolean(`chat_locked_${chatId}`, false);
}

export function isChatLocked(chatId: string): boolean {
  return mmkvStorage.getBoolean(`chat_locked_${chatId}`) ?? false;
}

export async function verifyChatPIN(chatId: string, input: string): Promise<boolean> {
  const stored = await mmkvStorage.getItem(`chat_lock_${chatId}`);
  if (stored === null) return false;
  const ok = verifyPinAgainstStored(input, stored);
  if (ok && !stored.startsWith('v2:')) {
    await mmkvStorage.setItem(`chat_lock_${chatId}`, encodePin(input));
  }
  return ok;
}

export function isDecoyMode(): boolean {
  return mmkvStorage.getBoolean('decoy_active') ?? false;
}

export function setDecoyMode(active: boolean): void {
  mmkvStorage.setBoolean('decoy_active', active);
}

export async function getDecoyPIN(): Promise<string | null> {
  return mmkvStorage.getItem('decoy_pin');
}

export async function setDecoyPIN(pin: string): Promise<void> {
  await mmkvStorage.setItem('decoy_pin', encodePin(pin));
}

export async function isDecoyPIN(input: string): Promise<boolean> {
  const stored = await mmkvStorage.getItem('decoy_pin');
  if (stored === null) return false;
  return verifyPinAgainstStored(input, stored);
}
