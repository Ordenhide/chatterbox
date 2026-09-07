# Provisioning and device verification

Everything here needs credentials, hardware, or an account that a repository
does not have. Each entry says what breaks without it and how you would know —
because most of these fail *silently*, which is what makes them easy to leave
undone indefinitely.

---

## 1. GitHub Actions secrets

Set at **Settings → Secrets and variables → Actions**. Five of thirteen are
configured; the table marks the rest.

### Blocking — the workflow fails without it

| Secret | Used by | Without it |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | `deploy-functions`, `deploy-rules` | **Missing.** No function or rules deploy runs at all. |

A service account for project `chatterbox-e5d10`; store the entire JSON key as
the secret value. **Set**, but the roles still need granting — see DEPLOYING.md
for the per-workflow table and the exact errors each missing role produces.

Rules deploy needs `Firebase Rules Admin` and `Service Usage Consumer`;
functions additionally need `Cloud Functions Admin`, `Service Account User`,
`Cloud Build Editor` and `Cloud Scheduler Admin`. The auto-created
`firebase-adminsdk-*` account has none of them by default.

Both workflows now check for this before doing anything and fail with that
instruction. Previously they failed inside `google-github-actions/auth` with a
malformed-credentials error that never mentioned the secret.

### Non-blocking — the deploy succeeds with the feature turned off

These are feature switches in `functions/index.js`, and a deploy without them
is a deliberate, supported state: the app ships with billing disabled rather
than not shipping. The workflow now prints a warning and a job-summary line
naming exactly which are missing, so it is visible rather than assumed.

| Secret | Without it |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | **Missing.** Media transforms disabled. |
| `CLOUDFLARE_API_TOKEN` | **Missing.** Media transforms disabled. |

### Already configured

`CHATTERBOX_KEYSTORE_BASE64`, `CHATTERBOX_KEY_ALIAS`, `CHATTERBOX_KEY_PASSWORD`,
`CHATTERBOX_STORE_PASSWORD`, `CHATTERBOX_GOOGLE_SERVICES_JSON_BASE64` — the
Android release-signing set. `release-apk.yml` works.

---

## 2. TURN server

**Not provisioned.** Calls currently run STUN-only.

This is the entry most worth doing, because its failure mode is the most
deceptive: STUN alone works whenever one peer is directly reachable, so calls
succeed on shared Wi-Fi and in every test you are likely to run by hand. They
fail between two phones on separate mobile networks — two symmetric NATs,
neither reachable — which is the ordinary case in production. Users report it
as "calls don't work sometimes".

Set three keys in **Firebase Console → Remote Config**:

```
turn_url          turn:host:3478?transport=udp,turns:host:5349?transport=tcp
turn_username
turn_credential
```

`src/config/rtc.ts` reads them at call setup — deliberately from Remote Config
rather than the bundle, since TURN credentials are usually short-lived and a
baked-in value can only change with a store release.

**How you will know it worked.** Every call now reports its ICE configuration
as a `call_ice_config` analytics event with `status` of `turn`,
`turn-anonymous`, or `stun-only`. Before provisioning, expect 100% `stun-only`.
After, expect `turn`. `turn-anonymous` means the URL was set and the
credentials were not — a half-finished setup, not a working one.

Verify properly on **two devices on different mobile networks with Wi-Fi off**.
Any test on one network proves nothing about the thing TURN fixes.

---

## 3. Keychain migration — needs a device with an existing install

Landed in `d998696`; **never verified on hardware**. It cannot be checked on a
fresh install, because the entire point is what happens to a key that is
already in MMKV.

The design is fail-safe by construction: migration only ever *adds* a copy, and
the MMKV copy is deleted only after the value has been read back out of the
Keychain (`readSecretKeyHex` in `e2eeKeys.ts`). The risk being checked is not
the logic but the platform — that `react-native-keychain` behaves as assumed
across an app upgrade.

The stake is the highest in the app: losing this key means losing every message
the user can decrypt, recoverable only from a phrase most users never wrote
down.

**Procedure** — the order matters, and step 1 must be a build *without* the
Keychain module:

- [ ] Install a pre-Keychain build. Sign in, send and receive an encrypted
      message in a 1:1 chat. Confirm the key is in MMKV, not the Keychain.
- [ ] Upgrade in place to the current build — **upgrade, not reinstall**. A
      reinstall clears app storage and tests nothing.
- [ ] Open the chat. **Old messages must still decrypt.** This is the whole
      test; a failure here is data loss.
- [ ] Force-quit and reopen. Messages still decrypt (proves the migrated copy
      is what is being read, not a cache).
- [ ] Send a new message and confirm the other device reads it (proves the
      identity key still matches the published public key).
- [ ] Delete the account. Confirm the Keychain entry
      `com.chatterbox.e2ee.secretKey.<uid>` is gone — an MMKV-only wipe would
      leave the identity key on the device forever after deletion.
- [ ] Repeat on Android, where the Keystore is a different implementation.

---

## 3b. MMKV key migration — also needs an existing install

The store encryption key moved from an unencrypted file into the Keychain.
Verified by 25 tests against a mock that models encryption (a store opened with
the wrong key reads nothing), but never on hardware.

The migration is designed to have no interruptible window: the *existing* key
is copied into the key store unchanged, so there is never a moment when the
recorded key is not the store's key. Nothing is re-encrypted. What needs
checking on a device is the platform behaviour around that, not the logic.

- [ ] Install a build from before this change. Sign in, open some chats so
      messages are cached, change a setting (e.g. screenshot protection on).
- [ ] Upgrade in place — **not a reinstall**.
- [ ] **Cached messages are still there** when opening a chat offline.
- [ ] **The changed setting survived.** Preferences move to a separate store,
      so this is the migration most likely to be silently lost.
- [ ] Force-quit and reopen; both still hold.
- [ ] Sign out and back in. The store must still work — a deleted key would
      leave a file on disk nothing can open.
- [ ] Repeat on Android.

---

## 4. Forward secrecy and encrypted media — needs two devices

Phases 2a–2e and the attachment encryption are covered by 851 tests but have
**never run on real hardware**. The tests use in-memory doubles for Firestore
and the key store, so they prove the logic and nothing about the platform.

- [ ] **First message between two upgraded devices** establishes a session and
      decrypts. This is the X3DH handshake — the step with the most moving
      parts.
- [ ] Reply in both directions several times; all readable.
- [ ] **Offline group member**: with device C offline, have A send to a group,
      then bring C back online. C must be able to read A's messages. This is
      the path where a design flaw was found and fixed during phase 2d, and it
      failed *silently and permanently* before the fix.
- [ ] Remove a member; remaining members' messages stay readable and the
      removed member's device stops being able to read new ones.
- [ ] **Send a photo, a video, a voice message, and a document.** Each must
      display or play on the receiving device.
- [ ] Confirm in the Firebase Storage console that the uploaded object is
      **not** a viewable image — it should be opaque bytes with a random name.
- [ ] Mixed versions: one device on an older build. Attachments must still
      arrive, unencrypted, rather than appearing broken.
- [ ] Sign out and confirm decrypted attachments are gone from the app's cache
      directory.
- [ ] **Schedule a message, then check the Firestore console before it is
      delivered.** `chats/{id}/scheduledMessages/{id}` must show an `encrypted`
      envelope and an empty `text`. This one used to store the message in the
      clear, so it is worth looking at with your own eyes rather than trusting
      the delivered result — a delivered message looks the same either way.
- [ ] Let it deliver and confirm the recipient can read it. Mobile seals
      scheduled messages through the fan-out path rather than the ratchet, and
      that branch is the one part of this change no test reaches (see the
      commit "Stop storing scheduled messages in plaintext").
- [ ] Schedule one, then cancel it, and confirm ordinary messages sent
      afterwards still decrypt on the other device.

---

## 5. App Check enforcement

App Check is initialised on the clients, but nothing on the server ever
verified a token — and **unenforced App Check protects nothing**. It is a token
the client bothers to fetch and the server never looks at, so any script
holding a stolen or self-registered ID token can call the callable functions
directly, which is the exact thing App Check exists to stop.

The code is in place and inert. Turning it on is a console decision, not a code
one, because enforcing before the providers are registered rejects **every call
from every client** — a total outage. The order matters:

1. **Register providers** — Firebase Console → App Check: App Attest (or
   DeviceCheck) for the iOS app, Play Integrity for Android.
2. **Add a debug token** for local development, or every debug build breaks.
3. **Watch the metrics.** The console shows verified vs unverified requests per
   service. Wait until unverified requests are near zero — anything else means
   real users on older builds would be locked out.
4. **Only then enforce.** Set the repo *variable* (not secret)
   `CHATTERBOX_ENFORCE_APP_CHECK` to `true`, or `CHATTERBOX_ENFORCE_APP_CHECK=true`
   in `functions/.env`, and redeploy.
5. Enforce for Firestore and Storage separately in the console when ready;
   those are independent of this flag.

Rolling back is the same switch in reverse, and takes a redeploy.

---

## 6. Sign in with Apple

See `SIGN_IN_WITH_APPLE.md`. Code is in place; the dependency has never been
installed, and the Apple Developer and Firebase Console steps remain.
