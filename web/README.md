# Chatterbox Web

A companion **web client** for the Chatterbox mobile app. It's a separate, small
React app (Vite + TypeScript) that talks to the **same Firebase project** via the
Firebase **JS SDK**, using the **same Firestore data model** as the mobile app —
so a message sent from the web shows up on mobile and vice-versa.

This exists because the React Native app is too native-module-heavy to run
directly on the web (or Windows). A web build sidesteps all of that and reaches
**Mac, Windows, Linux, and mobile browsers** from one codebase. See
`../MACOS_BUILD.md` for how this fits with the native builds.

## What's implemented

Mirrors the mobile app's three-tab structure (Chats / Moments / Profile) via a
left nav rail.

**Auth**
- Email/password **sign in & sign up** (Firebase Auth). Sign-up writes a
  schema-compatible `users/{uid}` doc so the account is discoverable by email
  and visible to the mobile app.

**Chats**
- **Chat list** — real-time, with unread badges and the other participant's name.
- **Chat** — real-time messages, sending text. Uses the exact same message
  document shape (`_id`, `text`, `createdAt`, `user`) and the same
  `lastMessage` / `unreadCountBy` chat-metadata update as the mobile
  `sendMessage`, so the two clients interoperate.
- **New chat by email** — looks up the user and opens (or reuses) a 1:1 chat.
- **Photo, file & voice messages** — attach an image or any file, or record a
  voice note in-browser (`MediaRecorder`); uploaded to Firebase **Storage** with
  a live progress bar and sent with the same media schema as mobile (`image`,
  `file`, `audio` + `audioDuration`), so they render on both clients. Files show
  as a download card; voice notes get an inline play/pause player with a
  waveform; images render inline. You can also **drag-and-drop** or **paste** an
  image straight into a conversation.
- **Message history & pagination** — a conversation live-subscribes to the
  newest page (30) and **loads older messages** as you scroll up (`startAfter`
  cursor), with scroll position preserved — full history, not a hard 50-message
  cap.
- **In-conversation search** — filter the current chat's messages from the header.
- **Edit** your own messages (stamps `editedAt`, shown as "(edited)"), plus
  **reactions**, **delete**, **typing indicator**, **read receipts** ("Seen"),
  and **bookmark** — all schema-matched (`reactions` map, `typingBy`, `lastReadAt`).
- **Unread divider** ("New messages") and a **jump-to-latest** button (with a
  new-message count) when you've scrolled up.
- **Reply / quote**, **@mentions** (with autocomplete + highlight), **pin
  messages** (pinned banner + jump-to), **GIF messages** (GIPHY picker), and
  **voice-message transcription** — all schema-matched to mobile (`replyTo`,
  `mentions`, `chat.pinnedMessageIds`, `gif`, `transcription`).
- **Scheduled messages** — pick a future time; delivered by a client-side sweep
  (the sender's open tab) that mirrors the mobile `processScheduledMessages`
  Cloud Function, so it works without that function deployed.
- **Persisted drafts** — unsent text is saved per-chat in localStorage and
  restored on reload.
- **Image lightbox** — click any image (chat or moment) to view it full-screen.
- **Ephemeral / disappearing messages** — all schema-matched to mobile, so they
  interoperate:
  - **Burn after reading** (`burnAfterReading: {duration, burnStartedAt, burned}`)
    — send with a duration (5s / 10s / 30s / 1m / 5m); the recipient taps to
    reveal, which starts the countdown on both sides, then the content is wiped
    server-side and shown as "Message burned". Countdowns resume across reloads
    from `burnStartedAt`.
  - **View-once photos** (`viewOnce` / `viewOnceViewedBy` / `viewOnceExpired`) —
    the recipient sees a locked placeholder; opening it marks it viewed+expired.
  - **Disappearing-messages policy** (`chats/{id}.messageExpiry`, in hours: Off /
    1h / 24h / 7d / 30d) — a client-side sweep deletes messages older than the
    window on open and every 60s. (Firestore rules let any participant delete
    messages, so the policy is enforced for both users — the mobile app stores
    the same field.)
- **Shared whiteboard** — a real-time collaborative canvas per chat (from the
  chat menu), schema-matched to mobile (`chats/{id}/whiteboards/default` with a
  `strokes` array). Pick a color/width, draw with the mouse or touch, and strokes
  sync live for both people; Clear wipes it for everyone. Web↔web is pixel-
  consistent via a fixed logical coordinate space; mobile drawings still render
  (mobile stores raw device pixels, so their *position* may differ).
- **Chat settings** — pin, mute, custom rename (`nameBy`), and delete chat.
  Pinned chats float to the top of the list.

**Moments**
- **Feed** — your own moments plus friends' public/friends-visibility moments.
  Reads are scoped to a known author set (self + friends), matching the mobile
  `fetchMomentsForAuthors`, so it satisfies the Firestore rules (which gate
  moment reads on authorship / friendship / block state).
- **Compose** a text and/or **photo** moment with a visibility picker
  (public / friends / private). Images upload to Storage and render in the feed.
- **Disappearing moments** ("burn after time-up") — pick a lifetime when posting
  (Keep / 1h / 24h / 7d); it's stored as `expiresAt` (epoch ms). Expired moments
  are hidden from the feed for everyone and auto-deleted for the author (rules
  only let an author delete their own moment). Live moments show a countdown
  badge. (Mobile ignores the extra field, so it's forward-compatible.)
- **Like / unlike** and **comment** — same subcollections + count transactions
  as mobile.
- **Friends** — add by email, accept/decline incoming requests, a **Sent** tab
  for pending outgoing requests (with cancel), list & remove friends, block /
  unblock. (Friends power the Moments feed.)

**Voice & video calls** (browser WebRTC)
- Start a **voice or video call** from any chat's header. Uses the browser's
  built-in WebRTC (`getUserMedia` / `RTCPeerConnection`) — no native module.
- **Signaling matches the mobile app exactly** (`chats/{id}/calls/{callId}` with
  `offer`/`answer` + a `candidates` subcollection, same STUN servers), so calls
  interoperate **web↔web and web↔mobile**.
- **Incoming-call banner** (accept / decline) surfaces across all your chats,
  plus mute and camera toggle, and hang-up.
- **TURN support** — STUN works on friendly NATs; for strict/symmetric NATs set
  `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` and the TURN
  server is appended to the ICE list automatically (see `src/services/call.ts`).

**Profile & platform**
- **Presence** — a heartbeat writes `lastActiveAt`; the chat header shows the
  other person as **Online** (active in the last 60s) or their **last seen** time.
- **Light / dark theme** — the signature dark "Aurora Glass" look plus a light
  theme; defaults to your OS preference and is toggle-able in Profile (persisted).
- **Internationalization** — English and **Simplified Chinese**, switchable in
  Profile; defaults to the browser language.
- **Installable PWA** — a web manifest + service worker make the app installable
  on desktop/Android with an offline app-shell (static assets are cached
  stale-while-revalidate; the SDK still handles live data).
- **Web push notifications** — opt in from Profile (see setup below).
- **Deep-linking** — hash routing keeps the current tab and open chat in the URL
  (`#/chats/<id>`), so refresh, bookmarking, and the back button all work.

**Reliability & performance**
- **Offline persistence** — Firestore uses `persistentLocalCache` (IndexedDB):
  the app opens with cached data offline and **queues writes to sync on
  reconnect**. An offline banner shows when connectivity drops.
- **Resilience** — a toast layer surfaces send/upload failures instead of failing
  silently, and an error boundary catches render crashes.
- **Bounded deletes** — chat/message/candidate cleanup deletes in ≤400-doc
  chunks so it never trips Firestore's 500-write batch limit.
- **Image downscaling** — photos are resized to ~1600px and re-encoded in the
  browser before upload, saving bandwidth and Storage.
- **Offscreen render skipping** — long chat and moment lists use
  `content-visibility` so off-screen rows skip layout/paint.
- **Accessible modals** — dialogs use `role="dialog"`/`aria-modal`, trap focus,
  close on Escape, and restore focus on close.

**AI features** (Cloud Functions via `httpsCallable`)
- **Summarize chat** (from the chat menu) — calls the `summarizeChat` function.
- **Translate message** (🌐 on any message) — calls `translateMessage`,
  targeting your browser language.
- **Link previews** — messages containing a URL get a preview card via
  `fetchLinkPreview`.
- These require the corresponding functions to be **deployed** to your Firebase
  project; if they aren't, the UI degrades gracefully with a fallback message.

**Profile**
- View account, **edit display name**, change **profile visibility**, view
  **saved messages**, and **sign out**.

## What's intentionally NOT here (and why)

Some of the mobile app's features don't belong on — or can't run on — the web:

- **Biometric App Lock, Secure Vault, dead-man's switch, remote wipe** — these
  are device/OS-native (Keychain, biometrics, background tasks) and don't have a
  meaningful web analogue.
- **Push delivery on new messages** — the web client can *register* for push
  (Profile → Enable notifications; stores an FCM token on `users/{uid}.fcmTokens`
  and shows foreground/background notifications), but actually **sending** a push
  when a message arrives requires a server-side Cloud Function that watches new
  messages and calls FCM. That sender Function is backend work, not part of this
  client. Push also needs a VAPID key (see setup below).
- **The "fun extras"** (Chat Wrapped, Rituals, Playlist, Countdown, Quote Wall,
  Whiteboard, Memories, scheduled messages, live location, etc.) —
  Firestore-backed and portable, just not built here yet.

Everything that *is* here is a thin React component over a schema-matched
service function, so extending further follows the same pattern.

**Calls** turned out to be *more* feasible here than on any native desktop
build: browsers have WebRTC built in (`getUserMedia` / `RTCPeerConnection`), so
this client implements voice/video calling directly against the browser API
instead of `react-native-webrtc`, and it interoperates with the mobile app.

## Run it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Production build:

```bash
npm run build      # typechecks + bundles to web/dist (code-split chunks)
npm run preview    # serve the built output locally
```

`web/dist` is a static site — deploy it anywhere (Cloudflare Pages, Firebase
Hosting, Netlify, or wrap it in Electron/Tauri for a desktop app). The build is
**code-split**: the login path loads only the core + auth chunks; Firestore,
Storage, messaging, Moments and Profile load on demand, and Firebase is split
into cacheable vendor chunks.

**Two deploy-time steps:**

1. **Firestore indexes** — the composite indexes the queries need are declared in
   the repo root `firestore.indexes.json` (wired into `firebase.json`). Deploy
   them once with `firebase deploy --only firestore:indexes`. It shows a diff and
   prompts before removing anything — so if you've created other indexes manually
   (e.g. for the mobile app), run `firebase firestore:indexes > firestore.indexes.json`
   first to capture the live set, then merge.
2. **Security headers** — `public/_headers` ships safe security headers plus a
   **Report-Only** CSP for Cloudflare Pages (copied to `dist/` on build). Verify
   no CSP violations in the console, then flip it to enforcing. On Firebase
   Hosting, move these into `firebase.json → hosting.headers` instead.

> The PWA service worker only registers in production builds (not in `dev`, so
> HMR isn't cached). Test it via `npm run build && npm run preview`.

## Testing

```bash
npm test            # Vitest unit tests (service invariants, i18n, theme)
npm run test:e2e    # Playwright smoke test of the login/boot path
```

The unit tests cover the cross-client invariants that matter (e.g. `pairId` must
be order-independent so friend/request doc IDs match mobile; i18n has no orphan
keys). The Playwright smoke test boots the dev server and asserts the login
screen renders — run `npx playwright install chromium` once first.

## Firebase config

`src/firebase.ts` falls back to the mobile project's config so it works out of the
box for local testing. For a real deployment you should:

1. In the Firebase Console: **Project settings → Your apps → Add app → Web**, and
   copy the generated config.
2. Put those values in `web/.env.local` (see `.env.example`).

The mobile `appId` baked in as a fallback is an iOS app ID; Auth + Firestore work
regardless (they key off the API key / project ID), but registering a proper Web
app is the correct long-term setup and is required for web Analytics.

## Optional configuration (env)

All optional — see `.env.example` for the full list. Everything degrades
gracefully when unset.

| Variable | Enables |
| --- | --- |
| `VITE_RECAPTCHA_V3_SITE_KEY` | App Check (reCAPTCHA v3); loaded lazily only when set |
| `VITE_APPCHECK_DEBUG_TOKEN` | App Check debug token for local dev against an enforced project |
| `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | TURN server for reliable calls across strict NATs |
| `VITE_FIREBASE_VAPID_KEY` | Web push (Profile → Enable notifications) |

## Two things to check against your backend

- **App Check.** The mobile app initializes Firebase App Check. This client will
  initialize it too **when `VITE_RECAPTCHA_V3_SITE_KEY` is set** (register a web
  reCAPTCHA v3 provider in the console). If you have App Check **enforcement** on
  for Firestore/Auth and don't set the key, the web client is rejected; while
  enforcement is in "monitor" mode it works and just shows as unverified traffic.
- **Storage / media.** `storage.rules` require an `activeSessionId` on the user
  doc (the app's single-session security). The web client handles this with a
  **claim-if-null** handshake (`ensureActiveSession` in `src/services/storage.ts`):
  on load it only writes a web session id if the user doc has *no* active session,
  so it never kicks an active phone session offline. If you're currently signed in
  on mobile, uploads from web will be blocked by the rules until that phone session
  ends — this is the single-session security working as designed, not a bug.

## Web push setup (optional)

The Profile → **Enable notifications** button and background notifications need:

1. **A VAPID key** — Firebase Console → Project settings → Cloud Messaging → Web
   Push certificates → *Generate key pair*. Put it in `VITE_FIREBASE_VAPID_KEY`.
2. **Matching config in `public/firebase-messaging-sw.js`** — the service worker
   can't read env vars, so its `firebase.initializeApp({...})` block must be your
   project's public web config (it ships with this project's config).
3. **A sender Cloud Function** — enabling push stores the browser's FCM token on
   `users/{uid}.fcmTokens`. To actually receive a notification when a message
   arrives, a Firestore-triggered Function must read those tokens and call FCM.
   That server-side piece is out of scope for this client.
