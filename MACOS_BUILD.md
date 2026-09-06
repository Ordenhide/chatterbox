# Building Chatterbox for macOS (Mac Catalyst)

The macOS version of Chatterbox is built with **Mac Catalyst** — it reuses the
existing `ios/` Xcode target and Apple's UIKit-on-macOS runtime, rather than a
separate native project. This is why there is no ongoing `macos/`-specific app
code to maintain: the same JS/TS bundle and the same iOS target produce the Mac
app.

> A separate `react-native-macos` (AppKit) port was also explored but is
> **parked** — it's blocked on an upstream gap in react-native-macos's Fabric
> graphics layer (missing macOS header implementations). Catalyst is the
> working path. See git history / patches if you want to revisit it.

## What works on the Mac build vs. iOS/Android

| Feature | Mac (Catalyst) | iOS / Android |
| --- | --- | --- |
| Messaging, Moments, Profile, auth, most of the app | ✅ | ✅ |
| Firestore / Firebase backend | ✅ | ✅ |
| **Voice & video calls** | ❌ (see below) | ✅ |
| **Push notifications** | ⚠️ untested on Catalyst | ✅ |
| Ad-ID / conversion tracking | ❌ (disabled everywhere now) | ❌ |

**Calls are excluded from the Mac build.** `react-native-webrtc`'s precompiled
`JitsiWebRTC` binary has no Mac Catalyst slice, and no current WebRTC fork
supports Catalyst/macOS. The rest of the app runs fine; only `CallScreen`-related
functionality is unavailable. The JS side should gate call entry points on
`Platform.OS` / a runtime capability check so the Mac UI doesn't offer calling.

## Prerequisites

Same as iOS (Xcode, CocoaPods, Node 20+). No extra tooling.

## Build steps

Because Catalyst and iOS share the same autolinking bucket, and webrtc must stay
linked for real iOS but must be dropped for Catalyst, the webrtc exclusion is
gated behind the `CHATTERBOX_CATALYST` env var (see `react-native.config.js`).
**You must re-run `pod install` when switching between building for iOS and for
Mac**, because it changes which pods are integrated.

### Build the Mac app

```bash
# 1. Integrate pods for the Catalyst variant (drops webrtc)
CHATTERBOX_CATALYST=1 pod install --project-directory=ios

# 2. Build for the Mac Catalyst destination
xcodebuild -workspace ios/Chatterbox.xcworkspace \
  -scheme Chatterbox -configuration Debug \
  -destination 'platform=macOS,variant=Mac Catalyst' build

# 3. Or open in Xcode and pick "My Mac (Mac Catalyst)" as the run destination:
open ios/Chatterbox.xcworkspace
```

Metro must be running (`npm start`) for a Debug build, same as iOS.

### Switch back to building for iOS / Android

```bash
# Re-integrate pods with webrtc restored (calls work again)
pod install --project-directory=ios
```

## What was changed to make Catalyst build

All reversible, all confined to build config / patches (no app logic changed):

1. **`ios/Chatterbox.xcodeproj`** — enabled `SUPPORTS_MACCATALYST=YES` and
   `TARGETED_DEVICE_FAMILY=1,2,6` on the app target.
2. **`ios/Podfile`**:
   - `:mac_catalyst_enabled => true` in `react_native_post_install`.
   - `$RNFirebaseAnalyticsWithoutAdIdSupport = true` — the
     `GoogleAdsOnDeviceConversion` framework has no Catalyst slice and failed the
     link step. This app runs no ads, so dropping ad-ID support is a fine (and
     more privacy-respecting) trade.
   - `EXCLUDED_ARCHS[sdk=macosx*]` on the webrtc/JitsiWebRTC pod targets.
3. **`react-native.config.js`** — the `CHATTERBOX_CATALYST` env gate described
   above.

## Distribution

For public distribution outside the Mac App Store you'll need a Developer ID
Application signing certificate and notarization (`xcrun notarytool`). That's a
separate step from getting the build working and isn't set up yet.
