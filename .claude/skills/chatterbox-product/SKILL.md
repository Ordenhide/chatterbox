---
name: chatterbox-product
description: Who Chatterbox is for, what was deliberately removed and why, and what not to add. Use before building any new feature, proposing one, or deciding whether existing code should stay.
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
- shared lists and link previews are end-to-end encrypted, which most
  messengers do not bother with for attached content

**When adding anything, ask whether it strengthens or dilutes that.** A feature
that is merely pleasant dilutes it, because it costs tests, build time and the
attention of everyone reading the code afterwards.

## What was removed, and why it is not coming back

On 2026-09-05, roughly 6,600 lines went, in five commits: the chat pet, the
whiteboard, the shared playlist, the countdowns, and Moments.

Moments was the big one, and it was never a feature — it was a second product
(a feed with its own permission model, comments, likes and visibility rules)
bolted to a messenger. Screens went from 20 to 12, services from 85 to 78.

Fourteen more features are hidden behind `SHOW_NATIVE_ONLY_FEATURES = false`
(invisible ink, message styles, anonymous mode, gesture messages, voice
filters, soundscapes, and others). They are hidden rather than deleted. If a
year passes without a reason to turn them on, delete them.

**Do not re-add this class of thing.** If a proposal sounds like it belongs in
Discord, WeChat or Snapchat, it belongs there.

## The gap that matters, measured

Message *contents* are encrypted, and so are shared lists and link previews.
The chat list preview stores `🔒 Encrypted message` rather than the text. That
part is solid.

What the server holds in plaintext:

- **who talks to whom** — `chats/{id}.participants`
- **when** — `createdAt`, `updatedAt`, per message and per chat
- **who is typing, who has read, unread counts**
- **email, display name, photo** — `users/{uid}`, written by `upsertUserProfile`
- **the friend graph** — `friends`, `friendRequests`
- every connection's IP, to Google, since this runs on Firebase

For this audience that is the decisive gap, and it is not a feature gap.
Metadata is often worth more than contents: who contacted whom, how often, at
what hour. Signal answers it with sealed sender and private contact discovery;
SimpleX answers it by having no user identifiers at all.

**Metadata minimisation is the next direction**, and the honest note is that it
is not a small change — dropping email/phone at sign-up, or making the
participant list unreadable, means restructuring the data model or leaving
Firebase. Nothing here should be built in a way that makes that harder.
`services/friends.ts` carries the same warning at the top for the same reason.

## Practical consequences

**A new feature has to survive this question:** would someone who chose this
app for its privacy be worse off without it? If the answer is "no, but it is
nice", it is a no.

**Prefer subtraction.** The app is closer to shippable for being smaller, and
every removal makes the next decision easier.

**Never widen what the server can read** to make a feature simpler. That trade
is the one thing this app cannot afford, and the one most likely to be made by
accident.
