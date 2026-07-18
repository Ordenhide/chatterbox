import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  setDefaults,
} from '@react-native-firebase/remote-config';

const remoteConfig = getRemoteConfig();
let initialized = false;

export async function initFeatureFlags() {
  if (initialized) return;
  if (__DEV__) {
    initialized = true;
    return;
  }
  await setDefaults(remoteConfig, {
    feedback_enabled: true,
    login_experiment_variant: 'control',
  });
  remoteConfig.settings = {
    minimumFetchIntervalMillis: 60 * 60 * 1000,
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

export async function getStringFlag(key: string, fallback = ''): Promise<string> {
  if (!initialized) {
    await initFeatureFlags();
  }
  try {
    return getValue(remoteConfig, key).asString();
  } catch {
    return fallback;
  }
}

