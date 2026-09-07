/**
 * Local storage, split by how sensitive the contents are.
 *
 * ## The problem this file used to have
 *
 * There was one encrypted store, and its encryption key sat in a second,
 * *unencrypted* store right beside it. Anything able to read the app's private
 * directory — forensic extraction, a rooted or jailbroken device, a backup —
 * could read the key and then everything the key protected, which included
 * every cached message in plaintext. The encryption was real but its key was
 * lying next to the lock.
 *
 * ## Why this is a split rather than a one-line change
 *
 * The obvious fix is to keep the key in the OS key store. The obstacle is that
 * MMKV needs its encryption key *synchronously*, at the moment the store is
 * created, and every key store on both platforms is asynchronous. So a
 * Keychain-backed store cannot be a synchronous module-scope singleton, and
 * this module exported synchronous accessors used from React render paths,
 * where they cannot become async without a state variable in each caller.
 *
 * What made a clean answer possible is that those synchronous accessors turned
 * out to handle only booleans and numbers — thirteen user preferences like
 * "screenshot protection on" and "auto-lock delay". None of them is a secret.
 * Everything genuinely sensitive — cached message text, drafts, the app-lock
 * PIN hash, the peer-key trust baseline — was already reached through the
 * async API.
 *
 * So the boundary already existed; this makes it explicit:
 *
 *   - **{@link prefs}** — synchronous, unencrypted, and holds only settings.
 *     No key to protect, because there is nothing here worth protecting.
 *   - **{@link secureStore}** — asynchronous, encrypted with a key held in the
 *     Keychain/Keystore, and holds everything else.
 *
 * The important property is that this is enforced by the shape of the API
 * rather than by a rule someone has to remember: a secret cannot be read
 * synchronously because there is no synchronous way to reach the store it
 * lives in. There is no initialization ordering to get wrong and no window
 * during which a read returns the wrong answer, which is what a single lazily
 * initialized store would have required.
 *
 * ## Degrading
 *
 * On a build where the key store is absent — most often one that has not been
 * rebuilt since the native module was added — the secure store falls back to
 * the old bootstrap key. That is exactly today's behaviour, so this is safe to
 * ship ahead of a native rebuild. It never leaves the user without a readable
 * store, because losing the key means losing every cached message and, worse,
 * a store that cannot be opened at all.
 */
import {createMMKV} from 'react-native-mmkv';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, generateKeyHex, utf8ToBytes} from './crypto';
import {getSecret, isSecureStoreAvailable, setSecretVerified} from './secureKeyStore';
import {reportError} from './errorLog';

const logError = (context: string, error: unknown) => {
  if (__DEV__) {
    console.error(`[MMKV] ${context}:`, error);
  }
};

type Store = ReturnType<typeof createMMKV>;

/** Key store entry holding the secure store's encryption key. */
const MMKV_KEY_SERVICE = 'com.chatterbox.mmkv.encryptionKey';

const SECURE_STORE_ID = 'chatterbox-storage';
const PREFS_STORE_ID = 'chatterbox-prefs';
const BOOTSTRAP_STORE_ID = 'chatterbox-bootstrap';
const ENC_KEY_STORAGE = 'enc_key';

/**
 * Legacy home of the encryption key: unencrypted, and the whole reason this
 * file was rewritten. Still read, because an existing install has its key here
 * and nowhere else, and still written on builds with no key store.
 */
const bootstrap = createMMKV({id: BOOTSTRAP_STORE_ID});

/**
 * The preference keys, which is to say every key the synchronous API may
 * touch. Nothing here is a secret; the list is exhaustive and closed, so
 * adding a synchronous accessor for something sensitive requires editing this
 * and noticing what you are doing.
 */
const PREF_KEYS: ReadonlySet<string> = new Set([
  'app_lock_enabled',
  'auto_lock_delay',
  'biometrics_enabled',
  'decoy_active',
  'hide_notification_content',
  'link_preview_enabled',
  'read_receipts',
  'screenshot_alert',
  'screenshot_protection',
  'stealth_mode',
  'strip_exif',
  'tutorial_seen_v1',
  'typing_indicator',
  'watermark_enabled',
]);

/** Per-chat lock flags, which are generated rather than enumerable. */
const PREF_PREFIXES: readonly string[] = ['chat_locked_'];

function isPrefKey(key: string): boolean {
  return PREF_KEYS.has(key) || PREF_PREFIXES.some(prefix => key.startsWith(prefix));
}

const prefs = createMMKV({id: PREFS_STORE_ID});

/**
 * Best-effort entropy for the rare case generateKeyHex() itself is unavailable
 * (e.g. the native RNGetRandomValues module isn't linked into this build).
 * Weaker than a real CSPRNG, but this only runs on that failure path — see the
 * try/catch below — and reportError() surfaces it so the gap doesn't go
 * unnoticed.
 *
 * SHA-256 is used to condense: it is pure JS, so it works on the path where
 * the native random module is what failed. This does not make the result
 * cryptographically secure — you cannot hash your way to entropy that was
 * never collected — but it stops the condensing step from destroying what
 * little there was.
 */
function fallbackWeakKeyHex(): string {
  const draws: string[] = [`${Date.now()}`, `${globalThis.performance?.now?.() ?? 0}`];
  for (let i = 0; i < 32; i++) draws.push(`${Math.random()}`, `${Date.now()}`);
  return bytesToHex(sha256(utf8ToBytes(draws.join(':'))));
}

function freshKeyHex(): string {
  try {
    return generateKeyHex();
  } catch (error) {
    logError('generateKeyHex unavailable, using degraded fallback key', error);
    reportError(error, 'mmkv_encryption_key_fallback');
    return fallbackWeakKeyHex();
  }
}

/**
 * Moves preferences out of the legacy store on an upgraded install.
 *
 * Runs synchronously at module load, and can, because on an install that
 * predates this change the legacy key is still sitting in the bootstrap store
 * where anyone could read it — including us. That is the one moment the old
 * store can be opened without awaiting anything, so it is when the settings
 * have to be copied: doing it from the async path instead would leave every
 * preference reading as its default until that path finished, silently
 * turning screenshot protection off for the first moments after an upgrade.
 *
 * Copy, never move. The legacy entries are left where they are so that a
 * downgrade, or an interrupted migration, still finds them.
 */
function migratePrefsFromLegacy(): void {
  try {
    const legacyKey = bootstrap.getString(ENC_KEY_STORAGE);
    if (!legacyKey) return;

    const legacy = createMMKV({id: SECURE_STORE_ID, encryptionKey: legacyKey});
    for (const key of legacy.getAllKeys()) {
      if (!isPrefKey(key)) continue;
      // Already migrated on an earlier launch. Not overwritten, because the
      // user may have changed the setting since.
      if (prefs.contains(key)) continue;

      const asBoolean = legacy.getBoolean(key);
      if (asBoolean !== undefined) {
        prefs.set(key, asBoolean);
        continue;
      }
      const asNumber = legacy.getNumber(key);
      if (asNumber !== undefined) prefs.set(key, asNumber);
    }
  } catch (error) {
    // A failure here costs the user their settings, not their data. Reported,
    // but never allowed to prevent the app from starting.
    logError('preference migration failed', error);
    reportError(error, 'mmkv_prefs_migration_failed');
  }
}

migratePrefsFromLegacy();

let secureStore: Store | null = null;
let opening: Promise<Store> | null = null;

/**
 * Opens the secure store, moving its key into the key store the first time.
 *
 * ## The key is moved, never changed
 *
 * The obvious design — generate a new key, re-encrypt the store to it, delete
 * the old one — has a window that destroys data. The store's key and the
 * record of what that key is cannot be changed atomically, so a process killed
 * between the two leaves a store encrypted under one key and a record naming
 * another, and the next launch opens a file it cannot read. Both orderings
 * have such a window; only the size differs.
 *
 * Migrating the *existing* key verbatim has no window at all, because there is
 * never a moment when the recorded key is not the store's key. A crash after
 * the copy but before the delete leaves both copies of the same value, and the
 * next launch finds the key store copy, opens the store correctly, and deletes
 * the stale one. This is the same rule the E2EE identity key follows
 * (services/e2eeKeys.ts): migration only ever *adds* a copy, and the old
 * location is cleared only after the new one has been read back.
 *
 * What it does not do is give existing installs a fresh key. That is the
 * accepted trade: this protects the key against future extraction, which is
 * the threat, and a device whose key already leaked is already compromised in
 * a way no rotation here undoes.
 */
async function openSecureStore(): Promise<Store> {
  const legacyKey = bootstrap.getString(ENC_KEY_STORAGE);

  if (!isSecureStoreAvailable()) {
    // No key store on this build. Behave exactly as before it existed.
    const key = legacyKey ?? freshKeyHex();
    if (!legacyKey) bootstrap.set(ENC_KEY_STORAGE, key);
    return createMMKV({id: SECURE_STORE_ID, encryptionKey: key});
  }

  const stored = await getSecret(MMKV_KEY_SERVICE);
  if (stored) {
    const store = createMMKV({id: SECURE_STORE_ID, encryptionKey: stored});
    // A copy left in the unencrypted store by an interrupted earlier run. It
    // holds the same value, so nothing depends on it — and removing it is the
    // entire point of this change, so it does not wait for a later launch.
    if (legacyKey) bootstrap.remove(ENC_KEY_STORAGE);
    return store;
  }

  // Existing install: adopt the key it already has. Nothing is re-encrypted,
  // so there is no state in which the store and the record disagree.
  const key = legacyKey ?? freshKeyHex();
  if (await setSecretVerified(MMKV_KEY_SERVICE, key)) {
    const store = createMMKV({id: SECURE_STORE_ID, encryptionKey: key});
    bootstrap.remove(ENC_KEY_STORAGE);
    return store;
  }

  // The key store accepted nothing, or handed back something else. Keep using
  // the unencrypted copy: a key recorded only where it cannot be retrieved
  // makes the store unopenable on the next launch, which is worse than the
  // weaker storage this was meant to replace.
  reportError(new Error('mmkv key store write unverified'), 'mmkv_key_store_unverified');
  bootstrap.set(ENC_KEY_STORAGE, key);
  return createMMKV({id: SECURE_STORE_ID, encryptionKey: key});
}

/**
 * The secure store, opened once. Concurrent callers share one open.
 *
 * Never rejects: a store that fails to open falls back to an unencrypted one
 * rather than taking down every caller, because the alternative is an app that
 * cannot read its own settings or queue a message.
 */
async function ready(): Promise<Store> {
  if (secureStore) return secureStore;
  if (!opening) {
    opening = openSecureStore()
      .catch(error => {
        logError('secure store unavailable', error);
        reportError(error, 'mmkv_secure_store_open_failed');
        return createMMKV({id: SECURE_STORE_ID});
      })
      .then(store => {
        secureStore = store;
        return store;
      });
  }
  return opening;
}

/**
 * Opens the secure store ahead of first use.
 *
 * Purely an optimisation — every async accessor awaits the same open — but
 * worth doing at startup so the first cached-message read is not also paying
 * for a key store round trip. Never throws.
 */
export async function warmSecureStorage(): Promise<void> {
  await ready();
}

export const mmkvStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return (await ready()).getString(key) ?? null;
    } catch (error) {
      logError(`getItem error for key "${key}"`, error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      (await ready()).set(key, value);
    } catch (error) {
      logError(`setItem error for key "${key}"`, error);
      throw error;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      (await ready()).remove(key);
    } catch (error) {
      logError(`removeItem error for key "${key}"`, error);
      throw error;
    }
  },

  getAllKeys: async (): Promise<string[]> => {
    try {
      return (await ready()).getAllKeys();
    } catch (error) {
      logError('getAllKeys error', error);
      return [];
    }
  },

  /**
   * Wipes both stores. Used by sign-out and account deletion, which mean "no
   * trace of this account on this device", so the preferences go too.
   *
   * The encryption key is deliberately left alone. Deleting it would leave a
   * store on disk still encrypted under a key nothing holds, so signing back
   * in would land on a file that cannot be opened; rotating it would mean
   * re-encrypting and recording the new key non-atomically, which is the
   * window openSecureStore is written to avoid. The data is already gone, so
   * the key protects nothing either way — the only thing left to get wrong
   * here is the store's usability.
   */
  clear: async (): Promise<void> => {
    try {
      (await ready()).clearAll();
      prefs.clearAll();
    } catch (error) {
      logError('clear error', error);
      throw error;
    }
  },

  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    try {
      const store = await ready();
      return keys.map(key => [key, store.getString(key) ?? null]);
    } catch (error) {
      logError('multiGet error', error);
      return keys.map(key => [key, null]);
    }
  },

  multiSet: async (pairs: [string, string][]): Promise<void> => {
    try {
      const store = await ready();
      pairs.forEach(([key, value]) => store.set(key, value));
    } catch (error) {
      logError('multiSet error', error);
      throw error;
    }
  },

  multiRemove: async (keys: string[]): Promise<void> => {
    try {
      const store = await ready();
      keys.forEach(key => store.remove(key));
    } catch (error) {
      logError('multiRemove error', error);
      throw error;
    }
  },

  // ── Synchronous accessors ────────────────────────────────────────────────
  //
  // These read the preferences store, which is unencrypted. They are
  // synchronous because they are called from React render paths, and they are
  // limited to settings because anything synchronous is by definition
  // reachable before a key store round trip could have finished.
  //
  // A key outside PREF_KEYS is refused rather than quietly written to the
  // unencrypted store: silently storing a secret in the clear is the failure
  // this whole split exists to prevent, and it would look identical to working
  // code.

  getBoolean: (key: string): boolean | undefined => {
    try {
      assertPrefKey(key, 'getBoolean');
      return prefs.getBoolean(key);
    } catch (error) {
      logError(`getBoolean error for key "${key}"`, error);
      return undefined;
    }
  },

  setBoolean: (key: string, value: boolean): void => {
    try {
      assertPrefKey(key, 'setBoolean');
      prefs.set(key, value);
    } catch (error) {
      logError(`setBoolean error for key "${key}"`, error);
      throw error;
    }
  },

  getNumber: (key: string): number | undefined => {
    try {
      assertPrefKey(key, 'getNumber');
      return prefs.getNumber(key);
    } catch (error) {
      logError(`getNumber error for key "${key}"`, error);
      return undefined;
    }
  },

  setNumber: (key: string, value: number): void => {
    try {
      assertPrefKey(key, 'setNumber');
      prefs.set(key, value);
    } catch (error) {
      logError(`setNumber error for key "${key}"`, error);
      throw error;
    }
  },

  remove: (key: string): void => {
    try {
      assertPrefKey(key, 'remove');
      prefs.remove(key);
    } catch (error) {
      logError(`remove error for key "${key}"`, error);
    }
  },
};

function assertPrefKey(key: string, method: string): void {
  if (isPrefKey(key)) return;
  throw new Error(
    `storageMMKV.${method}: "${key}" is not a declared preference. The synchronous ` +
      'API writes to an unencrypted store; use the async API for anything else, or ' +
      'add the key to PREF_KEYS if it really is a setting.',
  );
}

export default mmkvStorage;
