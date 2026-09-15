# Forward secrecy — crypto core

Pure, tested, and **not yet wired into the app**. Nothing in `src/` imports
this outside its own tests, so merging it changes no runtime behaviour.

## Why it is landed unwired

The gap it closes is the one the rest of the security work could not touch.
`e2ee.ts` derives a message key by static X25519 between two long-lived
identity keys, so every message in a conversation is encrypted under the same
key forever: **compromising a device key decrypts the entire history**,
including ciphertext already on the server. Hardening key *storage* (the
Keychain migration) raises the cost of stealing that key. This changes what
stealing it is worth.

Getting it wrong is worse than not having it — corrupt ratchet state means
users permanently and silently lose the ability to decrypt. So the layer that
must be correct is landed first, provable on its own, before anything depends
on it.

## What is here

| File | Role |
|---|---|
| `x3dh.ts` | Initial key agreement. Ed25519 identity, signed prekey, one-time prekeys. Produces the shared secret the ratchet starts from. |
| `doubleRatchet.ts` | 1:1 messaging. Symmetric chain (forward secrecy) + DH ratchet (post-compromise security). |
| `senderKeys.ts` | Groups. One hash chain per sender, distributed over the pairwise ratchet. |

Design notes live in each file's header comment rather than here.

## Properties, stated honestly

| | 1:1 | Group |
|---|---|---|
| Forward secrecy | Yes | Yes, along the chain |
| Post-compromise security | Yes, after one round trip | **No** — only rotation repairs a compromise |
| Authorship | Implicit (pairwise) | Per-sender Ed25519 signature |
| Replay of a handshake-carrying message | Blocked by one-time prekey, and by the session's base key when there is none | n/a |

The group gap is real and must not be glossed in any user-facing claim: an
attacker holding a sender's chain key can derive every *future* key in that
chain, because advancing it needs nothing they lack. The pairwise ratchet
heals itself; a sender key does not heal at all. Rotation on member removal is
therefore not an access-control nicety — it is the only recovery mechanism the
construction has, which is why `rotationRequired()` returns true for removals
unconditionally.

## Testing

58 tests. Every security property is also **mutation-tested**: the
implementation is deliberately broken and the suite must fail. Eight
mutations, all caught —

- pairwise chain KDF constants collide
- sender-key chain KDF constants collide
- DH ratchet reuses its keypair instead of generating a fresh one
- header excluded from the AEAD associated data
- sender-key signature not enforced
- X3DH accepts a forged prekey signature
- X3DH silently skips a consumed one-time prekey
- `ratchetDecrypt` mutates the caller's session

The first of those originally passed all 54 tests. Making the message key and
the next chain key identical breaks forward secrecy completely, yet nothing
observable at the message level changes — both sides still agree, every key
still looks distinct. That is what the `kdfChain` / `advance` domain-separation
tests exist for, and why those two functions are exported.

## Wiring it up (phase 2)

Not started. In dependency order:

1. **Publish prekeys.** Ed25519 identity + signed prekey + a one-time batch on
   the user's profile. Needs a Firestore rule allowing a peer to *consume* one
   one-time prekey and no more, and a top-up when the batch runs low.
2. **Session store.** `serializeSession` output per (chat, peer). Must be as
   durable as the identity key and is now equally unrecoverable if lost —
   whatever holds it needs the same care the Keychain work gave the identity.
3. **Send/receive path.** Route new messages through the ratchet; keep the
   existing static-DH path for reading history.
4. **Groups.** Distribute sender keys over the pairwise sessions from (3);
   rotate on removal.
5. **Verification.** The safety number must cover the Ed25519 identity, or
   verification stops meaning anything once identities change.

### Migration

No history is lost and no flag day. The existing X25519 identity keys stay
published and keep decrypting old messages; the ratchet handles new ones.
Forward secrecy applies from the moment a session is established, not
retroactively — old ciphertext is already on the server, so nothing could make
it retroactively secret.

Two things to get right when wiring:

- **The transition must not be silently skippable.** If session setup fails
  and the code falls back to static DH without saying so, the property is gone
  and nobody notices. Same failure mode as the fail-open plaintext downgrade
  fixed earlier.
- **A second device still breaks decryption** (single-device assumption,
  `e2ee.ts` caveat 3). The ratchet does not fix that and makes it slightly
  worse, since session state is per-device. Worth solving before, or
  alongside, multi-device.
