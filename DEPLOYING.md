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
`chatterbox-e5d10`.

It is now set, and the roles below are what an actual deploy attempt turned out
to need. They are listed per workflow because the two need different things and
the rules deploy is the one worth getting working first.

**Rules** (`deploy-rules.yml`):

| Role | Why |
|---|---|
| `Firebase Rules Admin` | writes the ruleset and points the release at it |
| `Service Usage Consumer` | `firebase-tools` checks whether `firebasestorage.googleapis.com` is enabled *before* deploying storage rules, and that check needs `serviceusage.services.get` |

The second one is not in any Firebase documentation and is easy to miss,
because the failure names an API rather than a permission:

```
i  storage: ensuring required API firebasestorage.googleapis.com is enabled...
Error: ... HTTP Error: 403, Permission denied to get service
       [firebasestorage.googleapis.com]
```

That aborts the whole command at the storage step, so **the Firestore rules are
never attempted either** — a missing role on the storage half silently blocks
the Firestore half.

**Functions** (`deploy-functions.yml`):

| Role | Why |
|---|---|
| `Cloud Functions Admin` | creates and updates the functions |
| `Service Account User` | `iam.serviceAccounts.actAs` on the runtime account `chatterbox-e5d10@appspot.gserviceaccount.com` — deploying a function means granting it that identity |
| `Cloud Build Editor` | 2nd-gen functions build through Cloud Build |
| `Cloud Scheduler Admin` | the six pubsub functions each need a Cloud Scheduler job created or updated |

Cloud Scheduler Admin is easy to miss because its absence is a *partial*
failure: every non-scheduled function deploys fine and only the six scheduled
ones fail, with `cloudscheduler.jobs.update` denied. The run fails, but most of
what it was asked to do already succeeded.

**Hosting** (`release-apk.yml`, on a `v*` tag only):

| Role | Why |
|---|---|
| `Firebase Hosting Admin` | uploads the site version and releases it |
| `Service Usage Consumer` | same API-enabled precheck as the rules deploy |

**Unlike the two tables above, this one has never been proved by a deploy.**
The Hosting step was added on 2026-09-20 to self-distribute the APK, it runs
only on a `v*` tag, and no tag has been pushed since — so the first release is
also the first time this service account will have been asked to touch
Hosting. The roles are what the API requires, not what a failure taught us,
and this note stays until a real tag has gone out.

It matters more than a missing role usually would, because of where the step
sits: the Hosting deploy runs *before* both the artifact upload and the APK's
attachment to the GitHub Release. A 403 there fails the job with the signed
APK built and then discarded — the upload step is gated on success, so there
is nothing to download and no release published. Grant the role and re-run;
nothing is left half-published, because neither upload has happened yet.

The project's auto-created `firebase-adminsdk-*` service account has none of
these by default — its stock `Firebase Admin SDK Administrator Service Agent`
role covers Admin SDK data access, not deployment.

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
createCheckoutSession  fetchLinkPreview     getTurnCredentials
markViewOnceViewed   notifyNewMessage       onCallEnded
sessionHeartbeat     stripeWebhook          summarizeChat
transcribeVoiceMessage  translateMessage
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
roles above. Two are easy to miss for opposite reasons: Cloud Build Editor
because its absence only shows up at the build step, and Service Usage Consumer
because the error names an API rather than a permission (see the rules table
above).

**Blaze-plan errors** — billing is off and something scheduled slipped into
`exports`. Check `CHATTERBOX_ENABLE_SCHEDULED`.

**Rules deploy blocked** — the emulator tests failed. Read them; they run the
real `firestore.rules`, so a failure is a real rule change, not a flaky test.
