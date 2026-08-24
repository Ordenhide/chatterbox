# Sign in with Apple — setup

The code is in place; the account-level configuration is not, and cannot be
done from the repository. Until every step below is finished, the button is
hidden at runtime rather than shown and failing — `isAppleSignInAvailable()`
checks that the native module actually linked.

## Why it is not optional

App Store Review Guideline 4.8 requires an equivalent privacy-preserving login
option in any app offering third-party sign-in. This app offers Google, so on
iOS a submission without Sign in with Apple is rejected. It is not required on
Android, and the button does not appear there.

## What is already done

| | |
|---|---|
| `src/services/appleAuth.ts` | Nonce generation, native-module loading, credential request |
| `src/contexts/AuthContext.tsx` | `signInWithApple()`, alongside the Google flow |
| `src/components/SocialSignInButtons.tsx` | The button, iOS-only |
| `ios/ChatterboxTemp/ChatterboxTemp.entitlements` | `com.apple.developer.applesignin` |
| `ios/ChatterboxTemp.xcodeproj` | `CODE_SIGN_ENTITLEMENTS` set on both configurations |
| `package.json` | `@invertase/react-native-apple-authentication@^2.5.1` |
| `src/i18n/locales/en.json` | `auth.social.apple` |

## What you need to do

### 1. Install

```sh
npm install
cd ios && pod install
```

The dependency is declared but not installed — nobody has run `npm install`
since it was added. **The code has never been compiled against the real
module**; it is written against a narrow interface and its pure parts are
tested, but the native call itself is unverified. Expect to fix something.

### 2. Enable the capability on the App ID

In the [Apple Developer portal](https://developer.apple.com/account/resources/identifiers/list),
open the App ID for `com.chatterbox` and enable **Sign In with Apple**. Without
this, the build fails at the signing step with a provisioning-profile error
that does not mention Apple sign-in at all.

Xcode's *Signing & Capabilities* tab can do this for you if automatic signing
is on — add the "Sign in with Apple" capability there and it will update the
App ID and regenerate the profile. The entitlements file it wants to create
already exists, so it should adopt this one rather than making a second.

### 3. Enable the provider in Firebase

Firebase Console → Authentication → Sign-in method → **Apple** → Enable.

For an iOS-only integration you can leave the Services ID, Team ID and key
fields blank; they are needed only for the web/Android OAuth flow, which this
app does not use. Add the app's bundle ID (`com.chatterbox`) if prompted.

### 4. Verify on a real device

The simulator can present the sheet but cannot complete authentication, so this
needs hardware signed into an Apple ID.

- [ ] The button appears on the login and sign-up screens (iOS only).
- [ ] Tapping it presents the system sheet.
- [ ] Cancelling the sheet returns silently — **no error alert**.
- [ ] Completing it signs in and lands on the chat list.
- [ ] **First sign-in only**: the display name is populated from Apple.
- [ ] Sign out, sign in again: still signed in as the same account, and the
      display name is *not* wiped. Apple sends the name once and null forever
      after, so this is where a regression would show.
- [ ] Choosing "Hide My Email" works and produces a `@privaterelay.appleid.com`
      address.
- [ ] The button does **not** appear on Android.

## The part most likely to be got wrong later

The nonce. Apple receives `SHA256(raw)`; Firebase receives `raw` and re-hashes
it. Passing the same value to both, or dropping the nonce entirely, produces a
flow that works perfectly in every manual test and silently accepts replayed
identity tokens in production. `appleNonce()` is a separate function with its
own tests for exactly this reason — see `src/services/__tests__/appleAuth.test.ts`.

## Account deletion

Guideline 5.1.1(v) requires an in-app account deletion path for any app with
account creation. `account.ts`'s `deleteAccount` already provides one. Apple
additionally expects apps using Sign in with Apple to revoke the token on
deletion; the current implementation does not, which is worth confirming
against current review practice before submitting.
