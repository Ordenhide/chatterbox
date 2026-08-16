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

## Both halves now exist

`foo.ts` forwards to `@react-native-firebase/*` — iOS and Android execute the
same code they always did. `foo.harmony.ts` forwards to `firebase/*`, the pure
JS SDK. Metro picks between them by platform extension, so no call site knows
which one it got.

Verified by bundling each platform and grepping the output:

| platform | React Native Firebase | Firebase JS SDK |
| --- | --- | --- |
| ios | present | absent |
| android | present | absent |
| harmony | **absent** | **present** |

`app.harmony.ts` constructs the default `FirebaseApp` from
`src/firebaseConfig.ts`, because HarmonyOS has no native config file to
bootstrap from. Every other `*.harmony.ts` imports it, so initialisation
happens once. They import `./app.harmony` by its full name rather than `./app`:
TypeScript has no notion of platform extensions, and there is no `app.ts` for
it to resolve.

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

**Messaging (FCM)** is in `push.ts` / `push.harmony.ts`, and the harmony side
is empty. It cannot be made portable at any layer: it depends on Google Play
Services, which HarmonyOS does not have. Push there is Huawei Push Kit — a
different service with its own token lifecycle, to be built as a feature rather
than substituted as an implementation. Until then a HarmonyOS build receives no
notifications while backgrounded; messages still arrive over the Firestore
listener while the app is open.

**App Check** (`bootstrap.harmony.ts`) is absent for the same kind of reason —
it attests via Play Integrity / App Attest, OS services with no HarmonyOS
counterpart. Worth knowing: if App Check is ever set to *enforce* on Firestore,
Storage or Functions, a HarmonyOS build stops working outright rather than
degrading.

## Known gaps on HarmonyOS

- **No offline persistence.** The JS SDK's persistent cache is IndexedDB;
  `firestore.harmony.ts` asks for `memoryLocalCache` explicitly. Messages are
  separately cached in MMKV, so cold start still shows content.
- **Long polling** is forced, since Firestore's streaming transport relies on
  browser XHR behaviour React Native does not reproduce. Costs some update
  latency; a listener that silently never fires costs more.
- **Uploads buffer in memory.** `putFile` streamed from a path; the JS SDK has
  no filesystem, so `uploadFileFromUri` fetches the URI into a Blob first. The
  app's existing 50MB video / 25MB file limits keep that bounded.
- **Session persistence is unconfirmed on device.** It relies on
  `getReactNativePersistence`, reachable only through the package's
  `react-native` export condition. That symbol *is* present in the harmony
  bundle, so Metro selects the right build — but it has not been exercised at
  runtime. If it were missing, the symptom is signing in again after each
  restart.
