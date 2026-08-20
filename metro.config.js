const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {createHarmonyMetroConfig} = require('@react-native-oh/react-native-harmony/metro.config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * RNOH adds `harmony` as a platform and redirects `react-native` to
 * @react-native-oh/react-native-harmony when bundling for it. That package is a
 * fork of React Native itself rather than a library on top of one, which is why
 * this is a resolver-level redirect and not a dependency.
 *
 * NOTE: `react-native init-harmony` overwrites this file with its own template
 * and warns "Overwritten ./metro.config.js" as it goes. The template drops the
 * serializer fix below. If you ever re-run that command, restore this file.
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const harmonyConfig = createHarmonyMetroConfig({
  reactNativeHarmonyPackageName: '@react-native-oh/react-native-harmony',
});

/**
 * `getModulesRunBeforeMainModule` names the modules Metro evaluates *before*
 * the entry file — in practice, React Native's `InitializeCore`, which installs
 * the runtime globals (`window` among them).
 *
 * RNOH's implementation returns its own InitializeCore for `harmony` and an
 * **empty array** for every other platform, meaning "not mine, use the normal
 * one". But mergeConfig has no notion of that: a later config's value simply
 * replaces an earlier one, so merging RNOH's after the default handed iOS and
 * Android an empty list and InitializeCore stopped running at all.
 *
 * The symptom is a long way from the cause: the app bundles and launches fine,
 * then dies on the first module that touches a runtime global —
 * `ReferenceError: Property 'window' doesn't exist`, thrown from React Native's
 * own AnimatedProps reading `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`. Nothing
 * about bundling ever fails, so a successful `react-native bundle` does not
 * catch it; only launching the app does.
 *
 * Falling back to the default list when RNOH declines is what its empty return
 * was asking for in the first place.
 */
const composedSerializer = {
  getModulesRunBeforeMainModule: (...args) => {
    const fromHarmony = harmonyConfig.serializer.getModulesRunBeforeMainModule(...args);
    return fromHarmony.length > 0
      ? fromHarmony
      : defaultConfig.serializer.getModulesRunBeforeMainModule(...args);
  },
};

const config = {
  serializer: composedSerializer,
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(defaultConfig, harmonyConfig, config);
