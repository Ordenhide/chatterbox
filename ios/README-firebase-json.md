# Why there is a second `firebase.json` in here

`@react-native-firebase/app` runs `ios_config.sh` as an Xcode build phase. It
walks up from `$PROJECT_DIR` looking for a `firebase.json`, and reads whichever
it finds first. Left to itself it finds the repository root's — the one the
Firebase CLI uses for Firestore rules, Storage rules, Functions, emulators and
Hosting.

That file cannot be read by that script. Line 91 interpolates the whole file
into a **single-quoted Ruby string**:

```sh
ruby -Ku -e "require 'json'; output=JSON.parse('$_JSON_OUTPUT_RAW'); ..."
```

so one apostrophe anywhere in the file ends the literal. The root
`firebase.json` now contains 68 of them, all from Content-Security-Policy
keywords — `default-src 'none'`, `script-src 'self'` — which CSP requires and
which no amount of care can remove.

The result was:

```
error: Failed to parse firebase.json, check for syntax errors.
** BUILD FAILED **
```

The file is valid JSON. The script is what cannot read it. The iOS build broke
the day the security headers landed (`6cab640`, 2026-09-07) and stayed broken,
because nothing builds iOS in CI — see the note at the end.

This file stops the search here, so the script reads something it can parse and
the root file goes on serving the CLI untouched.

## What it declares, and what it deliberately does not

Two settings, both of which affect an SDK that is actually linked:

- `messaging_auto_init_enabled` — FirebaseMessaging is linked, and this is the
  switch that decides whether FCM initialises and registers for APNs at all.
  It is the default, and it is stated here because it is the one value that
  would silently kill iOS push, and this is where someone debugging iOS push
  will look.
- `app_check_token_auto_refresh` — FirebaseAppCheck is linked; same reasoning.

There are no analytics settings here, and that is on purpose. The privacy
policy says "there is no analytics and no crash reporting", and the Podfile.lock
agrees: FirebaseAnalytics, FirebaseCrashlytics, FirebasePerformance and
FirebaseInAppMessaging are not linked. Keys that disable a library nobody
compiled would read like a protection and enforce nothing — the same mistake as
a switch whose reader has no callers.

## The gap this sat in

There is no iOS job in `.github/workflows/`. Android has `release-apk.yml`;
rules and functions have their own deploys; the JS suites run on every push.
iOS has nothing, which is why a build break survived a week of work that
included a full pre-release audit.
