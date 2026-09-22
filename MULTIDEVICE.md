# Why the web client cannot read forward-secret messages

Written for someone who knows this codebase and has just discovered that the
web client shows a padlock where a message should be. This records a decision
already taken: the web client is a companion to the phone, not a second full
client. Multi-device was considered and deliberately not built.

It is here because the answer is not discoverable from the code. It is spread
across a comment in `ensureRatchetKeysPublished`, the statefulness of the
double ratchet, and a schema that has no device dimension in it — and anyone
meeting the padlock for the first time will otherwise re-derive all three.

## The symptom

`web/src/services/e2ee.ts` recognises a forward-secret envelope
(`isRatchetSealed`) and cannot open one. Its own comment is blunt about it:
"nothing here will open it". `ChatPane.tsx` substitutes

> 🔒 Forward-secret message. This browser cannot read it — open the chat on
> your phone.

Since forward secrecy was switched on, that is the common case rather than an
edge one: mobile uses the ratchet for every 1:1 chat and sender keys for every
group where all members have published. So the practical shape is

| direction | result |
| --- | --- |
| phone → browser | unreadable |
| browser → phone | fine — the browser sends static-DH fan-out, which mobile opens |

## Why porting the ratchet does not fix it

The cryptography is not the obstacle. `ratchet/doubleRatchet.ts`,
`ratchet/x3dh.ts` and `ratchet/senderKeys.ts` are ~1150 lines depending only
on `@noble/*` and four helpers from `crypto.ts`, all of which the web client
already has. They would port essentially unchanged.

What stops it is the account model, in two independent ways. Either alone is
fatal.

**1. Two devices would fight over one published identity.** The ratchet
identity lives at `users/{uid}/publicKeys/ratchet` — one document per
*account*, with no device dimension anywhere in the schema. Both clients call
`ensureRatchetKeysPublished` on every sign-in, and it deliberately takes the
identity over when the published bundle belongs to someone else: "taking the
identity back is the only way it becomes reachable again". Phone and browser
would alternate ownership, and every switch would surface a "session changed"
warning to every peer — the warning that is supposed to mean something.

**2. Sharing one identity does not help either.** A double ratchet is
*stateful*: every message advances a chain and destroys the message key behind
it. Two devices advancing the same chain independently desync permanently, by
design. Session state is local for exactly this reason — `ratchetSessionStore`
keeps it in MMKV under an OS-key-store key and never uploads it. The static-DH
path tolerates two devices precisely because it is stateless; the ratchet
cannot be made to.

Note that the recovery phrase does not paper over this. It is the X25519
static secret in BIP39 (`e2eeMnemonic.ts`); the ratchet identity is generated
locally by `getOrCreateRatchetIdentity` and is not derived from it. Restoring
on a second device recovers readable history and mints a *new* ratchet
identity, which then takes the published bundle over.

## What real multi-device would have cost

For the record, since "just add devices" sounds cheaper than it is. It needs a
device registry (`users/{uid}/devices/{deviceId}`) with per-device identities
and prekeys; sessions keyed by `(peerUid, peerDeviceId)`; and a sender that
fans out to every device of every recipient **including their own other
devices**, or the phone cannot read what the browser sent. That last part
makes every send a fan-out even in a 1:1 chat, and message size then grows
with total device count — attachment content keys travel inside the body.

It also forces product decisions that are harder to reverse than any of the
code: what the recovery phrase means (today "new device" means *migration* —
the old device is displaced; multi-device introduces *linking*, where both stay
live), how many devices an account may have and who can remove one, and whether
the safety number is one number over a sorted set of device identities or
several numbers to compare. The blast radius is 44 key-lookup/seal sites in
`src/`, 27 in `web/src/`, plus `firestore.rules`, the safety-number UI, the
restore screen and the privacy policy.

That is a protocol rewrite across both clients. The feature that motivated it —
the browser reading messages — would have been the smallest part of it.

## What the web client is instead

A companion. It signs in to the same account and does the things that do not
need the ratchet: sending (static-DH fan-out, which the phone reads),
reading anything sent before forward secrecy was switched on, reading its own
sent messages, and the whole non-message surface — contacts, invitations,
saved items, settings, data export. It also has screen sharing, which mobile
does not.

Two things follow that are easy to get wrong:

- **Every surface that shows message text has to say so.** A browser that
  cannot read something must never render that as nothing. See "Known gaps".
- **The two clients are not equivalent and the product should not imply they
  are.** Anything describing the web client — the privacy policy, the site
  copy, the download page — should not promise message history it cannot
  deliver.

## Every surface that shows message text

A forward-secret message has its `text` blanked at send time
(`e2eeMessages.ts` says so, and adds that "a placeholder belongs in the UI
layer"). This table used to be a list of places the UI layer did not supply
one. It is now a list of what each surface says, because they were fixed —
the `sealed` flag on `lastMessage` (`firebaseChat.ts`) is what made it
possible for a reader to label a message it cannot open without reading the
sender's words for it.

| surface | shows | |
| --- | --- | --- |
| open chat (`ChatPane.tsx:654`) | `chat.forwardSecretElsewhere` | ok |
| chat list (`HomeScreen.tsx:222`) | `lastMessage.sealed` → padlock label | ok |
| quick switcher (`QuickSwitcher.tsx:151`) | same | ok |
| notifications (`useChatNotifications.ts:83`) | `chat.encryptedPreview` | ok |
| data export (`dataExport.ts`) | `DecryptionStatus: 'failed'` | ok |
| in-chat search | skips what it cannot read, and says how many | ok |
| mobile chat list (`ChatListScreen.tsx:133`) | `sealed` ahead of `text` | ok |

Three of these were recorded here as **false** — the chat list and quick
switcher describing an active conversation as "No messages yet — say hello.",
and mobile's list rendering a sealed preview as an empty string. All three are
fixed. The entry for search was wrong in a different way: it claimed search
"matches nothing, silently", and in fact both clients patch decrypted text
back into their message state, so search reads plaintext for everything the
client can open. What was true is the narrower thing now in the table — a
browser's search cannot see the forward-secret messages, and used to return a
short answer without saying so.

Keep this table honest. A row that has quietly become false is worse than no
row: it is read as a live defect and worked around.

## Why the two cannot even be signed in at once

Separate from the ratchet, and worth knowing before anyone tries: the account
allows **one** session, full stop. `users/{uid}.activeSessionId` names it and
every client signs itself out when it changes, so signing into the browser
displaces the phone and vice versa. The two do not coexist; they take turns.

Allowing "one mobile plus one web" sounds like a client change — split the
field into per-platform slots, have each client watch its own. It is not. The
enforcement that matters is in `firestore.rules`:

```
hasCurrentSession: request.auth.token.auth_time >= sessionClaimedAt - 120s
```

One timestamp for the whole account, consulted by `isSignedIn()` and therefore
by almost every read and write. A web sign-in bumps it, so the phone's token —
which authenticated earlier — loses server-side access no matter what the
clients do about `activeSessionId`. And the rule cannot be made
platform-aware: a token carries no platform, and custom claims are
account-wide and leak to other devices on their next silent refresh, which is
the reason the rule uses `auth_time` in the first place (its own comment sets
this out).

Splitting the timestamp per platform and taking the *earlier* of the two is
the only shape that fits the rule, and it costs something real: a displaced
mobile device would keep server-side access indefinitely whenever the web
claim predates its own sign-in, where today the exposure is bounded by a
token's ~1hr life. That trade was considered and declined — the backstop
exists for the case where a client's listener never fires, which is exactly
the case a bound matters for.

So concurrent sign-in is not a missing feature with an obvious fix. It is a
consequence of the same single-device assumption as everything above.

## If this is ever revisited

Nothing above expires. The two blockers are properties of the design rather
than bugs, and the staging that would make sense is the same: device registry
and read path first, fan-out second (a no-op while every account has one
device, so it can be tested before any client offers linking), device list and
safety number third, linking ceremony fourth, and the web ratchet last — by
which point the browser is just another device.
