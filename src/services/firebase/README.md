# `services/firebase` — the platform seam

Every Firebase import in `src/` goes through this directory. Nothing outside it
may import `@react-native-firebase/*` directly.

## Why

React Native Firebase wraps the **native** Firebase SDKs. Those SDKs exist for
iOS and Android and nowhere else — there is no HarmonyOS build of them, and
none is planned. A HarmonyOS port therefore cannot use this library at all.

The way out is that Firebase also ships a **pure-JavaScript** SDK (`firebase`,
v9+), which talks to the same backend over `fetch` and WebSocket with no native
code underneath. It runs anywhere a JS engine runs, RNOH included.

The two libraries expose the *same modular API*: `getFirestore`, `doc`,
`setDoc`, `onSnapshot`, `query`, `where` and the rest have matching signatures
in both. That is not a coincidence — React Native Firebase deliberately mirrors
the JS SDK's modular surface. So the swap is a change of import specifier, not
a rewrite, provided every call site imports from one place.

This directory is that place.

## What lives here

| Module | Contents |
| --- | --- |
| `firestore.ts` | Re-export. 32 files depend on it. |
| `auth.ts` | Re-export. |
| `functions.ts` | Re-export. |
| `storage.ts` | Re-export **plus** `uploadFileFromUri`, see below. |
| `analytics.ts` `crashlytics.ts` `remoteConfig.ts` | Re-exports, each with exactly one consumer — see below. |

## Today they are plain re-exports

On purpose. Introducing the seam and changing the implementation are two
separate changes, and doing them together would mean a 45-file refactor whose
runtime behaviour also moved. Right now every module here forwards to
`@react-native-firebase/*`, so iOS and Android execute exactly the same code
they did before — the indirection is free and the diff is reviewable.

A HarmonyOS implementation lands later as `*.harmony.ts` siblings that forward
to `firebase/*` instead. Metro resolves platform extensions automatically, so
no call site changes again.

## The three things that are not portable

**`putFile`** is React Native Firebase's own — it uploads straight from a local
file path, which the JS SDK cannot do because it has no filesystem. The JS SDK
equivalent is to read the file into bytes and call `uploadBytes`. Both call
sites (chat attachments, moment media) go through `uploadFileFromUri` in
`storage.ts` so that difference has exactly one place to live.

**Analytics, Crashlytics and Remote Config** have no usable counterpart. The JS
SDK's analytics and remote-config modules are browser-only (they need `gtag`
and IndexedDB), and Crashlytics is native-only with no JS SDK module at all.
They are one file each and entirely optional to the product, so `telemetry.ts`
exposes them behind a narrow interface that a HarmonyOS build can implement as
no-ops or against AppGallery Connect.

**Messaging (FCM)** is deliberately *not* here. It cannot be made portable at
any layer: it depends on Google Play Services, which HarmonyOS does not have.
Push on HarmonyOS is Huawei Push Kit — a different service with its own token
lifecycle, not a swappable implementation of the same one.
