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

**Recovery phrases are typed by the user, into the emulator, by hand.** Never
into a conversation, never through `adb shell input text` — both put the key
somewhere it can be read later.

## What a passing test does not prove

```bash
npx jest                 # mobile
npx tsc --noEmit         # mobile types
npm run test:rules       # Firestore/Storage rules, against a real emulator
cd web && npm test       # web
cd web && npx tsc --noEmit
```

`BUILD SUCCESSFUL` says nothing about what is on the device. Verify the
*installed* app.

**`npm run lint` currently crashes** — not on this app's code, but on a
vendored esprima test fixture under `harmony/oh_modules/`, which makes
`react-native/no-inline-styles` throw. It exits 0, so the crash is easy to read
as a pass. Lint the files you touched by path instead
(`npx eslint src/services/foo.ts`), and compare against the same file at HEAD
before treating an error as yours: several files carry long-standing shadowing
and exhaustive-deps errors.

**There is no release build to install right now.** `assembleRelease` refuses
without `CHATTERBOX_STORE_FILE` and friends, which is correct and must stay —
the guard exists so a release is never signed with the public debug key. The
consequence is that a UI change cannot be checked on the emulator until the
user generates a real keystore: the installed app is the last AOT-compiled
release build, and putting a debug build over it would leave no way back to
one. Say so plainly instead of claiming a change was verified on device. What
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

## Two clients

`web/` is a separate reimplementation of the same services, not shared code.
A fix in `src/services/` usually needs a twin in `web/src/services/`, and when
the two disagree, find out which is right before copying either.
