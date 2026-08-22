# Voice & video calls — TURN setup

Calling is **already implemented in code** on both clients. Nothing here asks
you to write any. What's missing is one piece of configuration: a TURN server.

Without it both clients run **STUN-only**, which is the state this project has
shipped in so far.

## Why this is required, not an optimisation

STUN only tells each peer what its own public address looks like. That is
enough when at least one side is directly reachable once discovered — two
devices on the same Wi-Fi, or behind a permissive home router.

It is **not** enough between two symmetric NATs, which is what most mobile
carriers use. There, neither side can be reached at the address the other
learned, so ICE finds no working path and the call fails with no error message
worth reading — it simply never connects.

TURN is a relay that both peers *can* reach. It is what makes calling work
between two phones on different mobile networks.

Practical consequence: **calls appear to work in local testing and fail in the
field**, which is the most expensive way to discover this.

## What already exists

| Piece | Where |
|---|---|
| Mobile ICE config (reads Remote Config) | `src/config/rtc.ts` → `getIceServers()` |
| Mobile call UI + peer connection | `src/screens/chat/CallScreen.tsx` |
| Web ICE config (reads build-time env) | `web/src/services/call.ts` → `ICE_SERVERS` |
| Web call UI + peer connection | `web/src/components/CallModal.tsx` |
| Web screen sharing | `web/src/components/CallModal.tsx` → `startSharing()` |

Both clients fall back to STUN-only when TURN is unconfigured, so filling this
in is additive — nothing breaks if you leave it, beyond what already doesn't
work.

## Recommended: Cloudflare Realtime

This project already uses a Cloudflare account for Workers AI (see
`CLOUDFLARE_ACCOUNT_ID` in `functions/.env.example`), so this adds a service
rather than a vendor. Its free tier covers far more relayed traffic than this
app will produce.

Any TURN provider works — Twilio and Metered are equally fine, and self-hosted
`coturn` is cheaper at volume. The three values below are all that differ.

1. Cloudflare dashboard → **Realtime** → **TURN Server** → create one.
2. Copy the **TURN URLs**, **username**, and **credential** it issues.

## Where the values go

The two clients read them from different places, deliberately.

### Mobile — Firebase Remote Config

Firebase Console → **Remote Config** → add three string parameters:

| Key | Example |
|---|---|
| `turn_url` | `turn:host:3478?transport=udp,turns:host:5349?transport=tcp` |
| `turn_username` | *(from your provider)* |
| `turn_credential` | *(from your provider)* |

`turn_url` accepts a comma-separated list. Publish the changes.

Remote Config rather than a bundled constant because TURN credentials are
typically short-lived and rotated — baking them into the app would mean an App
Store review every rotation. Clients pick up changes within Remote Config's
fetch interval (1 hour, see `src/services/featureFlags.ts`), or immediately on
next cold start.

### Web — build-time env

In `web/.env.local` (see `web/.env.example`):

```
VITE_TURN_URL=turn:host:3478?transport=udp,turns:host:5349?transport=tcp
VITE_TURN_USERNAME=...
VITE_TURN_CREDENTIAL=...
```

Then rebuild. Env vars rather than Remote Config here because rotating means a
static-site redeploy, not a store release.

If you set the URL but omit username/credential, the entry is sent **without**
credentials rather than with blank ones — a TURN server rejects blanks, and an
entry that always fails auth is worse than none, since ICE spends time on it
before giving up.

## Verifying it works

Use the standard WebRTC [Trickle ICE
tester](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
— paste the URL, username and credential, and gather candidates.

- A candidate of type **`relay`** means TURN is working.
- Only `host` / `srflx` candidates means it is not — usually a wrong
  credential, an expired one, or a blocked port.

This checks the credentials themselves from one machine, which is worth doing
*before* concluding a failed call is the app's fault.

Then test a real call **between two different networks** (e.g. one device on
Wi-Fi, one on cellular with Wi-Fi off). A same-network call succeeds over STUN
and proves nothing about TURN.
