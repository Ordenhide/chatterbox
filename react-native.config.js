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
 *
 * Nothing is excluded here today: every dependency in this package supports
 * iOS and Android. HarmonyOS exclusions will be added as the port establishes
 * which packages have RNOH implementations.
 */
module.exports = {dependencies: {}};
