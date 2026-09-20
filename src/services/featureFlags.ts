import {fetchAndActivate, getRemoteConfig, getValue} from './firebase/remoteConfig';

const remoteConfig = getRemoteConfig();
let initialized = false;

export async function initFeatureFlags() {
  if (initialized) return;
  if (__DEV__) {
    initialized = true;
    return;
  }
  // A property in RNFB 26, matching the Firebase JS SDK — the setDefaults()
  // function was removed.
  remoteConfig.defaultConfig = {
    feedback_enabled: true,
  };
  remoteConfig.settings = {
    minimumFetchIntervalMillis: 60 * 60 * 1000,
    // Required by RemoteConfigSettings in RNFB 26. One minute is the Firebase
    // JS SDK's own default; flags are non-blocking here (see the catch below),
    // so a slow fetch must not hold up app start.
    fetchTimeoutMillis: 60 * 1000,
  };
  try {
    await fetchAndActivate(remoteConfig);
  } catch {
    // Ignore remote config errors to avoid blocking app start.
  }
  initialized = true;
}

export async function getBooleanFlag(key: string, fallback = false): Promise<boolean> {
  if (!initialized) {
    await initFeatureFlags();
  }
  try {
    return getValue(remoteConfig, key).asBoolean();
  } catch {
    return fallback;
  }
}

