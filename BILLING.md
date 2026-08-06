# Chatterbox Pro — billing setup

The Stripe subscription flow is **already implemented in code**. Nothing here
asks you to write any. What's missing is configuration: without the env vars
below, every billing callable deliberately rejects with
`failed-precondition: "Billing is not configured."`

## What already exists

| Piece | Where |
|---|---|
| Start checkout (plan → Stripe-hosted URL) | `functions/index.js` → `createCheckoutSession` |
| Manage/cancel subscription | `functions/index.js` → `createBillingPortalSession` |
| Subscription events → entitlement | `functions/index.js` → `stripeWebhook` |
| Entitlement rules (active? expired?) | `functions/entitlement.js` (+ tests) |
| Client calls | `web/src/services/billing.ts` |
| Buy buttons (monthly / yearly) | `web/src/screens/StoreScreen.tsx` |
| Live Pro state across the app | `web/src/context/EntitlementContext.tsx` |

Card details never touch this app — checkout and the billing portal are both
Stripe-hosted pages, which is what keeps this out of PCI scope.

Purchase is **web-only by design**. Apple and Google both require their own
in-app purchase for digital goods sold inside a mobile app, so the mobile
client reads the resulting entitlement but never sells it.

## Prerequisites

- Firebase project on the **Blaze** plan (Cloud Functions outbound network
  calls to Stripe require it).
- Stripe CLI: `npm i -g @stripe/cli` (or `brew install stripe/stripe-cli/stripe`)
- A Stripe account — **or not**, to start. `stripe sandbox create` issues
  working test keys with no registration at all, which is the fastest way to
  exercise this whole flow before committing to account setup. (If you go that
  route, skip the Stripe MCP server; run `stripe sandbox claim` first if you
  later want to use it.) You only need a real account to take real money, and
  eligibility depends on where the business entity is registered.

Use **test mode** for everything until the flow is verified end to end. Test
mode has its own separate keys, products, prices, and webhooks.

### Use a restricted key, not a secret key

Stripe's own guidance is to prefer a **restricted API key** (`rk_…`) over a
secret key (`sk_…`) wherever possible: a RAK carries only the permissions you
grant it, so a leaked one does far less damage.

This integration needs a small, well-defined set. Dashboard → **Developers →
API keys → Create restricted key**, and grant *write* on:

- **Checkout Sessions** — `createCheckoutSession`
- **Customers** — `getOrCreateStripeCustomer`
- **Billing Portal Sessions** — `createBillingPortalSession`

plus *read* on **Subscriptions** (the webhook re-reads the subscription as the
source of truth). Everything else can stay "None". If a call fails with `403`,
add the one permission it names rather than widening to a secret key.

`STRIPE_SECRET_KEY` is just the env var's name — an `rk_…` value belongs there.

## 1. Create the products and prices

Stripe Dashboard → **Product catalog** → *Add product*. Create one product
(e.g. "Chatterbox Pro") with **two recurring prices** — one monthly, one
yearly.

Then copy each **price ID**. Click into an individual price; the ID starts
with `price_`. A `prod_…` ID is the *product*, not the price, and will fail at
checkout.

## 2. Configure locally

```bash
cp functions/.env.example functions/.env
```

Fill in, using the restricted test key from the section above:

```
STRIPE_SECRET_KEY=rk_test_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
APP_BASE_URL=http://localhost:5173
```

Leave `STRIPE_WEBHOOK_SECRET` blank for now — step 3 produces it.

`functions/.env` is gitignored. Keep it that way; never commit real keys.

> **Why the client only sends a plan name:** the price ID is resolved
> server-side from an allowlist. If the client could pass a raw price ID, a
> tampered client could substitute any price in your account — including a $0
> one — and self-provision a subscription.

## 3. Test locally

The webhook is what actually grants Pro, so it has to be exercised. Forward
events to your local emulator:

```bash
stripe login
stripe listen --forward-to http://localhost:5001/chatterbox-e5d10/us-central1/stripeWebhook
```

`stripe listen` prints a signing secret (`whsec_…`) on start. Put it in
`functions/.env` as `STRIPE_WEBHOOK_SECRET`, then start the emulator:

```bash
cd functions && npm run serve    # or: firebase emulators:start --only functions
```

Buy through the UI (Store → Chatterbox Pro → Monthly), using a Stripe
[test card](https://stripe.com/docs/testing) such as `4242 4242 4242 4242`
with any future expiry and any CVC.

**Expected:** `stripe listen` logs `checkout.session.completed`, then
Firestore gains `entitlements/{yourUid}` with `status: "active"`, and the app
flips to Pro live (the Store badge unlocks, Profile → Subscription shows the
renewal date) without a refresh.

## 4. Configure production

### 4a. Add repo secrets

`functions/.env` is gitignored, so it cannot reach CI. The deploy workflow
rebuilds it from repo secrets instead — without this step the functions deploy
fine but answer "Billing is not configured" forever.

GitHub repo → **Settings → Secrets and variables → Actions** → *New repository
secret*, one each:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` *(from step 4c — deploy once first, it can be empty initially)*
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_YEARLY`
- `APP_BASE_URL` — your deployed origin, **no trailing slash**
  (e.g. `https://chatterbox-e5d10.web.app`)
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` *(unrelated to billing, but
  the same workflow step writes them — see the note in `.env.example`)*

`APP_BASE_URL` must match the web app's real origin **exactly**. Return URLs
are checked against it by origin comparison, so a mismatch makes every
checkout fail with `invalid-argument: Invalid return URL`.

### 4b. Deploy

GitHub → **Actions** → *Deploy Firebase Functions* → *Run workflow*.
(See `DEPLOYING.md` for why deploys go through Actions.)

### 4c. Register the webhook endpoint

Dashboard → **Developers → Webhooks** → *Add endpoint*.

**Endpoint URL:**

```
https://us-central1-chatterbox-e5d10.cloudfunctions.net/stripeWebhook
```

Select exactly these events — they're the ones the handler implements
(anything else is acknowledged and ignored):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Copy the endpoint's **Signing secret** (`whsec_…`) into the
`STRIPE_WEBHOOK_SECRET` repo secret, then re-run the deploy so it takes
effect. This secret is per-endpoint — the production one is *different* from
the `stripe listen` one used locally.

> Every webhook request is signature-verified against the raw body before
> anything is trusted. Without that, anyone who learned this URL could POST a
> forged "subscription active" event and grant themselves Pro.

## 5. Verify

- [ ] Store shows monthly + yearly buttons; clicking redirects to Stripe
- [ ] A test-card purchase redirects back to `?pro=success`
- [ ] Dashboard → Webhooks → your endpoint shows **200** responses
- [ ] `entitlements/{uid}` exists with `status: "active"` and a
      `currentPeriodEnd` in the future
- [ ] Pro unlocks live in the app (no refresh needed)
- [ ] Profile → Subscription → *Manage* opens the Stripe billing portal
- [ ] Cancelling in the portal flips the app out of Pro at period end

## 6. Going live

1. Redo steps 1 and 4c in **live mode** — live products, prices, and webhook
   endpoint are all separate objects with separate IDs.
2. Swap the repo secrets to the live values (a live-mode **restricted** key
   `rk_live_…` with the same permissions, live `price_…`, the live endpoint's
   `whsec_…`). Never put a live key in source — only in repo secrets.
3. Re-run the deploy.
4. Make one real purchase and refund it, to confirm the live path end to end.

## Troubleshooting

**"Billing is not configured."** — `STRIPE_SECRET_KEY` isn't reaching the
function. In production this almost always means the repo secret is missing or
the deploy predates it; re-run the deploy after adding it.

**Checkout succeeds but Pro never activates.** — The webhook isn't landing.
Check Dashboard → Webhooks for non-200 responses. A 400 means the signing
secret doesn't match the endpoint; a 500 means `STRIPE_WEBHOOK_SECRET` is
missing entirely.

**`invalid-argument: Invalid return URL`** — `APP_BASE_URL` doesn't match the
origin the app is served from. Compare them exactly: scheme, host, port, no
trailing slash.

**`failed-precondition: No price configured for monthly.`** — the price ID env
var is blank, or holds a `prod_…` instead of a `price_…`.

**`resource-exhausted`** — the per-user rate limit (5 checkout or portal calls
per minute) tripped. Expected under rapid retries; wait a minute.

**Entitlement looks stale or went backwards.** — Out-of-order Stripe events
are ignored on purpose: each write records `lastEventAt`, and an event older
than the stored one is skipped so a delayed retry can't resurrect a cancelled
subscription. Check the function logs for "Ignoring out-of-order Stripe event".
