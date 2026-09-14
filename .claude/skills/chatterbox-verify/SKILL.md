---
name: chatterbox-verify
description: How to build, install and actually verify a change in Chatterbox — which build to measure on, how not to lose the emulator's E2EE key, and what a passing test does not prove. Use before measuring performance, installing on the emulator, taking screenshots, or claiming something is fixed.
---

# Verifying a change in Chatterbox

Most of this exists because the obvious thing was done first and was wrong.

## Check what is installed before you measure anything

```bash
./scripts/emu check
```

A **debug APK for this app carries no JS bundle at all** — its assets are
eight font files — so every cold start streams ~12MB from the Metro dev server
before anything renders. And ART refuses to AOT-compile a `DEBUGGABLE`
package, so `cmd package compile -m speed` silently settles at `verify` and
the whole app stays interpreted.

Five rounds of performance work were once measured against one of those. A
media concurrency pool, flush coalescing, composer state, nine lazy screens, a
shorter cold open — none of them could have shown up, because the bottleneck
was never in the code being optimised. One `adb shell dumpsys package` would
have shown it at any point.

`scripts/emu check` says so in as many words when the answer means a
measurement is worthless. Run it first, every time.

**Android Studio silently redeploys its own build over whatever is installed
whenever Run is pressed** — twice in fifteen minutes on the day this was
written, each time replacing a release build and resetting the AOT
compilation. Close it before measuring, or check again after.

## Installing

```bash
./scripts/emu build      # gradle assembleRelease
./scripts/emu install    # verifies the signature, installs, AOT-compiles
./scripts/emu run
./scripts/emu shot [path]
```

`install` verifies the APK's signing certificate against the installed app's
before calling adb, and **this is not a formality**. A mismatch cannot be
installed over; the only way through is an uninstall, which destroys the
device-only E2EE private key and costs the user a 24-word recovery. That is
not a judgement to leave to whoever is at the keyboard.

The release build refuses to run without `CHATTERBOX_STORE_FILE`,
`CHATTERBOX_STORE_PASSWORD`, `CHATTERBOX_KEY_ALIAS` and
`CHATTERBOX_KEY_PASSWORD` (`android/app/build.gradle`). **Do not weaken that
guard.** A local release build pointed at `debug.keystore` is signed with the
public Android debug key: fine for the emulator, never distributable.

**The guard reads the resolved task graph, not the command line, and that is
the whole point.** Its first version tested `gradle.startParameter.taskNames`
for the substring `"release"` — so `./gradlew build`, which contains no such
substring but does pull `assembleRelease` along behind it, walked straight
past and took the `?: "debug.keystore"` fallback. It left a 130MB
`app-release.apk` in `build/outputs` signed with the public debug key and
named exactly like a shippable one. The fallback is gone and the release
variant now has no signing config at all without credentials, so the failure
mode is an unsigned artifact rather than a plausible-looking poisoned one.
Verify a change to it by dry-running every route: `assembleRelease`,
`bundleRelease` and a bare `build` must all fail, `assembleDebug` must not.

**Which key is the live one is a question with a wrong obvious answer.** Three
keystores sit in `android/app/`, and the one whose credentials are written
down locally is *not* the one that signed the published v1.0.0 and v1.1.0
APKs. `RELEASE_KEYSTORE_SECRETS.txt` (gitignored) now says which is which,
with fingerprints. Settle it by reading the certificate out of a published
artifact — `apksigner verify --print-certs` on the APK from the GitHub
release — rather than by trusting a filename.

## Do not lose the emulator

**`adb emu kill`, then wait for qemu to exit on its own.** Do not `pkill -f
qemu-system` a few seconds later. The snapshot save is multiple GB and takes
far longer than that; interrupting it loses the AVD's state — which on
2026-09-04 destroyed the installed app along with its E2EE device key and cost
a 24-word recovery. Poll `pgrep -f qemu-system` with no short timeout.

**Quitting Android Studio terminates the emulator it launched**, so close it
before starting a test rather than during one.

Launch with `-dns-server 8.8.8.8,8.8.4.4`. The emulator freezes the host's DNS
at boot and never re-reads it, so one left running across a network change
resolves nothing while raw IPs still ping — which reads as an auth failure and
is not one. It is a boot-time argument; a running instance cannot be fixed.

`adb exec-out screencap -p` yields a corrupt PNG (a multiple-displays warning
goes to stdout). `scripts/emu shot` goes through `/sdcard` instead.

## Never enrol a real account to test

`getOrCreateDeviceKeypair` **mints and publishes**. Calling it on an account
that already has a published key overwrites that key permanently and strands
every message encrypted to it. `getDeviceKeypairIfEnrolled` is the read-only
one; `enrollmentReadiness` is how a screen decides whether enrolling is safe.

The same applies to anything that reveals the recovery phrase:
`getRecoveryPhrase` enrols a device that has no key yet.

**Sign-in no longer enrols.** Since the account became a recovery phrase,
`adoptSeedAsDeviceKey` installs the key the phrase encodes, and the launch path
only calls `republishKeyIfAccountHasNone`, which cannot mint. That was not a
tidy-up: sign-in and Firebase's auth-state callback start at the same moment,
and a minted key whose publish landed second left the account advertising a
public key its own phrase could not match. `keyEnrollmentBoundary.test.ts`
holds the line, and there is no automatic enroller left to add one back to.

**Recovery phrases are typed by the user, into the emulator, by hand.** Never
into a conversation, never through `adb shell input text` — both put the key
somewhere it can be read later. This matters more than it used to: the phrase
is now the whole credential, so anything that captures one captures the
account, not just its history.

**The whole sign-up and sign-in path has an integration test.** `npm run
test:auth` starts the Auth and Firestore emulators, loads the real
`firestore.rules`, and runs the shipping `createAccount` / `signInWithPhrase`
against them — only the module that hands out the SDK instances is replaced.
It answers the questions no mock can: that Firebase accepts a credential at a
`.invalid` domain, that the rules permit the writes sign-in makes, that the
same twenty-four words come back to the same uid with the same key, and that
running sign-up twice on one phrase recovers instead of failing.

It is excluded from `vitest run` on purpose — a suite that only passes when a
background service happens to be up is one people learn to skip.

**The auth emulator will answer credential questions the app cannot.**
`firebase emulators:start --only auth` plus the identitytoolkit REST endpoint
verified that the derived `.invalid` handle is accepted, that the same phrase
re-signs-in to the same uid, and that a repeat sign-up returns `EMAIL_EXISTS`
— which is the code `createAccount` deliberately catches. It is not production,
and the first real sign-up is still the test that matters.

## What a passing test does not prove

```bash
npx jest                 # mobile
npx tsc --noEmit         # mobile types
npm run test:rules       # Firestore/Storage rules, against a real emulator
npm run test:auth        # sign-up/sign-in end to end, against Auth + Firestore
cd web && npx vitest run # web
cd web && npx tsc --noEmit
```

`BUILD SUCCESSFUL` says nothing about what is on the device. Verify the
*installed* app.

**Do not use `npm run lint`.** It is `eslint .`, which walks the vendored
`harmony/oh_modules/` tree — thousands of files, including an esprima fixture
that makes `react-native/no-inline-styles` throw. It has been observed both
exiting 0 on that crash and simply not finishing inside five minutes. Either
way it tells you nothing.

`npx eslint src` completes in seconds and is the one to use. Compare the total
against the same command at HEAD before treating an error as yours: `src`
carries a long-standing baseline of shadowing and exhaustive-deps errors, and
what matters is whether your change moved the number.

**There is no release build to install right now.** `assembleRelease` refuses
without `CHATTERBOX_STORE_FILE` and friends, which is correct and must stay —
the guard exists so a release is never signed with the public debug key. The
consequence is that a UI change cannot be checked on the emulator until the
user generates a real keystore. Check what is actually installed before
reasoning about it: as of 2026-09-08 the emulator carries a **debug** build
(`DEBUGGABLE`, debug-signed, installed 2026-09-06 — Android Studio's Run
button, as warned above), not the AOT-compiled release build this used to
claim. Installing a release over it needs an uninstall, since the
certificates differ. Say so plainly instead of claiming a change was verified on device. What
*can* be checked without a device: `npx react-native bundle --platform android
--dev false` proves every import resolves and both locales ship.

**Security properties get mutation-tested.** Break the line the test is
supposed to be guarding, confirm the test fails, restore. A test that passes
both ways is decoration — and several here were written only after a mutation
escaped. This has caught: an SSRF guard that allowed eight notations for
loopback, a screenshot-protection call that reported success when the native
module was missing, and a key backup that would have looked synced and not
been.

The security rules tests run against a real Firestore emulator loading the
actual `firestore.rules`, not a JS re-implementation — the difference is the
whole point, since a re-implementation only proves the test author read the
rules the same way they wrote them.

## The failure this repo keeps having: a green test that tests nothing

Mutation testing exists for the case where a test is too weak. This is the
worse case, where a test asserts something that has become **vacuously true**,
stays green, and reads as coverage. It happened five times in one audit.

- The `entitlements` suite had six tests. When the collection was deleted,
  exactly one went red — the one asserting a permitted read. The other five
  asserted denials, and a collection with no rules denies everything.
- Six tests asserting Moments' visibility model gated *writes* would have
  stayed green once every write was refused.
- The storage session-currency tests used the moment-media path as "somewhere
  writable". Refusing writes there would have made three of their `assertFails`
  prove nothing about sessions.
- A parser written to find every `query(ref, where(…), orderBy(…))` in the
  client used a regex that stopped at the closing paren of `scheduledRef(chatId)`
  and matched **nothing**. Every assertion under it passed.

**The tell is an assertion that a thing is refused, in a test whose subject
might stop existing.** When deleting a feature, deleting its rules, or
tightening a rule to deny, go and read the tests that touch it and ask which
of them would still fail for the right reason.

**A test that scans source must assert it found something.** Any parsing guard
gets a first case pinning the specific things it was written to catch, so a
refactor that breaks the parsing fails loudly instead of going quietly green.

## A red suite reports nothing

`npm run test:rules` is the only thing in this project that tests the rules,
CI runs it on every push to `main`, and it had been **failing for two feature
deletions** — stale `sharedLists`/`quoteWall` and `entitlements` tests left
behind when their collections went.

Nobody was reading it. That is how Moments kept open `create` rules and a
25 MB Storage write path through an entire security-minded refactor. The guard
was working; the alarm was not being heard.

**Run the full rules suite before claiming a rules change is safe**, and treat
a pre-existing failure as a finding rather than as background noise.

## Screenshots are evidence, prose is not

Byte size is a usable proxy for what is on screen: the splash is ~31KB, a
blank-with-spinner ~49KB, the chat list ~377KB, an open chat ~428KB. A
`FLAG_SECURE` window screencaps at ~15KB because the frame comes back black —
which is how that feature was verified rather than argued.

`adb shell uiautomator dump` gives the accessibility tree, which answers "what
is this element" and "did the label land" without guessing from pixels.

**Do not conclude from glyph shapes at low resolution.** A font question was
settled by changing `fontSize` and watching it take effect while `fontFamily`
did not — measurement, not eyesight.

## iOS builds, and had not for a week

```bash
cd ios && pod install
xcodebuild -workspace Chatterbox.xcworkspace -scheme Chatterbox \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

**Read xcodebuild's own exit code.** Piping it into `tail` makes the exit code
`tail`'s, which is 0 whatever the build did — a run that ends in
`** BUILD FAILED **` reports success. Redirect to a file and grep it, or check
`${PIPESTATUS[0]}`.

**`@react-native-firebase/app` cannot read the root `firebase.json`, and
`ios/firebase.json` exists to stop it trying.** Its `ios_config.sh` build phase
interpolates the whole file into a single-quoted Ruby string, so one apostrophe
ends the literal. The root file holds the Hosting headers, whose CSP values are
full of them. The iOS build broke the day those landed and stayed broken
through an entire pre-release audit, because nothing built iOS.
`iosFirebaseJson.test.ts` now fails in milliseconds on the apostrophe rule;
`.github/workflows/ios.yml` builds for real on a macOS runner.

**An unsigned simulator build has no entitlements, so the keychain returns
-34018.** That produces a FirebaseAuth "error loading saved user" and looks
like a real defect. Ad-hoc signing (`CODE_SIGN_IDENTITY="-"
CODE_SIGNING_REQUIRED=NO`) makes it go away. Before reporting any keychain
problem on iOS, rebuild signed — otherwise the build configuration is the bug.

**What remains unexplained**: `mmkv_key_store_unverified` survives ad-hoc
signing. The keychain write resolves, the read-back does not match, and
neither `secure_store_write_failed` nor `secure_store_read_failed` is reported,
so it is the comparison that fails rather than either call. Consequence if it
also happens on hardware: MMKV falls back to the unencrypted bootstrap store,
so local at-rest encryption is weaker than designed. Distinguishing a simulator
limitation from a real defect needs a profile-signed build on a device.

**Running it**: `xcrun simctl boot <udid>`, `install <udid> <path>/Chatterbox.app`,
`launch <udid> com.chatterbox`, `io <udid> screenshot out.png`. The debug build
carries no JS bundle, so Metro must be up first — same as Android. Note the
bundle id is `com.chatterbox`, not Android's `com.chatterbox.app`;
`GoogleService-Info.plist` matches the former and is gitignored, so CI decodes
it from a secret.

**iOS push is wired but not enabled.** The client registers now; the Push
Notifications capability on the App ID is not committed, because entitlements
claiming `aps-environment` without a profile granting it fail to sign. See
ios/README-push.md.

## Two clients

`web/` is a separate reimplementation of the same services, not shared code.
A fix in `src/services/` usually needs a twin in `web/src/services/`, and when
the two disagree, find out which is right before copying either.
