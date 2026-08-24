/**
 * Sign in with Apple.
 *
 * ## Why it has to exist
 *
 * Apple's App Store guideline 4.8 requires an equivalent privacy-preserving
 * login option in any app that offers third-party sign-in. This app offers
 * Google, so on iOS this is not a feature choice — a submission without it is
 * rejected.
 *
 * ## The nonce is the whole security story
 *
 * Apple returns a signed identity token asserting who the user is. That token
 * is a bearer credential: anyone who obtains one can present it to Firebase
 * and be signed in as its subject. The defence is a nonce, and it only works
 * if it is used exactly as designed:
 *
 *   1. draw a fresh random value — the *raw* nonce;
 *   2. send Apple `SHA256(raw)`, so what crosses the wire is the digest;
 *   3. Apple embeds that digest in the token it signs;
 *   4. hand Firebase the token *and the raw nonce*, and Firebase re-hashes it
 *      and checks the two agree.
 *
 * A token captured from someone else's session is then useless, because
 * replaying it requires the raw nonce, which never left this device. Skipping
 * the nonce, or passing the same value in both places, produces a flow that
 * works perfectly in testing and accepts replayed tokens in production. That
 * is the single most common way this integration is got wrong, which is why
 * {@link appleNonce} is a separate, tested function rather than three lines
 * inlined into the sign-in call.
 *
 * ## Loading the native module
 *
 * Required through a guarded `require` rather than imported. The module is
 * native, so it only exists once `pod install` has run and the app has been
 * rebuilt; a static import would turn a not-yet-rebuilt checkout into a crash
 * at startup rather than a button that reports itself unavailable. It also
 * keeps this file compiling and testable without the pod present.
 */
import {Platform} from 'react-native';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, secureRandomBytes} from './crypto';

/** Bytes of randomness behind the raw nonce. 32 is Apple's recommendation. */
const NONCE_BYTES = 32;

export type AppleNonce = {
  /** Kept on this device and handed to Firebase. Never sent to Apple. */
  raw: string;
  /** Sent to Apple, who embeds it in the signed token. */
  hashed: string;
};

/**
 * A fresh nonce pair.
 *
 * The hash must be over the *textual* raw nonce, not the bytes behind it:
 * Firebase hashes the string it is given, so hashing anything else here
 * produces a digest that will never match and every sign-in fails with an
 * invalid-credential error that looks nothing like its cause.
 */
export function appleNonce(): AppleNonce {
  const raw = bytesToHex(secureRandomBytes(NONCE_BYTES));
  return {raw, hashed: bytesToHex(sha256(new TextEncoder().encode(raw)))};
}

/** The slice of the native module this app uses. */
type AppleAuthModule = {
  isSupported: boolean;
  performRequest(options: unknown): Promise<{
    identityToken: string | null;
    nonce: string | null;
    fullName?: {givenName?: string | null; familyName?: string | null} | null;
    email?: string | null;
  }>;
  Operation: {LOGIN: unknown};
  Scope: {EMAIL: unknown; FULL_NAME: unknown};
};

let cached: AppleAuthModule | null | undefined;

function nativeModule(): AppleAuthModule | null {
  if (cached !== undefined) return cached;
  try {
    const mod = require('@invertase/react-native-apple-authentication');
    cached = (mod?.appleAuth ?? mod?.default ?? null) as AppleAuthModule | null;
  } catch {
    // Pod not installed, or a platform without it. Reported as unavailable.
    cached = null;
  }
  return cached;
}

/**
 * Whether this build can actually offer Apple sign-in.
 *
 * Three separate conditions, all of which have to hold: the right platform,
 * the native module linked, and a new enough iOS. The button is hidden rather
 * than shown-and-failing, because "Sign in with Apple" that errors on tap is
 * worse for a review than its absence on a platform that does not require it.
 */
export function isAppleSignInAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  const mod = nativeModule();
  return !!mod && mod.isSupported === true;
}

export type AppleCredential = {
  identityToken: string;
  rawNonce: string;
  /**
   * Apple sends the name **only on the very first authorization** for a given
   * app/account pair, and null every time after — including after a
   * reinstall. A caller that does not persist it on first sight will never
   * get another chance, which is why it is surfaced here rather than quietly
   * dropped.
   */
  fullName: string | null;
  email: string | null;
};

/**
 * Runs the native Sign in with Apple sheet.
 *
 * Returns null when the user cancels — a cancellation is not an error and
 * must not be reported as one. Throws only for genuine failures.
 */
export async function requestAppleCredential(): Promise<AppleCredential | null> {
  const mod = nativeModule();
  if (!mod) throw new Error('apple-auth: native module unavailable');

  const nonce = appleNonce();
  const response = await mod.performRequest({
    requestedOperation: mod.Operation.LOGIN,
    // Order matters to the native API: FULL_NAME must come first.
    requestedScopes: [mod.Scope.FULL_NAME, mod.Scope.EMAIL],
    nonce: nonce.hashed,
  });

  // No token means the sheet was dismissed. The native module reports genuine
  // failures by throwing, so this is the cancel path.
  if (!response.identityToken) return null;

  return {
    identityToken: response.identityToken,
    rawNonce: nonce.raw,
    fullName: formatAppleName(response.fullName),
    email: response.email ?? null,
  };
}

/**
 * Joins Apple's split name into a display name, or null when there is nothing
 * usable. Null rather than an empty string so callers can tell "Apple gave no
 * name" from "the user's name is blank" and fall back accordingly.
 */
export function formatAppleName(
  name: {givenName?: string | null; familyName?: string | null} | null | undefined,
): string | null {
  if (!name) return null;
  const joined = [name.givenName, name.familyName].filter(Boolean).join(' ').trim();
  return joined.length > 0 ? joined : null;
}
