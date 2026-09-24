/**
 * Deletes the copy of the recovery phrase that versions up to 1.2.0 left in
 * the platform backup — Block Store on Android, iCloud Keychain on iOS.
 *
 * Those versions saved the phrase there on every sign-in so a new device could
 * restore the key without it being typed. That was written for accounts that
 * signed in by email and held a separate E2EE key. Once the phrase became the
 * account (anonymousIdentity.ts), signing in on a new device already means
 * typing it, and the stored copy restored nothing — while putting the whole
 * account in the user's Google or Apple backup, with no setting to stop it.
 *
 * So this module can only delete. There is deliberately no store or load:
 * `platformBackupIsWriteFree.test.ts` fails if either comes back.
 */
import {Platform} from 'react-native';
import {reportHandled} from './errorLog';

/** Namespace the old versions wrote under, kept distinct per account. */
const SERVICE_PREFIX = 'com.chatterbox.e2ee.recovery';

export function backupService(userId: string): string {
  return `${SERVICE_PREFIX}.${userId}`;
}

type KeychainModule = {
  resetGenericPassword: (options?: Record<string, unknown>) => Promise<boolean>;
};

type BlockStoreModule = {
  remove: (key: string) => Promise<boolean>;
};

let keychainResolved: KeychainModule | null | undefined;
let blockStoreResolved: BlockStoreModule | null | undefined;

function keychain(): KeychainModule | null {
  if (keychainResolved !== undefined) return keychainResolved;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-keychain') as KeychainModule;
    keychainResolved = mod && typeof mod.resetGenericPassword === 'function' ? mod : null;
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
    blockStoreResolved = mod && typeof mod.remove === 'function' ? mod : null;
  } catch {
    blockStoreResolved = null;
  }
  return blockStoreResolved;
}

/**
 * Removes this account's entry, if an older version left one. Runs on every
 * launch for a signed-in account (AuthContext) as well as on sign-out and
 * account deletion: an account already signed in never signs in again, so
 * waiting for a sign-in would leave the copy in place indefinitely.
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

/** Test seam — forgets which native modules were resolved. */
export function _resetKeyBackupModules(): void {
  keychainResolved = undefined;
  blockStoreResolved = undefined;
}
