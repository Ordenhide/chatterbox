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
| Mobile ICE config (calls the Cloud Function) | `src/config/rtc.ts` → `describeIceServers()` |
| Mobile call UI + peer connection | `src/screens/chat/CallScreen.tsx` |
| Web ICE config (calls the same function) | `web/src/services/call.ts` → `getIceServers()` |
| Web call UI + peer connection | `web/src/components/CallModal.tsx` |
| Web screen sharing | `web/src/components/CallModal.tsx` → `startSharing()` |
| Credential minting | `functions/index.js` → `getTurnCredentials` |

Both clients fall back to STUN-only when TURN is unconfigured or the function
call fails, so filling this in is additive — nothing breaks if you leave it,
beyond what already doesn't work.

## Provider: Cloudflare Realtime, credentials minted per call

This project already uses a Cloudflare account for Workers AI (see
`CLOUDFLARE_ACCOUNT_ID` in `functions/.env.example`), so this adds a service
rather than a vendor, and its free tier covers far more relayed traffic than
this app will produce.

It does **not** work the way most TURN setup guides assume. Cloudflare
doesn't hand out a static username/password to paste into a client config —
it hands out a **TURN Key** (an ID plus a long-term API token), and the
actual per-connection `username`/`credential` has to be minted on demand by
calling Cloudflare's API with that token. `getTurnCredentials` does exactly
that: a signed-in user calls it right before a call starts, it asks
Cloudflare for a short-lived (1 hour) credential, and hands back the whole
`iceServers` array (STUN entry included) to use for that call only. The
long-term key never reaches a client.

1. Cloudflare dashboard → **Realtime** → **TURN Service** → create a TURN Key.
2. Copy its **Key ID** and the **API token** it issues.

A different TURN provider that *does* issue static long-lived credentials
(Twilio, Metered, self-hosted `coturn`) would need `getTurnCredentials`
rewritten to skip the mint-on-demand step and return a fixed entry instead —
not a config change, a small code change.

## Where the values go

One place, for both clients — `functions/.env` (see
`functions/.env.example`'s "Calling / TURN" section):

```
CLOUDFLARE_TURN_KEY_ID=...
CLOUDFLARE_TURN_API_TOKEN=...
```

For CI deploys, the same two values also need to exist as the GitHub repo
secrets `CLOUDFLARE_TURN_KEY_ID` / `CLOUDFLARE_TURN_API_TOKEN`
(`.github/workflows/deploy-functions.yml` rebuilds `functions/.env` from repo
secrets at deploy time, the same way it already does for the Workers AI
pair). Redeploy functions and both clients pick it up on their next call —
no client-side config, no rebuild, no store release.

## Verifying it works

There's no static credential sitting in a config file to copy any more, so
getting one to test with means either:

- Calling the deployed function once and reading back its result (e.g. via
  `firebase functions:shell`, or by adding a temporary log line and starting
  a call from a real client), or
- Hitting Cloudflare's endpoint directly:
  ```
  curl -X POST \
    -H "Authorization: Bearer $CLOUDFLARE_TURN_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"ttl": 3600}' \
    https://rtc.live.cloudflare.com/v1/turn/keys/$CLOUDFLARE_TURN_KEY_ID/credentials/generate-ice-servers
  ```

Either way, paste the resulting `username`/`credential`/TURN URL into the
standard WebRTC [Trickle ICE
tester](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
and gather candidates.

- A candidate of type **`relay`** means TURN is working.
- Only `host` / `srflx` candidates means it is not — usually a wrong or
  already-expired credential, or a blocked port.

This checks the credentials themselves from one machine, which is worth doing
*before* concluding a failed call is the app's fault.

Then test a real call **between two different networks** (e.g. one device on
Wi-Fi, one on cellular with Wi-Fi off). A same-network call succeeds over STUN
and proves nothing about TURN.
