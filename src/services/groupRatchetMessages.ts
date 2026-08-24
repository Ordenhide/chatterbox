/**
 * Forward secrecy for group messages — phase 2d.
 *
 * Groups cannot use the Double Ratchet: it is a two-party protocol, and there
 * is no coherent "the other party's current ratchet key" among 32 people. So
 * each *sender* keeps one hash chain for the chat (services/ratchet/senderKeys.ts),
 * encrypts each message once under a key derived from it, and advances the
 * chain. This module is the plumbing: how a chain key reaches the other
 * members, and when it has to be replaced.
 *
 * ## Distribution rides the pairwise ratchet
 *
 * A chain key is worth exactly as much as the messages it opens, so it can
 * never be published in the clear. Each member is sent their copy sealed with
 * the 1:1 ratchet session for that pair — which is why this file sits on top
 * of ratchetMessages.ts and why a group only gets forward secrecy when *every*
 * member has a ratchet identity.
 *
 * All-or-nothing, matching the existing fan-out rule: one member without a
 * ratchet identity means the whole chat stays on the static path, because a
 * message some members cannot read is worse than one everybody can.
 *
 * ## Rotation is the only healing this construction has
 *
 * Sender keys give forward secrecy along the chain but no post-compromise
 * security: whoever holds a chain key can advance it themselves and read
 * everything that follows. The pairwise ratchet heals after a round trip; this
 * does not heal at all.
 *
 * So removal MUST rotate, immediately — a departing member holds the current
 * chain key and would otherwise keep reading. Addition does not: a new member
 * is handed the chain at its current index, and the KDF being one-way makes
 * everything earlier unreadable to them by construction rather than by anyone
 * remembering to withhold it.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from './firebase/firestore';
import {
  acceptDistribution,
  createSenderKey,
  distributionFor,
  isSenderKeyMessage,
  rotateSenderKey,
  rotationRequired,
  senderKeyDecrypt,
  senderKeyEncrypt,
  type SenderKeyDistribution,
  type SenderKeyMessage,
} from './ratchet/senderKeys';
import {
  isRatchetEnvelope,
  openEnvelope as openRatchetEnvelope,
  sealText as sealPairwiseText,
  type RatchetEnvelope,
} from './ratchetMessages';
import {
  clearGroupState,
  loadReceiverKey,
  withOwnSenderKey,
  withReceiverKey,
} from './ratchetSessionStore';
import {utf8ToBytes} from './crypto';
import {reportError} from './telemetry';

const db = getFirestore();

export const GROUP_ENVELOPE_ALG = 'chatterbox-group-envelope-v1';

export type GroupEnvelope = {
  alg: typeof GROUP_ENVELOPE_ALG;
  /** Sender uid — selects whose chain opens this. */
  from: string;
  message: SenderKeyMessage;
};

export function isGroupEnvelope(value: unknown): value is GroupEnvelope {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<GroupEnvelope>;
  return e.alg === GROUP_ENVELOPE_ALG && typeof e.from === 'string' && isSenderKeyMessage(e.message);
}

/**
 * Associated data for a group ciphertext.
 *
 * The chat id here is defence in depth and, on its own, redundant: a chain is
 * already bound to its chat twice over, by the storage namespace a receiver
 * looks the distribution up in and by the pairwise channel that distribution
 * is sealed under (see distributionChannel). Mutation testing makes that
 * concrete — removing the chat id from this string breaks no test, because
 * both stronger bindings stop the attack first. It is kept because it costs
 * nothing and does not depend on either of them holding, but it should not be
 * described as the thing preventing cross-chat replay.
 *
 * The member list is deliberately NOT included. It changes, and a receiver
 * reconstructing it as it was when the message was sent is not something they
 * can reliably do — a mismatch would make old messages permanently
 * undecryptable every time somebody joined.
 */
function groupAd(chatId: string, senderUid: string): Uint8Array {
  return utf8ToBytes(`${GROUP_ENVELOPE_ALG}|${chatId}|${senderUid}`);
}

// ---- distribution ----------------------------------------------------------

function distributionId(fromUid: string, toUid: string): string {
  return `${fromUid}__${toUid}`;
}

/**
 * The pairwise session namespace a distribution is sealed under.
 *
 * Deliberately scoped to the *chain*, not just the chat, so each chain gets a
 * fresh session and every distribution therefore carries its own X3DH half.
 *
 * Reusing one session per chat looked equivalent and was not. The distribution
 * document is overwritten on rotation, so it holds only the newest chain — and
 * once a session exists on the sender's side, later messages on it no longer
 * carry the handshake. A member who was offline when the first distribution
 * was written would then find the only copy of that handshake gone, and could
 * never establish the session or read anything that sender wrote again.
 * Silent, permanent, and invisible to the sender.
 *
 * Making each distribution self-contained costs one prekey claim per member
 * per chain. Chains only rotate when someone is removed, so that is bounded
 * and cheap next to the failure it removes.
 */
function distributionChannel(chatId: string, chainId: string): string {
  return `${chatId}#senderkey#${chainId}`;
}

function distributionsRef(chatId: string) {
  return collection(doc(collection(db, 'chats'), chatId), 'senderKeys');
}

/**
 * Seals this sender's chain key for one member and stores it.
 *
 * Returns false when no pairwise ratchet session can be established with that
 * member — they run an older client — which is what makes the caller abandon
 * the group path entirely rather than leave one member unable to read.
 */
async function distributeTo(
  myUid: string,
  chatId: string,
  memberUid: string,
  distribution: SenderKeyDistribution,
): Promise<boolean> {
  const channel = distributionChannel(chatId, distribution.chainId);
  const sealed = await sealPairwiseText(myUid, channel, memberUid, JSON.stringify(distribution));
  if (sealed.protection !== 'ratchet') return false;

  await setDoc(doc(distributionsRef(chatId), distributionId(myUid, memberUid)), {
    from: myUid,
    to: memberUid,
    chainId: distribution.chainId,
    envelope: sealed.envelope,
    updatedAt: serverTimestamp(),
  });
  return true;
}

/**
 * Ensures every member holds this device's current chain key.
 *
 * Distribution is written per member and keyed by (from, to), so re-running
 * this is cheap and idempotent: a member already holding the current chainId
 * is skipped. Members are checked against what is *published*, not against
 * local memory, so a distribution lost to a failed write is repaired on the
 * next send rather than leaving that member permanently unable to read.
 */
async function ensureDistributed(
  myUid: string,
  chatId: string,
  memberUids: string[],
  distribution: SenderKeyDistribution,
): Promise<boolean> {
  for (const memberUid of memberUids) {
    if (memberUid === myUid) continue;
    const existing = await getDoc(doc(distributionsRef(chatId), distributionId(myUid, memberUid)));
    if (existing.exists() && existing.data()?.chainId === distribution.chainId) continue;
    if (!(await distributeTo(myUid, chatId, memberUid, distribution))) return false;
  }
  return true;
}

export type GroupSealOutcome =
  | {protection: 'sender-key'; envelope: GroupEnvelope}
  /** At least one member has no ratchet identity — use the fan-out path. */
  | {protection: 'unavailable'};

/**
 * Seals `text` for a group.
 *
 * The distribution is written *before* the message is sealed and sent. The
 * other order looks equivalent and is not: a message that reaches members who
 * do not yet hold the chain key is undecryptable for them forever, since the
 * chain has already advanced past it by the time the key arrives.
 */
export async function sealGroupText(
  myUid: string,
  chatId: string,
  memberUids: string[],
  text: string,
): Promise<GroupSealOutcome> {
  const ad = groupAd(chatId, myUid);

  // Distribution happens outside the sender-key lock: it establishes pairwise
  // sessions, which take their own locks, and holding both would deadlock the
  // moment a member's session needed the same chat.
  const current = await withOwnSenderKey<SenderKeyDistribution>(myUid, chatId, async state => {
    const next = state ?? createSenderKey();
    return {state: next, result: distributionFor(next)};
  });

  if (!(await ensureDistributed(myUid, chatId, memberUids, current))) {
    return {protection: 'unavailable'};
  }

  return withOwnSenderKey<GroupSealOutcome>(myUid, chatId, async state => {
    if (!state) return {state: null, result: {protection: 'unavailable'}};
    const sent = senderKeyEncrypt(state, text, ad);
    return {
      state: sent.state,
      result: {
        protection: 'sender-key',
        envelope: {alg: GROUP_ENVELOPE_ALG, from: myUid, message: sent.message},
      },
    };
  });
}

// ---- receiving -------------------------------------------------------------

/** Fetches and opens the distribution this sender addressed to us. */
async function fetchDistribution(
  myUid: string,
  chatId: string,
  senderUid: string,
): Promise<SenderKeyDistribution | null> {
  const snap = await getDoc(doc(distributionsRef(chatId), distributionId(senderUid, myUid)));
  if (!snap.exists()) return null;

  const envelope = snap.data()?.envelope as RatchetEnvelope | undefined;
  if (!isRatchetEnvelope(envelope)) return null;

  const chainId = snap.data()?.chainId as string | undefined;
  if (!chainId) return null;

  const opened = await openRatchetEnvelope(envelope, myUid, distributionChannel(chatId, chainId));
  if (opened.status !== 'ok') return null;
  try {
    return JSON.parse(opened.text) as SenderKeyDistribution;
  } catch (error) {
    reportError(error, 'group_distribution_unparseable');
    return null;
  }
}

export type GroupOpenOutcome = {status: 'ok'; text: string} | {status: 'undecryptable'};

export async function openGroupEnvelope(
  envelope: GroupEnvelope,
  myUid: string,
  chatId: string,
): Promise<GroupOpenOutcome> {
  const senderUid = envelope.from;
  const ad = groupAd(chatId, senderUid);

  // A chain we do not hold, or a rotation we have not picked up yet. Fetched
  // outside the receiver lock for the same reason distribution is: opening it
  // uses the pairwise session, which takes its own lock.
  const held = await loadReceiverKey(myUid, chatId, senderUid);
  let incoming: SenderKeyDistribution | null = null;
  if (!held || held.chainId !== envelope.message.chainId) {
    incoming = await fetchDistribution(myUid, chatId, senderUid);
    if (!incoming || incoming.chainId !== envelope.message.chainId) {
      return {status: 'undecryptable'};
    }
  }

  return withReceiverKey<GroupOpenOutcome>(myUid, chatId, senderUid, async state => {
    const usable = incoming ? acceptDistribution(incoming) : state;
    if (!usable) return {state: null, result: {status: 'undecryptable'}};
    try {
      const got = senderKeyDecrypt(usable, envelope.message, ad);
      return {state: got.state, result: {status: 'ok', text: got.plaintext}};
    } catch (error) {
      reportError(error, 'group_decrypt_failed');
      return {state: null, result: {status: 'undecryptable'}};
    }
  });
}

// ---- membership ------------------------------------------------------------

/**
 * Replaces this device's chain when someone has left, and clears the group
 * state it can no longer use.
 *
 * Called with the member list before and after a change. Returns whether a
 * rotation happened, so the caller can tell the difference between "nothing to
 * do" and "done".
 *
 * Only removals rotate — see rotationRequired. The stored distributions from
 * this sender are deleted so the next send redistributes the new chain to
 * everyone; leaving them would let ensureDistributed skip members on a stale
 * chainId match.
 */
export async function handleMembershipChange(
  myUid: string,
  chatId: string,
  previousMembers: string[],
  nextMembers: string[],
): Promise<boolean> {
  if (!rotationRequired(previousMembers, nextMembers)) return false;

  await withOwnSenderKey<void>(myUid, chatId, async state => ({
    state: state ? rotateSenderKey(state) : createSenderKey(),
    result: undefined,
  }));

  try {
    // Addressed by id rather than by listing the collection: the read rule
    // scopes each document to its sender and its addressee, so an unfiltered
    // list would be denied outright — and the ids are derivable from the
    // member list anyway.
    const stale = previousMembers
      .filter(uid => uid !== myUid)
      .map(uid => doc(distributionsRef(chatId), distributionId(myUid, uid)));
    await Promise.all(stale.map(ref => deleteDoc(ref).catch(() => undefined)));
  } catch (error) {
    // A stale distribution left behind only costs a redundant redistribution
    // on the next send, because ensureDistributed compares chain ids.
    reportError(error, 'group_distribution_cleanup_failed');
  }
  return true;
}

/** Drops every chain this device holds for a chat — used when leaving it. */
export async function forgetGroupState(myUid: string, chatId: string): Promise<void> {
  await clearGroupState(myUid, chatId);
}
