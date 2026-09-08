---
name: chatterbox-product
description: Who Chatterbox is for, what the account model is, what was deliberately removed and why, and what not to add. Use before building any new feature, proposing one, or deciding whether existing code should stay.
---

# What this app is for

**People who care a great deal about privacy.** Not "people who want a chat
app" — that market is Signal and WhatsApp, and their moat is the network, not
the feature list. Every decision below follows from that one sentence.

That audience does not evaluate a messenger by its feature table. They ask
three things, in this order:

1. **What can the server see?**
2. **Can I verify what you claim?**
3. **What happens when the encryption fails or degrades?**

Number three is where this app is already unusual. Number one is where it is
weakest.

## The stance that makes this app different

Most messengers hide degradation: the padlock is always green, because green
looks good. This one says when it is not protecting you.

- the composer says, per message, whether it will go out readable by the server
- the chat list header reports whether the key is on this device, replaced, or
  unverified
- `enrollmentReadiness` returns `unknown` rather than guessing
- security claims in the UI derive from the mechanism, never from a flag beside
  it

**When adding anything, ask whether it strengthens or dilutes that.** A feature
that is merely pleasant dilutes it, because it costs tests, build time and the
attention of everyone reading the code afterwards.

## The account is a recovery phrase

Since 2026-09-07 there is no email address, no phone number, no Google and no
Apple sign-in. Sign-up mints 32 random bytes; the 24 words are shown once, and
everything else derives from them (`services/anonymousIdentity.ts`):

```
seed  ──HKDF(".../anon-account-id/v1")─────>  a 128-bit login handle
      ──HKDF(".../anon-account-secret/v1")─>  a 256-bit login secret
      ──used verbatim───────────────────────>  the X25519 device key
```

The third line is why this was small rather than a rewrite: the phrase has
always *been* the E2EE key, so signing in and restoring keys are one action.
There is no separate "restore your keys" step to forget, and no window in
which someone is signed in and silently cannot decrypt.

**The known-answer vector in `anonymousIdentity.test.ts` is the account, not a
regression test.** Changing the salt, either info label, or an output length
does not migrate anyone — it points every phrase ever written down at an
account that does not exist, and tells the user their words are wrong.

Consequences that shape everything else:

- **Email/Password stays enabled in the Firebase console.** It is the transport
  for the derived credential, not a product decision. The handle is random hex
  under a `.invalid` domain, which RFC 2606 reserves so no mailbox can exist.
- **There is no recovery.** A lost phrase is a lost account. Nothing may create
  an account before the user has been shown the phrase and confirmed they kept
  it.
- **The phrase now opens the account, not just the history.** Every string that
  describes it has to say so.
- **Never write the login handle anywhere.** It is half the credential and the
  half stored in plaintext. This has been got wrong four times — on messages,
  on the profile document via a Cloud Function, in the feedback collection, and
  on the profile screen where users were shown a fake email address. Anything
  reaching for `user.email` is almost certainly a bug.

## Forward secrecy is on, and was not for a long time

The ratchet — X3DH, double ratchet, group sender keys, prekey rotation — was
complete and tested for months and **never ran**, because nothing called the
publish step. Every message silently took the static long-lived key while the
privacy policy said most conversations were forward-secret.

`ensureRatchetKeysPublished` now runs from the auth-state callback, and
`src/services/__tests__/ratchetPublishBoundary.test.ts` asserts it stays wired.
Groups arrive per conversation as members update, because `sealGroupText` is
all-or-nothing by design.

Two things follow. The ratchet identity is a **separate per-device Ed25519
key that the phrase does not carry**, so it is what makes this one-device-at-
a-time; and `computeSafetyNumber` folds it in whenever both sides have one, so
out-of-band verification covers the path users are told to trust most.

## What was removed, and why it is not coming back

Two waves. The chat pet, whiteboard, shared playlist, countdowns and Moments
went on 2026-09-05 — about 6,600 lines. The second wave took telemetry, the
paid tier and Stripe, the quote wall, shared lists, decoy mode, chat-lock, the
dead man's switch with remote wipe and trusted contacts, stealth mode,
password changing, and every sign-in method except the phrase: another 7,700
lines removed against 3,200 added across `src`, `web/src`, the functions and
the rules.

Screens are 19 and services 70. The AI features (summarise, translate,
transcribe, dictation) are hidden behind `SHOW_AI_FEATURES = false` in
`src/config/launch.ts` rather than deleted, gated on both clients and behind a
second fail-closed consent guard.

**Do not re-add this class of thing.** If a proposal sounds like it belongs in
Discord, WeChat or Snapchat, it belongs there.

### Half-shipped is the worst state

The audit that produced most of these removals kept finding the same shape: a
feature deleted from the UI whose *server side* stayed live.

- Moments had no screen on either client and still allowed any signed-in user
  to create documents and upload 25 MB objects, into a surface nothing renders
  and no sweep visits.
- The dead man's switch had eleven unreachable exports and a Cloud Function
  querying for a field no client could set, every twenty-four hours, billed.
- Stealth mode's setter had no callers, so its two gates were permanently false
  while reading like privacy controls.

`firestore.rules` says it at the top and it is the rule to work by: **a rule
for a collection no client touches is not inert — it is writable server
storage the app does not know about. Delete the rule in the same commit as the
feature.** The same goes for scheduled functions, exported helpers and
preference keys.

## The gap that matters, measured

Message contents are encrypted, and so are link previews, live location, voice
transcripts and attachment *bytes* (`services/mediaCrypto.ts`). The chat list
preview stores `🔒 Encrypted message` rather than the text. That part is solid.

What the server holds in plaintext:

- **who talks to whom** — `chats/{id}.participants`
- **when** — `createdAt`, `updatedAt`, per message and per chat
- **the friend graph** — `friends`, `friendRequests`
- **an attachment's name, type and size**, though not its bytes
- **call signalling** — that a call happened, to whom, when
- **unread counts**; typing and read receipts are opt-in and off by default, so
  an untouched account writes neither
- every connection's IP, to Google, since this runs on Firebase

For this audience that is the decisive gap, and it is not a feature gap.
Metadata is often worth more than contents. Signal answers it with sealed
sender and private contact discovery; SimpleX answers it by having no user
identifiers at all.

### What was closed

The user directory. `users/{uid}` used to carry an email, a display name and a
photo, and any signed-in client could *query* the collection on the email —
turning a person into the list of conversations they were in. All of it is
gone:

- `allow list` on `users` is `false`; only `get` by uid remains, so no query
  returns anyone. `getUsersByIds` reads one document at a time because
  `where('__name__', 'in', ...)` is a list.
- `email`, `photoURL` and `displayName` are refused by the rules and
  `deleteField()`d on every sign-in. There is no address anywhere to refuse
  any more.
- A name reaches the other side sealed to their key and stored on the chat —
  `services/introductions.ts`.
- Reaching someone new is an invite link (`services/invites.ts`): a 32-byte
  token, single use, 24 hours, `get` allowed and `list` denied. Reaching
  someone you already know is `services/contacts.ts`, a projection of your own
  chats rather than a query.

**The rules do not police the Admin SDK.** A Cloud Function wrote a device
name — often the owner's first name — onto that same document for months, past
every rule written to keep identifiers off it. When adding anything to a
function that touches `users/{uid}`, the rules are not the check.

**Metadata minimisation is still the direction.** What is left is harder:
`participants` and the friend graph both name pairs of users in the clear, and
making either unreadable means restructuring the data model or leaving
Firebase. Nothing here should be built in a way that makes that harder.

## Practical consequences

**A new feature has to survive this question:** would someone who chose this
app for its privacy be worse off without it? If the answer is "no, but it is
nice", it is a no.

**Prefer subtraction.** The app is closer to shippable for being smaller, and
every removal makes the next decision easier.

**Never widen what the server can read** to make a feature simpler. That trade
is the one thing this app cannot afford, and the one most likely to be made by
accident.

**A claim in the privacy policy or on the website is a specification.** Both
are generated from `src/i18n/privacyPolicy.ts` and `scripts/site-copy/` into
fifteen languages, with `--check` modes that fail if the pages are stale. When
a change makes one of their sentences false, the sentence is part of the
change — the ratchet went unshipped for months while both documents claimed it.
