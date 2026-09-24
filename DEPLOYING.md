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
| `release-apk.yml` | tag `v*`, or manual | Signed Android APK, the site (Cloudflare Pages), the APK (R2) |
| `ci.yml` | every push and PR | Nothing — lint, typecheck, tests |

`deploy-rules.yml` runs the rules tests against the emulator first and will not
deploy if they fail. `deploy-functions.yml` does not run tests; `ci.yml` covers
that on the same push.

## The required secrets

`FIREBASE_SERVICE_ACCOUNT` — the full JSON key for a service account on project
`chatterbox-e5d10`. Used by `deploy-functions.yml` and `deploy-rules.yml`.

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — used by `release-apk.yml`
to publish the site and the APK. See the Cloudflare section below; the site is
no longer on Firebase Hosting, and that workflow no longer touches Google
Cloud at all.

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

The project's auto-created `firebase-adminsdk-*` service account has none of
these by default — its stock `Firebase Admin SDK Administrator Service Agent`
role covers Admin SDK data access, not deployment.

Everything else is optional and turns individual features on. `PROVISIONING.md`
lists them with what breaks without each.

## Cloudflare: the site and the APK

The site left Firebase Hosting on 2026-09-24. `release-apk.yml` publishes two
things on a `v*` tag, in this order, and the order is load-bearing:

1. the APK to an **R2** bucket, and
2. the site to **Cloudflare Pages**,

because the site is what advertises the download. `siteDeploy.test.ts` asserts
the order, so it cannot be reversed by a reorganised workflow.

### What has to exist in the account first

This is the part no workflow can create, and a tag pushed before it is done
publishes a site whose download button resolves nowhere.

| Thing | Value | Why |
|---|---|---|
| Pages project | `chatterbox` | `CF_PAGES_PROJECT` in the workflow; `name` in `wrangler.toml` |
| R2 bucket | `chatterbox-downloads` | `R2_BUCKET` in the workflow |
| Bucket custom domain | `dl.chatterbox.app` | `APK_PUBLIC_URL` in the workflow **and** `APK_URL` in `scripts/build-site-html.mjs` — a test asserts the two agree |
| API token | Pages:Edit + R2:Edit on this account | `CLOUDFLARE_API_TOKEN` |
| Account id | — | `CLOUDFLARE_ACCOUNT_ID` |

Use a **custom domain** on the bucket, not the `r2.dev` URL: Cloudflare
documents that one as a development URL, rate-limited and not for production
traffic.

### Why R2 and not Pages

A Cloudflare Pages asset is capped at **25 MiB**. The APK is about 122 MB, so a
deploy carrying it does not get slower, it fails — and it would have failed on
the first tag, with the signed APK already built. R2 has no such cap and its
egress is free, which also removes what this used to cost on Firebase Hosting:
10 GB/month free, then $0.15/GB, and at 122 MB a download that is about 82
downloads a month before the meter starts.

### First-deploy checks

None of this has run yet, so read the run rather than trusting it:

- **`/app/` loads the app, not its own HTML.** `_redirects` has
  `/app/* /app/index.html 200`, and real files are documented to win over that
  pattern — but that has never been observed here. If `/app/assets/*.js` comes
  back as the shell, that is the reason.
- **`/index.zh-Hans` resolves.** All 53 pages link each other without `.html`,
  which relied on Firebase's `cleanUrls`. Pages strips `.html` by default, so
  this should hold; a 404 on every language switcher is the failure.
- **The web client can reach the microphone.** `_headers` splits
  `Permissions-Policy` per path group on purpose: Cloudflare joins a repeated
  header with a comma instead of overriding it, and the first occurrence of a
  directive wins. A catch-all `microphone=()` would silently deny calls and
  voice messages with nothing in the app able to say why.
- **`dl.chatterbox.app/chatterbox-latest.apk` downloads, with
  `Content-Type: application/vnd.android.package-archive`.** Served as anything
  else, Android's installer will not open it.

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

**The site or the APK did not publish** — that is Cloudflare now, not Google.
`release-apk.yml` checks `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
before publishing anything and names whichever is missing. A token that exists
but lacks Pages:Edit or R2:Edit fails at the step that needs it, with the APK
already built — the artifact upload is `if: always()`, so it is still there to
download.

**Blaze-plan errors** — billing is off and something scheduled slipped into
`exports`. Check `CHATTERBOX_ENABLE_SCHEDULED`.

**Rules deploy blocked** — the emulator tests failed. Read them; they run the
real `firestore.rules`, so a failure is a real rule change, not a flaky test.
