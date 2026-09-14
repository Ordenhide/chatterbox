# iOS push: what is wired, and the one step that needs an Apple account

## Wired

`App.tsx` requests APNs authorisation, fetches an FCM token and writes it to
`users/{uid}/private/push`, the same document `notifyNewMessage` reads. That
whole effect used to return early unless `Platform.OS === 'android'`, so iOS
never registered at all and the server's `continue`-on-missing-token meant an
iOS user received nothing — while the same function was already building an
`apns` alert payload for them.

`Info.plist` declares `UIBackgroundModes: remote-notification`, without which
an APNs payload cannot wake the app and a notification arriving while
Chatterbox is not in the foreground is dropped.

`ios/firebase.json` sets `messaging_auto_init_enabled: true`, which is the
switch that decides whether FCM initialises and registers for APNs at all. It
is the default; it is stated there because it is the single value that would
silently kill iOS push, and that file is where someone debugging iOS push
will look. See README-firebase-json.md for why that file exists.

## Not wired, because it cannot be done from a repository

**The Push Notifications capability.** It has to be enabled on the App ID
(`com.chatterbox`) in the Apple Developer account, which regenerates the
provisioning profile, and Xcode then writes `aps-environment` into
`ios/Chatterbox/Chatterbox.entitlements`.

That entitlement is deliberately **not** committed ahead of the capability.
An app whose entitlements claim `aps-environment` while its profile does not
grant it fails to sign, with an error that names neither the entitlement nor
the profile. Adding it blind would trade "push does not work" for "the app
does not build", which is worse.

To do it:

1. Apple Developer → Identifiers → `com.chatterbox` → enable **Push
   Notifications**. Create an APNs key (or certificate) while there.
2. Firebase Console → Project settings → Cloud Messaging → upload that APNs
   key for the iOS app. Without this, Firebase has an FCM token it cannot
   deliver through.
3. Xcode → Chatterbox target → Signing & Capabilities → **+ Capability** →
   Push Notifications. This writes `aps-environment` into the entitlements
   file. Commit that change.
4. Build to a device and check `users/{uid}/private/push` gains an `fcmToken`.
   A simulator cannot register for APNs at all, so this step needs hardware.

Until step 3, `requestPermission` resolves and `getToken` rejects; the effect
catches it and sign-in is unaffected. That is the intended degradation — no
push, nothing else broken — but it is a degradation, not the finished state.

## CI

`.github/workflows/ios.yml` builds for the simulator on every push to main and
every PR. It is unsigned, so it proves compilation and nothing about signing or
push delivery. It needs one secret,
`CHATTERBOX_GOOGLE_SERVICE_INFO_BASE64`:

```sh
base64 -i ios/Chatterbox/GoogleService-Info.plist | pbcopy
```

stored at Settings → Secrets and variables → Actions. Without it the job fails
on its first step with that instruction, rather than three minutes into a build
with a Firebase configuration error.
