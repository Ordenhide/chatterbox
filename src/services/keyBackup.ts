/**
 * The E2EE key's automatic restore on a new device.
 *
 * Recovery has always been the 24-word phrase, which is the key itself
 * (e2eeMnemonic.ts) and therefore cannot be made shorter without making the
 * key weaker. This is the other way of shortening it: not a smaller secret,
 * but one the platform carries across for the user so there is nothing to
 * type at all — iCloud Keychain on iOS, Block Store on Android.
 *
 * ## Deliberately separate from secureKeyStore
 *
 * That module holds the working copy and pins it to the device on purpose —
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, `cloudSync: false`, and a comment
 * explaining that the point is to stop the key following the account onto
 * hardware the user never enrolled. This module is the scoped exception to
 * exactly that, so it lives in its own file under its own service name rather
 * than flipping those flags and silently overwriting the reasoning behind
 * them. Both entries hold the same secret; keeping them apart keeps the two
 * decisions legible.
 *
 * ## What the platform can read
 *
 * iOS: iCloud Keychain is end-to-end encrypted — Apple cannot read it.
 * Reaching it needs the user's Apple ID plus a trusted device or its passcode.
 *
 * Android: Block Store's cloud copy is end-to-end encrypted only when the
 * device has a screen lock. Without one the blob is still encrypted but Google
 * holds the key, so KeyBackupModule sets `shouldBackupToCloud` from whether a
 * lock is present, and this module reports `local-only` for that case. A
 * local-only entry is still worth writing: Block Store also serves
 * device-to-device transfer during setup, where the bytes never leave the two
 * phones.
 *
 * ## This does not replace the phrase
 *
 * Every function here answers "unavailable" rather than throwing, and the
 * caller falls back to asking for the phrase. The phrase prompt, and the
 * prompt to write the phrase down, are unchanged. That matters more than
 * usual because the step this exists for — the restore onto a genuinely new
 * device — cannot be exercised on an emulator, so it ships less tested than
 * the path it is trying to save the user from.
 */
import {Platform} from 'react-native';
import {reportHandled} from './telemetry';

/** Namespace, kept distinct per account and distinct from the working copy. */
const SERVICE_PREFIX = 'com.chatterbox.e2ee.recovery';

export function backupService(userId: string): string {
  return `${SERVICE_PREFIX}.${userId}`;
}

export type BackupAvailability =
  /** No platform store on this build — the phrase is the only recovery. */
  | 'unavailable'
  /** Stored, but not synced to the cloud: device-to-device transfer only. */
  | 'local-only'
  /** Stored and carried to the user's next device, end-to-end encrypted. */
  | 'cloud';

type KeychainModule = {
  setGenericPassword: (
    username: string,
    password: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  getGenericPassword: (
    options?: Record<string, unknown>,
  ) => Promise<{password: string} | false>;
  resetGenericPassword: (options?: Record<string, unknown>) => Promise<boolean>;
  ACCESSIBLE?: Record<string, string>;
};

type BlockStoreModule = {
  isCloudBackupSafe: () => Promise<boolean>;
  store: (key: string, value: string) => Promise<boolean>;
  retrieve: (key: string) => Promise<string | null>;
  remove: (key: string) => Promise<boolean>;
};

/**
 * Both native sides are resolved lazily and checked for the methods actually
 * called, for the reason secureKeyStore gives: a linked-but-broken module is
 * worse than an absent one, because a caller would trust it with the key.
 */
let keychainResolved: KeychainModule | null | undefined;
let blockStoreResolved: BlockStoreModule | null | undefined;

function keychain(): KeychainModule | null {
  if (keychainResolved !== undefined) return keychainResolved;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-keychain') as KeychainModule;
    keychainResolved =
      mod &&
      typeof mod.setGenericPassword === 'function' &&
      typeof mod.getGenericPassword === 'function' &&
      typeof mod.resetGenericPassword === 'function'
        ? mod
        : null;
  } catch {
    keychainResolved = null;
  }
  return keychainResolved;
}

function blockStore(): BlockStoreModule | null {
  if (blockStoreResolved !== undefined) return blockStoreResolved;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {NativeModules} = require('react-native');
    const mod = NativeModules?.KeyBackup as BlockStoreModule | undefined;
    blockStoreResolved =
      mod &&
      typeof mod.store === 'function' &&
      typeof mod.retrieve === 'function' &&
      typeof mod.remove === 'function'
        ? mod
        : null;
  } catch {
    blockStoreResolved = null;
  }
  return blockStoreResolved;
}

/**
 * iOS write options — the mirror image of secureKeyStore's, and every
 * difference is the point of this module.
 *
 * `cloudSync: true` puts the entry in iCloud Keychain. The accessibility
 * constant must not be a THIS_DEVICE_ONLY one: those are precisely the values
 * that exclude an item from syncing, so pairing them with cloudSync would
 * produce an entry that looks backed up and is not.
 */
function iosWriteOptions(service: string): Record<string, unknown> {
  const mod = keychain();
  const accessible = mod?.ACCESSIBLE?.WHEN_UNLOCKED;
  return {
    service,
    cloudSync: true,
    ...(accessible ? {accessible} : null),
  };
}

export async function backupAvailability(): Promise<BackupAvailability> {
  if (Platform.OS === 'android') {
    const mod = blockStore();
    if (!mod) return 'unavailable';
    try {
      return (await mod.isCloudBackupSafe()) ? 'cloud' : 'local-only';
    } catch (error) {
      reportHandled(error, 'key_backup_availability_failed');
      return 'local-only';
    }
  }
  if (Platform.OS === 'ios') {
    return keychain() ? 'cloud' : 'unavailable';
  }
  return 'unavailable';
}

/**
 * Stores the recovery phrase for `userId`. Returns whether it was stored.
 *
 * The phrase rather than the raw key, so restoring goes back through
 * restoreDeviceKeypairFromPhrase and gets the same checks a typed phrase
 * gets — including the comparison against the published key, which is what
 * stops a stale backup from quietly replacing a newer identity.
 */
export async function saveRecoveryPhrase(userId: string, phrase: string): Promise<boolean> {
  if (!userId || !phrase) return false;
  const service = backupService(userId);
  try {
    if (Platform.OS === 'android') {
      const mod = blockStore();
      if (!mod) return false;
      await mod.store(service, phrase);
      return true;
    }
    if (Platform.OS === 'ios') {
      const mod = keychain();
      if (!mod) return false;
      await mod.setGenericPassword('e2ee-recovery', phrase, iosWriteOptions(service));
      return true;
    }
    return false;
  } catch (error) {
    // Handled, not reported as an error: a device that cannot back up is a
    // supported state, and the phrase prompt still covers the user. Silence
    // would be wrong for the opposite reason — it is the only way to find out
    // that automatic restore is failing in the field.
    reportHandled(error, 'key_backup_save_failed');
    return false;
  }
}

/** The stored phrase for `userId`, or null when there is none to restore from. */
export async function loadRecoveryPhrase(userId: string): Promise<string | null> {
  if (!userId) return null;
  const service = backupService(userId);
  try {
    if (Platform.OS === 'android') {
      const mod = blockStore();
      if (!mod) return null;
      const value = await mod.retrieve(service);
      return value || null;
    }
    if (Platform.OS === 'ios') {
      const mod = keychain();
      if (!mod) return null;
      const result = await mod.getGenericPassword({service, cloudSync: true});
      return result && result.password ? result.password : null;
    }
    return null;
  } catch (error) {
    reportHandled(error, 'key_backup_load_failed');
    return null;
  }
}

/**
 * Removes the backup. Called on sign-out and on account deletion, so an
 * account's key does not sit in the platform store of a device it has been
 * signed out of, waiting to restore itself for whoever signs in next.
 */
export async function clearRecoveryPhrase(userId: string): Promise<void> {
  if (!userId) return;
  const service = backupService(userId);
  try {
    if (Platform.OS === 'android') {
      await blockStore()?.remove(service);
      return;
    }
    if (Platform.OS === 'ios') {
      await keychain()?.resetGenericPassword({service, cloudSync: true});
    }
  } catch (error) {
    reportHandled(error, 'key_backup_clear_failed');
  }
}

/** Test seam: forgets the resolved native modules. */
export function _resetKeyBackupModules(): void {
  keychainResolved = undefined;
  blockStoreResolved = undefined;
}
