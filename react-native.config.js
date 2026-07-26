// Native modules with no macOS support (confirmed via each package's podspec —
// none declare an `:osx`/macos platform, or their React Native bridge doesn't
// have a macOS implementation). Autolinking is disabled for `macos` only;
// iOS/Android are unaffected. JS call sites for these must be feature-flagged
// out (or given a macOS-specific fallback) for the macos platform.
const noMacosSupport = [
  '@react-native-firebase/analytics',
  '@react-native-firebase/app',
  '@react-native-firebase/app-check',
  '@react-native-firebase/auth',
  '@react-native-firebase/crashlytics',
  '@react-native-firebase/firestore',
  '@react-native-firebase/functions',
  '@react-native-firebase/messaging',
  '@react-native-firebase/remote-config',
  '@react-native-firebase/storage',
  'react-native-audio-recorder-player',
  'react-native-biometrics',
  'react-native-document-picker',
  'react-native-haptic-feedback',
  'react-native-image-picker',
  'react-native-image-resizer',
  'react-native-incall-manager',
  'react-native-screens',
  'react-native-vector-icons',
  'react-native-video',
  // Its podspec declares macOS, but the RN bridge has no working macOS
  // implementation in any current fork (see the calls-on-macOS research);
  // calls are out of scope for the macOS build for now.
  'react-native-webrtc',
];

// Mac Catalyst shares the "ios" autolinking bucket (there is no separate
// "catalyst" platform key), yet react-native-webrtc's precompiled JitsiWebRTC
// binary has no Catalyst slice and its bridge source won't compile for
// Catalyst. So we must fully drop webrtc (module + JitsiWebRTC framework link)
// from the iOS bucket *when building the Catalyst variant*, while keeping it
// for real iOS device/simulator builds where calling must work.
//
//   • iOS / Android (default):     leave CHATTERBOX_CATALYST unset  -> webrtc linked, calls work
//   • Mac Catalyst:                CHATTERBOX_CATALYST=1 pod install --project-directory=ios
//                                  then build the "Mac Catalyst" destination
//
// Re-run `pod install` after flipping this env var, since it changes which
// pods are integrated.
const buildingCatalyst = process.env.CHATTERBOX_CATALYST === '1';

const dependencies = Object.fromEntries(
  noMacosSupport.map(name => [name, {platforms: {macos: null}}]),
);

if (buildingCatalyst) {
  dependencies['react-native-webrtc'] = {platforms: {ios: null, macos: null}};
}

module.exports = {dependencies};
