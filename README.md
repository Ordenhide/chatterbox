# Chatterbox

An end-to-end encrypted messenger with no phone number, no email address and
no user directory. Your account is a 24-word recovery phrase.

- **Android:** [chatterbox-latest.apk](https://dl.chatterbox.fans/chatterbox-latest.apk), or via [chatterbox.fans](https://chatterbox.fans)
- **Web:** [chatterbox.fans/app](https://chatterbox.fans/app/)
- **iOS:** not available

## What is encrypted

Encrypted on your device, unreadable to the server and to Google:

- the text of your messages
- the contents of attachments — files, photos, audio, video
- link previews
- voice and video calls (WebRTC, DTLS-SRTP between the two devices)

Most one-to-one and group messages use a ratchet (X3DH and a double ratchet;
sender keys in groups), so each message has its own key and a compromised
device does not expose earlier messages. A conversation where someone's client
has not yet published the newer key material falls back to a single long-lived
key, which does not have that property. The label under each message says
which one it got, and that label is read from the message itself, not from a
setting.

## What the server can see

Encryption protects contents, not the fact of a conversation. These are in the
clear on the server:

- who is in each conversation, and when it was created and last active
- the timestamp of every message, and unread counts
- an attachment's file name, type and size
- your friends and friend requests
- call signalling — that a call was placed, to whom, and when

The app runs on Google Firebase, so Google also sees the IP address and timing
of every connection. When a call cannot connect directly, it is relayed through
Cloudflare, which then sees both IP addresses and the call's timing, but not its
audio or video.

This metadata is the weakest part of the design. The
[privacy policy](https://chatterbox.fans/privacy) lists everything, including
what is sent to third parties and when.

## Accounts

- **No identifiers.** Sign-up generates 32 random bytes and shows them as 24
  words. The login credential and the encryption key are both derived from
  them. The app never asks for an email address, phone number or name.
- **No recovery.** If you lose the words, you lose the account. Nobody can
  reset it, including us. (Versions up to 1.2.0 also copied the words to
  Google Block Store, Android's own backup; 1.2.1 stopped, and deletes that
  copy on launch.)
- **No directory.** Nobody can search for you. You reach someone with an invite
  link, sent through whatever you already use. A link works once and expires
  after 24 hours.
- **One device at a time.** Signing in on a new device signs out the old one.

## What it does not have

- no analytics or crash reporting
- no ads, payments or premium tier

Summaries, translation and transcription are still in the code but switched off
in this release, and nothing in the app turns them on.

## Verifying the APK

Since v1.2.0 the APK is built and signed by GitHub Actions from the tagged
commit ([`release-apk.yml`](.github/workflows/release-apk.yml)). Every release
has been signed with the same key:

```
SHA-256: e0bc22d4b41e0cae30618d4c8e156b3f6bfc3b0a51cbe8b299474783016fd853
SHA-1:   3e3bf4909ee6bc96573b8e6d5d7344336ae8bf49
```

```sh
apksigner verify --print-certs chatterbox-latest.apk
```

The notes for each [GitHub Release](https://github.com/Ordenhide/chatterbox/releases)
include the APK's own SHA-256:

```sh
shasum -a 256 chatterbox-latest.apk    # macOS
sha256sum chatterbox-latest.apk        # Linux
```

## Where to look in the code

| What | Where |
|---|---|
| Recovery phrase to credential and key | [`src/services/anonymousIdentity.ts`](src/services/anonymousIdentity.ts) |
| Message encryption | [`src/services/e2ee.ts`](src/services/e2ee.ts), [`src/services/ratchet/`](src/services/ratchet/) |
| Attachment encryption | [`src/services/mediaCrypto.ts`](src/services/mediaCrypto.ts) |
| Invite links | [`src/services/invites.ts`](src/services/invites.ts) |
| What the server allows | [`firestore.rules`](firestore.rules), [`storage.rules`](storage.rules) |
| Tests for those rules | [`test/rules/`](test/rules/) |
| Privacy policy source | [`src/i18n/privacyPolicy.ts`](src/i18n/privacyPolicy.ts) |

`web/` is a separate implementation of the same protocol, not shared code;
[`web/src/services/crossClient.test.ts`](web/src/services/crossClient.test.ts)
checks that the two clients can read each other's messages and attachments.

## Building from source

The web client:

```sh
git clone https://github.com/Ordenhide/chatterbox
cd chatterbox/web
npm install
npm run dev
```

It connects to the production Firebase project unless the variables in
[`web/.env.example`](web/.env.example) point it somewhere else.

The Android app needs a `google-services.json` for your own Firebase project in
`android/app/`. That file is not in the repository.

```sh
npm install
npm run android
```

Tests:

```sh
npm test                # mobile unit tests (Jest)
npm run test:rules      # security rules, against the Firestore and Storage emulators
npm run test:auth       # sign-up and sign-in, against the Auth and Firestore emulators
cd web && npm test      # web unit tests (Vitest)
```

The emulator suites need `firebase-tools` and a JDK. Deployment is described in
[`DEPLOYING.md`](DEPLOYING.md).

## Reporting a vulnerability

Email privacy@chatterbox.fans. Please do not open a public issue.

## License

[GNU Affero General Public License v3.0](LICENSE). You may read, modify and
redistribute this code; a modified version you distribute, or run as a service
for others, must be published under the same license.
