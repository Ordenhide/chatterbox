# Installing Chatterbox on your iPhone

For running the app on a physical device from this checkout. React Native
0.84.1; the native iOS project is committed, so there is nothing to generate.

## Prerequisites

- macOS with Xcode installed
- An Apple ID added to Xcode (Settings > Accounts). A free one works; see
  **Free Apple ID** at the bottom for what it costs you.
- An iPhone on iOS 15.1 or newer (`IPHONEOS_DEPLOYMENT_TARGET = 15.1`)
- Node 18+ and CocoaPods

## 1. Dependencies

```bash
npm install
cd ios && pod install && cd ..
```

## 2. Enable Developer Mode on the iPhone

**iOS 16 and newer require this, and without it a build that succeeds will
refuse to launch** — the most common way to get "it builds but I can't run it".

On the phone: Settings > Privacy & Security > Developer Mode > on, then
restart. The toggle only appears after the phone has been connected to Xcode
at least once.

## 3. Open the workspace

```bash
open ios/Chatterbox.xcworkspace
```

The workspace, never `Chatterbox.xcodeproj` — CocoaPods lives in the workspace.

## 4. Signing

Select the **Chatterbox** target > Signing & Capabilities:

- **Automatically manage signing** on
- **Team**: your Apple ID's team

Leave the **Bundle Identifier** as `com.chatterbox`. It is not arbitrary:
`ios/Chatterbox/GoogleService-Info.plist` is issued for that exact id, and
`[FIRApp configure]` runs at startup in `AppDelegate.mm`. Change the id and
Firebase is configured against a bundle id it was not issued for. If you must
change it, add an iOS app with the new id in the Firebase console and replace
the plist with the one it gives you.

Push notifications additionally need the Push Notifications capability and a
paid account; see `ios/README-push.md`. The app runs without it — only push
stops working.

## 5. Trust the certificate on the phone (first install only)

Settings > General > VPN & Device Management > your developer certificate >
Trust.

## 6. Start Metro, then run

```bash
npm start          # leave running
npm run ios -- --device
```

Or press Play in Xcode with the phone selected.

Start Metro *before* running, not after. A Debug build finds Metro through
`ip.txt`, a file the build writes into the app containing this Mac's LAN
address, so the phone and the Mac must be on the same Wi-Fi network. (That
file was suppressed in this project until 2026-09-15 — a Debug build on a
device could not discover Metro at all, and fast refresh never worked there.)

If Metro is unreachable the app still runs: a Debug build for a device also
embeds `main.jsbundle`, and React Native falls back to it. Measured — the app
starts and works. What you lose is fast refresh, and the JS is frozen as of
build time, which is its own way to waste an hour.

## Troubleshooting

### It builds, then will not launch

In rough order of likelihood:

- Developer Mode is off on the phone (step 2)
- The developer certificate is not trusted yet (step 5)
- With a free Apple ID, the 7-day signature has expired — rebuild
- The phone is locked; unlock it and run again

Read the actual message in Xcode's console or the Devices window rather than
guessing between these — they look alike from the outside and have nothing in
common.

### Red screen: "No script URL provided"

Metro is not running. A Debug build for the **simulator** carries no JS of its
own — unlike a device build, it has nothing to fall back to — and Xcode's Run
button does not start Metro. Run `npm start` in a terminal, then Cmd-R in the
simulator.

### Crashes at launch on iOS 27 with "UIScene life cycle is required"

Fixed on 2026-09-15 (`SceneDelegate` in `AppDelegate.mm`). If it comes back,
something removed `UIApplicationSceneManifest` from `Info.plist`. It never
shows in Xcode's issue navigator; the message is only in the console and in
the crash report.

### "Command PhaseScriptExecution failed with a nonzero exit code" (ReactCodegen)

The project path contains **spaces**. React Native's build scripts break on
them. Move the checkout somewhere without spaces:

```bash
mkdir -p ~/Projects && mv "/path/with spaces/chatterbox" ~/Projects/chatterbox
cd ~/Projects/chatterbox
rm -rf ios/build ios/Pods node_modules/.cache
npm install && cd ios && pod install && cd ..
```

### "No devices found"

Connected by USB, phone unlocked, computer trusted on the phone. Then
`xcrun devicectl list devices` to confirm the Mac sees it at all.

### "Signing for Chatterbox requires a development team"

No Team selected in Signing & Capabilities, or no Apple ID in Xcode >
Settings > Accounts.

### Build failures after changing branches

```bash
cd ios && pod install && cd ..     # first, and usually enough
# Xcode: Product > Clean Build Folder (Shift-Cmd-K)
```

### Metro connection issues

Same Wi-Fi network, and check `ip.txt` inside the built `.app` if you suspect
the address is wrong. To override it: shake the phone > Configure Bundler, or
`npm start -- --host <mac-ip>`.

## Free Apple ID

- The signature lasts 7 days, then the app refuses to open until you rebuild
- Only devices registered to your account
- No push notifications (needs a paid account and the capability)

A paid account signs for a year and is what TestFlight needs: Product >
Archive, upload to App Store Connect, add testers.

## Quick reference

```bash
npm install
cd ios && pod install && cd ..
npm start                      # Metro, leave running
npm run ios -- --device        # or Play in Xcode
npx react-native run-ios --simulator="iPhone 17"
```
