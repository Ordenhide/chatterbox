import {scryptAsync} from '@noble/hashes/scrypt.js';
import {mmkvStorage} from './storageMMKV';
import {SCRYPT_PARAMS, bytesToHex, hexToBytes, secureRandomBytes, utf8ToBytes} from './crypto';
import * as biometrics from './biometrics';

/**
 * ## Why a memory-hard KDF, and not the FNV-1a construction this replaced
 *
 * PINs are a tiny keyspace — a 4-digit PIN is 10,000 candidates — so the *only*
 * thing standing between a stored hash and the PIN itself is how long each
 * guess takes. That makes the KDF's cost the whole security property, not a
 * detail.
 *
 * The previous version ran 10,000 rounds of FNV-1a, justified in a comment
 * claiming no native crypto was available in Hermes. That was simply untrue:
 * `crypto.ts` has imported scrypt from `@noble/hashes` — pure JS, no native
 * module — since the backup-passphrase work, and this file already imported
 * from `crypto.ts` for its salt. So the weaker primitive bought nothing.
 *
 * It cost a great deal. FNV-1a is a non-cryptographic hash with 32 bits of
 * internal state, so the two interleaved chains carried at most 64 bits
 * between them however many rounds ran, and each round is a multiply and an
 * xor — the full 10,000 finish in well under a millisecond. Recovering a
 * 6-digit PIN from a stolen hash was a sub-second exhaustive search.
 *
 * scrypt at the same parameters the backup passphrase uses (N=2^15, ~32 MB,
 * ~100 ms) turns that same search into days of work on hardware that has to
 * hold 32 MB per guess, which is exactly the asymmetry a PIN needs.
 *
 * ## Why this matters beyond the lock screen
 *
 * The threat model is the one the Keychain migration addresses: someone with
 * the device's files. A PIN that can be recovered offline in under a second
 * is a UI lock and nothing more, so the cost of a guess is the whole point.
 *
 * A per-chat PIN and a decoy PIN used to live here too. Both were unreachable
 * behind the parity flag and were removed with it — the decoy in particular
 * only emptied the chat list while leaving the data in place, which is not a
 * duress mode, it is the appearance of one.
 */

// Stored format: "v3:<salt-hex>:<scrypt-hex>". Verification still accepts the
// v2 (FNV) records already on devices, and rewrites them on first successful
// unlock — see verifyAndUpgrade. A user who never unlocks again keeps a weak
// record, but a weak record they alone can trigger is strictly better than
// invalidating a PIN the user has no other way to reset.
const CURRENT_VERSION = 'v3';

function randomSalt(): string {
  // Was Math.random(), which is not a CSPRNG — its output is predictable from
  // observed values, so salts generated close together were guessable. Salts
  // need not be secret, but a predictable one gives back exactly the
  // precomputation resistance the salt exists to provide. secureRandomBytes is
  // the same CSPRNG the E2EE keys already use.
  return bytesToHex(secureRandomBytes(16));
}

/** scryptAsync rather than the sync form: 32 MB of mixing blocks the JS thread
 * long enough to drop frames on the PIN screen, and every caller is async. */
async function scryptHash(salt: string, pin: string): Promise<string> {
  return bytesToHex(await scryptAsync(utf8ToBytes(pin), hexToBytes(salt), SCRYPT_PARAMS));
}

// --- legacy v2 verification only; never used to write a new record ----------

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function legacyStretchHash(salt: string, pin: string, rounds = 10_000): string {
  let state = salt + pin;
  let h1 = fnv1a(state);
  let h2 = fnv1a(pin + salt);
  for (let i = 0; i < rounds; i++) {
    h1 = fnv1a(h1.toString(36) + state + i.toString());
    h2 = fnv1a(h2.toString(36) + state.split('').reverse().join('') + i.toString());
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/**
 * Length-independent, content-constant-time string compare.
 *
 * `===` on hashes leaks how many leading characters matched through timing.
 * A weak channel locally, and cheap to close. It mattered more when a decoy
 * PIN lived here — timing that distinguished "wrong" from "decoy" would have
 * given away that a decoy existed — and it stays because the property is
 * worth keeping if that feature is ever built properly.
 */
function constantTimeEquals(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function encodePin(pin: string): Promise<string> {
  const salt = randomSalt();
  return `${CURRENT_VERSION}:${salt}:${await scryptHash(salt, pin)}`;
}

type VerifyResult = {ok: boolean; needsUpgrade: boolean};

async function verifyPinAgainstStored(input: string, stored: string): Promise<VerifyResult> {
  const [version, salt, hash] = stored.split(':');
  if (version === CURRENT_VERSION && salt && hash) {
    return {ok: constantTimeEquals(await scryptHash(salt, input), hash), needsUpgrade: false};
  }
  if (version === 'v2' && salt && hash) {
    // Correct PIN, obsolete record: report it so the caller can rewrite it at
    // v3 while it still holds the plaintext PIN to re-derive from.
    const ok = constantTimeEquals(legacyStretchHash(salt, input), hash);
    return {ok, needsUpgrade: ok};
  }
  // Pre-v2 (unsalted) — always reject and force re-set.
  return {ok: false, needsUpgrade: false};
}

/** Verifies `input` against the record at `storageKey`, transparently
 * re-hashing a legacy record at the current version on success. */
async function verifyAndUpgrade(storageKey: string, input: string): Promise<boolean> {
  const stored = await mmkvStorage.getItem(storageKey);
  if (stored === null) return false;
  const {ok, needsUpgrade} = await verifyPinAgainstStored(input, stored);
  if (ok && needsUpgrade) {
    await mmkvStorage.setItem(storageKey, await encodePin(input));
  }
  return ok;
}

export function isAppLockEnabled(): boolean {
  return mmkvStorage.getBoolean('app_lock_enabled') ?? false;
}

export async function setAppLockPIN(pin: string): Promise<void> {
  await mmkvStorage.setItem('app_lock_pin', await encodePin(pin));
  mmkvStorage.setBoolean('app_lock_enabled', true);
}

export async function disableAppLock(): Promise<void> {
  await mmkvStorage.removeItem('app_lock_pin');
  mmkvStorage.setBoolean('app_lock_enabled', false);
}

export async function verifyPIN(input: string): Promise<boolean> {
  return verifyAndUpgrade('app_lock_pin', input);
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
