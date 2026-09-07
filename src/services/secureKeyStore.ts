/**
 * The OS-backed secret store — iOS Keychain / Android Keystore.
 *
 * Exists for one value: the E2EE device secret key. That key is the user's
 * cryptographic identity, and it lived in the MMKV store, whose own
 * encryption key sits in an *unencrypted* bootstrap store beside it (see
 * storageMMKV.ts). Anything that can read the app's private directory —
 * physical forensics on a rooted or jailbroken device — therefore gets the
 * bootstrap key, then the store, then the identity. The Keychain/Keystore is
 * the platform's answer to exactly that: hardware-backed where available, and
 * not readable by simply lifting files out of the sandbox.
 *
 * Scoped deliberately to that one key rather than to all of MMKV. Moving the
 * whole store would mean turning a synchronous module-scope singleton, which
 * 17 files import and some use during module evaluation, into an async one —
 * a large refactor across the app for the sake of cached messages, which the
 * server already holds (encrypted) anyway. The identity key is the part worth
 * protecting, and its read path (e2eeKeys.ts) was already async.
 *
 * ## Availability is not assumed
 *
 * `react-native-keychain` is a native module, so it is absent until the app
 * is rebuilt (pod install / gradle sync), and absent entirely on HarmonyOS
 * (see ./secureKeyStore.harmony.ts). Every function here answers "unavailable"
 * rather than throwing in that case, and the caller keeps its existing MMKV
 * behaviour — so this file is safe to ship ahead of the native rebuild, and
 * a device where the Keychain genuinely misbehaves degrades instead of losing
 * the user's identity.
 */
import {reportError} from './errorLog';

/** Namespace for the one secret this stores, kept distinct per account. */
const SERVICE_PREFIX = 'com.chatterbox.e2ee.secretKey';

export function secretKeyService(userId: string): string {
  return `${SERVICE_PREFIX}.${userId}`;
}

type KeychainModule = {
  setGenericPassword: (
    username: string,
    password: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  getGenericPassword: (
    options?: Record<string, unknown>,
  ) => Promise<false | {password: string}>;
  resetGenericPassword: (options?: Record<string, unknown>) => Promise<boolean>;
  ACCESSIBLE?: Record<string, string>;
};

/**
 * Resolved once, lazily, and never allowed to throw.
 *
 * A bare top-level import would crash at module-evaluation time — before
 * React, and before ErrorBoundary, can mount — on any build where the native
 * side isn't linked yet. `undefined` here means "no secure store on this
 * build", which every caller already handles.
 */
let resolved: KeychainModule | null | undefined;

function keychain(): KeychainModule | null {
  if (resolved !== undefined) return resolved;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-keychain') as KeychainModule;
    // A linked-but-broken module is worse than an absent one, because callers
    // would trust it with the only copy of the key. Require the three
    // functions actually used before declaring it usable.
    resolved =
      mod &&
      typeof mod.setGenericPassword === 'function' &&
      typeof mod.getGenericPassword === 'function' &&
      typeof mod.resetGenericPassword === 'function'
        ? mod
        : null;
  } catch {
    resolved = null;
  }
  return resolved;
}

export function isSecureStoreAvailable(): boolean {
  return keychain() !== null;
}

/**
 * Options applied to every write.
 *
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` on purpose, and both halves matter:
 * THIS_DEVICE_ONLY keeps the key out of iCloud Keychain and out of encrypted
 * device backups, so it cannot follow the account onto hardware the user
 * never enrolled; WHEN_UNLOCKED means it is unreadable while the phone is
 * locked, which is the state a seized device is usually in. `cloudSync: false`
 * says the same thing again through the library's own flag rather than
 * relying on the accessibility constant alone.
 */
function writeOptions(service: string): Record<string, unknown> {
  const mod = keychain();
  const accessible = mod?.ACCESSIBLE?.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
  return {
    service,
    cloudSync: false,
    ...(accessible ? {accessible} : null),
  };
}

/** The stored secret for `service`, or null if absent or unreadable. */
export async function getSecret(service: string): Promise<string | null> {
  const mod = keychain();
  if (!mod) return null;
  try {
    const result = await mod.getGenericPassword({service});
    return result && result.password ? result.password : null;
  } catch (error) {
    // Reported rather than swallowed: on a device where the store has become
    // unreadable, the caller silently falls back to MMKV and the user notices
    // nothing — which is the right behaviour, and exactly why it needs to be
    // visible here instead.
    reportError(error, 'secure_store_read_failed');
    return null;
  }
}

/**
 * Writes `secret`, and returns whether it is *readable afterwards*.
 *
 * The read-back is the point. Callers use this to decide whether it is safe
 * to delete their existing copy, and "the write resolved" is a weaker claim
 * than "the value can be retrieved" — a keychain that accepts a write and
 * returns nothing on read would otherwise destroy the user's only copy of
 * their identity key.
 */
export async function setSecretVerified(service: string, secret: string): Promise<boolean> {
  const mod = keychain();
  if (!mod) return false;
  try {
    await mod.setGenericPassword('e2ee', secret, writeOptions(service));
  } catch (error) {
    reportError(error, 'secure_store_write_failed');
    return false;
  }
  return (await getSecret(service)) === secret;
}

export async function removeSecret(service: string): Promise<void> {
  const mod = keychain();
  if (!mod) return;
  try {
    await mod.resetGenericPassword({service});
  } catch (error) {
    reportError(error, 'secure_store_remove_failed');
  }
}
