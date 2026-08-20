# macos-app — the macOS client

A separate npm package, with its own `node_modules`, its own `patches/`, and
its own pinned React Native. It shares `../src` and `../App.tsx` with the
mobile app and nothing else.

## Why it is separate

`react-native-macos` stops at **0.81.9**. There is no 0.82 or 0.84 release.

RNOH — React Native for OpenHarmony, which the HarmonyOS port needs — declares
its React Native peer dependency as an **exact pin**, not a range:
`react-native: 0.84.1` for RNOH 0.84.x, `0.82.1` for 0.82.x.

One `package.json` cannot satisfy both. The mobile app has to move to 0.84.1 to
gain HarmonyOS; macOS cannot follow. Splitting is what lets each have the
version it requires, at the cost of a duplicated dependency list and two
`node_modules` trees — which is inherent, not incidental: two React Native
versions genuinely need two trees.

The alternative was dropping macOS entirely. That remains a live option, and
the state below is worth weighing before investing in this package.

## Setup

```sh
cd macos-app
npm install          # its own tree — do not install from the repo root
npm run pods         # sets CHATTERBOX_MACOS=1, see react-native.config.js
npm run macos
```

Run Metro from **this** directory, not the root. The two apps' bundlers are not
interchangeable.

## Current state: scaffolded, not working

This target has never started successfully. Three independent blockers, found
while splitting it out — the first two are fixed here, the third is not:

1. **~~It loaded the mobile entry point.~~** `macos/chatterbox-macOS/AppDelegate.mm`
   asks for the `index` bundle, which resolved to the repo root's `index.js`.
   That file imports `@react-native-firebase/messaging` and
   `react-native-screens` and calls into both at module scope — and
   `react-native.config.js` disables autolinking for both on macOS, so they were
   never linked. The app called unlinked native modules before rendering
   anything. Fixed: `index.js` here is a macOS entry that makes neither call.

2. **~~The registered component name did not match.~~** `AppDelegate.mm` sets
   `self.moduleName = @"chatterbox"`; the root `app.json` registers
   `"Chatterbox"`. `AppRegistry` lookups are case-sensitive, so the bridge
   would have found no root component even had it booted. Fixed: `app.json`
   here registers the lowercase name.

3. **Firebase does not link on macOS — every Firebase package is excluded.**
   See the list in `react-native.config.js`: auth, firestore, storage,
   functions, messaging and the rest are all `macos: null`. The app's data
   layer is Firebase, so a macOS build has no backend at all.

That third one is the real question, and it is the same problem the HarmonyOS
port has. The answer is also the same: `../src/services/firebase/` is a seam,
and the Firebase **JS SDK** — pure JavaScript, no native module — satisfies it
on any platform. A macOS build wanting a backend supplies `*.macos.ts`
implementations there, exactly as HarmonyOS will supply `*.harmony.ts`.

Until that is done, this package builds a chat client that cannot reach a
chat server. Nothing here is verified beyond the JS bundling — the native build
needs Xcode and a `pod install` on your machine.
