/**
 * Autolinking for the mobile app: iOS, Android, and (once RNOH lands)
 * HarmonyOS.
 *
 * The macOS rules that used to live here have moved to
 * macos-app/react-native.config.js. macOS is now a separate package pinned to
 * React Native 0.81, because react-native-macos has no 0.82+ release and RNOH
 * pins React Native exactly — see macos-app/README.md. Keeping its ~22
 * "no macOS support" exclusions and the Mac Catalyst switch in the shared root
 * meant every mobile build parsed rules for a platform it cannot build.
 */
const pkg = require('./package.json');

// @react-native-oh-tpl/* packages are HarmonyOS-only ports. Several of them
// (confirmed so far: react-native-get-random-values, react-native-audio-
// recorder-player, react-native-localize, react-native-haptic-feedback) ship
// a full copy of the original package's ios/ folder and podspec, reusing the
// same pod/module name as the real upstream package. Autolinking has no
// concept of "harmony only" — it discovers every dependency with a podspec
// or build.gradle and links whichever one it processes last for a given pod
// name, so leaving these unexcluded silently swaps the real iOS/Android
// module for an untested HarmonyOS fork. Caught via
// react-native-get-random-values, which backs crypto/E2EE — a
// security-sensitive module to have silently swapped.
//
// Harmony itself doesn't use this autolinking path at all: RNOH's Metro
// resolver redirects JS imports via each port's `harmony.alias` field, and
// hvigor has its own separate autolinking (see harmony/README.md) for
// whatever ships a `.har`. So excluding these here costs harmony nothing —
// derived from package.json rather than hardcoded so a future oh-tpl
// addition can't reintroduce this bug by omission.
const harmonyOnlyPackages = Object.keys(pkg.dependencies || {}).filter(name =>
  name.startsWith('@react-native-oh-tpl/'),
);

module.exports = {
  dependencies: Object.fromEntries(
    harmonyOnlyPackages.map(name => [name, {platforms: {ios: null, android: null}}]),
  ),
  // Fonts are linked as assets rather than loaded at runtime: React Native has
  // no runtime font loader, so the files have to be copied into the iOS bundle
  // (plus UIAppFonts in Info.plist) and android/app/src/main/assets/fonts by
  // `npx react-native-asset`. See src/theme/typography.ts for how they are
  // referenced, and note that adding a face here needs that command re-run and
  // a native rebuild — a JS reload will not pick it up.
  assets: ['./src/assets/fonts'],
};
