# Deploying

> Rewritten. The previous version was built on the claim that *"Firebase CLI
> doesn't support service account authentication for deployment"* and walked
> through obtaining a `firebase login:ci` token as the way around it. That
> claim is false, the workflow in this repository has never used such a token,
> and `firebase login:ci` is deprecated. Anyone following the old instructions
> was configuring a secret nothing reads.

Everything deploys from GitHub Actions using a service account. Nothing needs a
browser login, a CI token, or a VPN.

## What deploys, and when

| Workflow | Trigger | Deploys |
|---|---|---|
| `deploy-functions.yml` | push to `main` touching `functions/**`, or manual | Cloud Functions |
| `deploy-rules.yml` | push to `main` touching the rules, or manual | Firestore + Storage rules |
| `release-apk.yml` | tag `v*`, or manual | Signed Android APK |
| `ci.yml` | every push and PR | Nothing — lint, typecheck, tests |

`deploy-rules.yml` runs the rules tests against the emulator first and will not
deploy if they fail. `deploy-functions.yml` does not run tests; `ci.yml` covers
that on the same push.

## The one required secret

`FIREBASE_SERVICE_ACCOUNT` — the full JSON key for a service account on project
`chatterbox-e5d10`, with **Cloud Functions Admin**, **Service Account User**,
and **Cloud Build Editor** (2nd-gen functions build through Cloud Build).

It is not currently set, so **no function or rules deploy has ever run**. Both
workflows now check for it up front and fail with that instruction; before, the
failure surfaced inside `google-github-actions/auth` as a malformed-credentials
error that never named the secret.

Everything else is optional and turns individual features on. `PROVISIONING.md`
lists them with what breaks without each.

## How authentication actually works

`google-github-actions/auth` writes the key to a file and exports
`GOOGLE_APPLICATION_CREDENTIALS`. `firebase-tools` picks that up, exactly as
the Admin SDK does. No OAuth, no browser.

This replaced `FirebaseExtended/action-hosting-deploy`, which only deploys
Hosting and has no mechanism for Cloud Functions — so that earlier workflow
never shipped a function no matter how many times it ran green.

## Functions currently exported

```
autoReplyFocusMode   claimSession           createBillingPortalSession
createCheckoutSession  fetchLinkPreview     markViewOnceViewed
notifyNewMessage     onCallEnded            sessionHeartbeat
stripeWebhook        summarizeChat          transcribeVoiceMessage
translateMessage
```

Six scheduled (pubsub) functions are defined but stripped from `exports` unless
`CHATTERBOX_ENABLE_SCHEDULED=true`, because Cloud Scheduler needs the Blaze
plan and its absence fails the whole deploy rather than just those functions.
The deploy workflow sets it. See the long comment at the top of `functions/index.js`
for why the flag is read from `.env` and not only from `process.env` — reading
only the environment silently disabled them, which is why disappearing messages
never expired.

## Deploying by hand

Rarely needed, and it requires credentials the CI already holds:

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
npx firebase-tools@^15 deploy --only functions --project chatterbox-e5d10 --non-interactive
npx firebase-tools@^15 deploy --only firestore:rules,storage --project chatterbox-e5d10 --non-interactive
```

Run the rules tests first — the workflow does, and this does not:

```sh
npm run test:rules
```

## Verifying

```sh
npx firebase-tools@^15 functions:list --project chatterbox-e5d10
```

The Actions run log is the other source of truth; a deploy that reports success
without an `i functions:` upload line deployed nothing.

## When a deploy fails

**Malformed or missing credentials** — `FIREBASE_SERVICE_ACCOUNT` is unset or
is not the complete JSON key file. The preflight step now catches this first.

**Permission denied on deploy** — the service account is missing one of the
three roles above. Cloud Build Editor is the one usually forgotten, and its
absence only shows up at the build step.

**Blaze-plan errors** — billing is off and something scheduled slipped into
`exports`. Check `CHATTERBOX_ENABLE_SCHEDULED`.

**Rules deploy blocked** — the emulator tests failed. Read them; they run the
real `firestore.rules`, so a failure is a real rule change, not a flaky test.
