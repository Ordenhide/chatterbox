---
name: chatterbox-design
description: Chatterbox's visual system and the decisions behind it — palette, typography, bubbles, avatars, layout direction. Use when touching any UI in this repo (src/screens, src/components, web/src), adding a screen or control, or choosing a colour, face or spacing.
---

# Chatterbox's visual system

This app has a design system already, and most of it is written down where it
is used. This file is the part that keeps getting re-derived — or re-broken —
by someone arriving fresh. Every rule here has a reason attached, because a
rule without one gets overridden by whoever thinks it looks wrong.

**Before inventing anything, read the file you are editing.** The palette,
typography and avatar modules carry long comments explaining what was tried
and rejected. Those comments are the specification.

## The premise

A terminal, not a consumer chat app: a black ground, one signal green,
hairline rules, tight geometry. Radii are 6/10/14/pill (`radius` in
`theme/colors.ts`) — nothing rounder. The accent means *status*, not
decoration, and it is spent sparingly.

Do **not** reach for the generic AI-design look here — warm cream grounds,
serif display faces, terracotta accents, gradient heroes, emoji section
markers. This app has committed to something specific.

## Colour

`src/theme/colors.ts` is the only source. `getColors(scheme)` returns the
light or dark set; there is nothing else.

Contrast is **computed and recorded**, never eyeballed, and the comments carry
the numbers. The trap that forced this: `#00ff41` is 15.38:1 on black and
**1.37:1 on white**, so the brightest thing in the dark theme is invisible in
the light one. The two themes therefore do not share an accent — light uses
`#0A7A2A`. If you introduce a colour, compute both directions before shipping
it.

Ink on a fill comes from a token, never a literal: `textOnPrimary`,
`textOnDanger`, `textOnWarning`. These invert with the mode because the fills
do — the dark theme's red and amber are *bright*, so black is the legible ink
on them. Hardcoding white was a real bug, twice.

### There is no accent theming

Removed on 2026-09-04. Appearance is dark and light, decided by the system
scheme, and nothing else. There is no theme catalog, no store theme, no
per-chat colour picker, and `themeBy` is gone from both `ChatRoom` types.

If a feature seems to want a per-conversation colour, it does not. Three
disagreeing palettes shipped side by side before this was cleaned up.

## Typography

Three faces, each with a job (`src/theme/typography.ts`):

- **Chakra Petch** — display. Headings and the wordmark, used sparingly.
- **IBM Plex Sans** — body. Messages, labels, buttons.
- **IBM Plex Mono** — data. Timestamps, key counts, fingerprints, ciphertext.

**Name the face, never the family plus a weight.** `fontFamily: 'IBM Plex Sans'`
with `fontWeight: '600'` breaks in two directions at once: Android ignores
weight for custom families and renders Regular, and Google registers Medium
and SemiBold as their own families, so even iOS would not find them. Use
`fonts.body.semibold`, or `bodyWeight('600')` when migrating a style that had
a weight.

**Corollary: never pair these with `fontWeight`.** The weight is in the file
already, and asking twice invites Android to synthesise a faux-bold over a
face that is already bold.

`terminal.micro` / `terminal.label` / `terminal.data` are the metadata roles —
small, wide-tracked, uppercase mono. Sizes are genuinely tiny (8–11px) because
*tracking* does the work; below ~1.5 letter-spacing they collapse back into
ordinary small text. **Body copy is never uppercased** — a message is read,
not scanned.

### Known: `fontFamily` does nothing on Android `TextInput`

Measured on RN 0.84.1 with the new architecture. Four ways of asking all
render identically while `fontSize` from the same style object works. It is
React Native's bug, cannot be patched from the app (`react-android` ships
prebuilt), and the line stays in `ChatComposer` because it is correct and iOS
uses it. See the comment there. **Do not re-investigate**; if you must, re-run
the `fontSize` check first.

## Message bubbles

Outgoing is a **solid block of `colors.text`** with `colors.textOnPrimary` as
ink. That reads as "sent" more strongly than a tint and keeps the accent free
to mean status rather than authorship. Incoming is **transparent with a
hairline border**, so it sits on the ground rather than floating above it.

**Nothing inside a bubble paints its own background.** The bubble is the
surface. A voice message once filled itself with `colors.surface`, which put a
light pill inside the dark block and left the timestamp on the sliver showing
underneath — it read as two stacked elements, and it was the only bubble in
the thread that did. Content inside takes its ink from which side it is on:
the accent on the ground, the inverted ink on the fill.

## Avatars

**Monochrome, four steps of one neutral** (`src/utils/avatar.ts`). An earlier
palette hashed the name into six saturated hues, which looked like it encoded
something, carried nothing, and competed with the single signal colour.

This has been re-litigated twice. The chat list fixed it, `web/src/theme.ts`
arrived at the same four-step answer independently, and the chat *thread* kept
the rejected version for months because that avatar came from
`react-native-gifted-chat` rather than from this codebase. **If a third-party
component draws something, it did not go through these decisions.**

Own avatars are not drawn on your own messages — you know who you are.

## Layout direction

Arabic ships, so **styles are direction-agnostic**: `marginStart`/`marginEnd`,
`paddingStart`/`paddingEnd`, `start`/`end`. A test scans `src/` and fails on a
reintroduced `marginLeft`/`Right` or `paddingLeft`/`Right`, because nothing
enforces this at the type level and the difference only shows on a device set
to Arabic.

`left`/`right` are deliberately *not* banned, because several are correct:

- **gifted-chat's `wrapperStyle={{left, right}}` means incoming/outgoing**, not
  sides. Converting these breaks bubble styling outright.
- `left: 0, right: 0` pairs stretch to full width and are already agnostic.
- `left: pt.x` from a `measure()` result is an absolute screen coordinate.
- `CornerBrackets` draws all four corners; the set is symmetric.
- `SwipeToReply`'s affordance is pinned to the physical side the swipe comes
  from, not to reading order.

`Icon` mirrors only the glyphs in its `DIRECTIONAL` set. A blanket transform
makes near-symmetric glyphs subtly wrong.

## Security-facing UI

**A claim about security must be derived from the mechanism, not from a stored
flag beside it.** The composer's banner read "Screenshot protection active"
from a preference while the code that sets `FLAG_SECURE` had no callers at
all. Whether the user asked for protection and whether the window has it are
different questions, and the UI answers the second.

**Do not add a control for a setting nothing reads.** `privacyGuard` still
holds watermark, auto-lock and screenshot-alert flags with no readers; a
switch for one of those would move, persist, and change nothing. A test
enforces this for the privacy toggles — every switch must have its reader
*called* somewhere (an import alone does not count).

**The exception gets words; the normal state stays quiet.** A padlock for
"encrypted" is a convention people already read. "Not encrypted" gets a full
bar above the composer, because an 11px triangle was legible only to someone
who already knew the convention — the author of this app looked at it and
asked what it was.

## Two clients, one system

`web/` is a separate reimplementation, not shared code. Its tokens live in
`web/src/styles.css` as `--cb-*` and mirror the mobile palette by hand.
**A visual fix on one side usually needs a twin on the other**, and when they
disagree, find out which one is right before copying either — the web sent
bubble was the wrong colour for months because a fallback that its own comment
described as the intended look was dead code.

## Copy

Say what happens, in the user's words. Errors explain what went wrong and what
to do. Where a state has a real consequence, name the consequence: "the server
can read what you send" rather than "unencrypted". No apologies, no vagueness,
no exclamation marks.
