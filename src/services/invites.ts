/**
 * Invite links — how two people find each other once the server has no
 * directory to search.
 *
 * The app used to start a chat from an email address, which meant `users`
 * carried a plaintext, indexed email and anyone signed in could turn a person
 * into the list of every conversation they were in. That reverse lookup is the
 * largest readable thing about a user after the participant list itself, and
 * it existed only to serve a search box.
 *
 * So the search box goes and this replaces it: the inviter mints a token, hands
 * it over out of band — a QR code, a link sent through anything else — and the
 * person holding it can open exactly one conversation with exactly one person.
 *
 * ## The token is the capability
 *
 * `invites/{token}` is readable by anyone who knows the token and by nobody
 * who does not: the rules permit `get` and forbid `list`, so the collection
 * cannot be enumerated and the id cannot be guessed at 32 bytes. That is the
 * whole access model, and it is why the document holds nothing that would hurt
 * to hand over — a uid and a public key, both of which the recipient is about
 * to learn anyway and neither of which is secret.
 *
 * It deliberately does *not* hold a name. The inviter's name reaches the other
 * side encrypted, inside the chat, or not at all; a name in the invite would
 * put it back in the clear on the server, which is the thing being removed.
 *
 * ## Single use, and short-lived
 *
 * A link that works forever is a standing invitation for whoever finds the QR
 * code in an old photo. Accepting stamps `acceptedBy` and the rules refuse a
 * second accept, so a leaked link opens at most one conversation, with someone
 * the inviter can see and remove.
 */
import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from './firebase/firestore';
import {bytesToBase64, bytesToHex, secureRandomBytes} from './crypto';
import {getDeviceKeypairIfEnrolled} from './e2eeKeys';
import {reportError} from './telemetry';

const db = getFirestore();
const invitesRef = () => 'invites';

/**
 * 32 bytes, hex. The token is the only thing standing between a stranger and
 * one conversation, so it is sized as a key rather than as an id — 128 bits
 * would do, and the extra costs nothing but URL length.
 */
const TOKEN_BYTES = 32;

/** How long a link stays openable. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export type Invite = {
  token: string;
  inviterUid: string;
  /** Base64 X25519 public key — the same one `publicKeys` already publishes. */
  inviterKey: string;
  expiresAt: number;
  acceptedBy: string | null;
};

export type CreateInviteResult =
  | {ok: true; invite: Invite}
  | {ok: false; reason: 'not-enrolled' | 'failed'};

export type AcceptInviteResult =
  | {ok: true; inviterUid: string; inviterKey: string}
  | {ok: false; reason: 'not-found' | 'expired' | 'already-used' | 'own-invite' | 'failed'};

export function newInviteToken(): string {
  return bytesToHex(secureRandomBytes(TOKEN_BYTES));
}

/**
 * Mints an invite for this device's published key.
 *
 * Uses `getDeviceKeypairIfEnrolled`, never the enrolling variant: minting an
 * invite must not be the thing that quietly publishes a fresh keypair over an
 * account that already has one. A device with no key has nothing to invite
 * anyone *to*, and says so.
 */
export async function createInvite(userId: string): Promise<CreateInviteResult> {
  if (!userId) return {ok: false, reason: 'failed'};
  const keypair = await getDeviceKeypairIfEnrolled(userId);
  if (!keypair) return {ok: false, reason: 'not-enrolled'};

  const invite: Invite = {
    token: newInviteToken(),
    inviterUid: userId,
    inviterKey: bytesToBase64(keypair.publicKey),
    expiresAt: Date.now() + INVITE_TTL_MS,
    acceptedBy: null,
  };

  try {
    await setDoc(doc(db, invitesRef(), invite.token), {
      inviterUid: invite.inviterUid,
      inviterKey: invite.inviterKey,
      expiresAt: invite.expiresAt,
      acceptedBy: null,
      createdAt: serverTimestamp(),
    });
    return {ok: true, invite};
  } catch (error) {
    reportError(error, 'invite_create_failed');
    return {ok: false, reason: 'failed'};
  }
}

/**
 * Claims an invite, returning who it was from.
 *
 * The expiry is checked here *and* in the rules. This check exists to give the
 * user a reason rather than a permission error; the rules are what actually
 * enforce it, because this one runs on a clock the holder of the link controls.
 */
export async function acceptInvite(token: string, userId: string): Promise<AcceptInviteResult> {
  if (!token || !userId) return {ok: false, reason: 'failed'};
  try {
    const snapshot = await getDoc(doc(db, invitesRef(), token));
    if (!snapshot.exists()) return {ok: false, reason: 'not-found'};

    const data = snapshot.data() as Partial<Invite> | undefined;
    if (!data?.inviterUid || !data.inviterKey) return {ok: false, reason: 'not-found'};
    // Before 'expired' and 'already-used', because inviting yourself is a
    // mistake with a clearer explanation than either of those.
    if (data.inviterUid === userId) return {ok: false, reason: 'own-invite'};
    if (data.acceptedBy) return {ok: false, reason: 'already-used'};
    if (typeof data.expiresAt === 'number' && data.expiresAt < Date.now()) {
      return {ok: false, reason: 'expired'};
    }

    await updateDoc(doc(db, invitesRef(), token), {acceptedBy: userId});
    return {ok: true, inviterUid: data.inviterUid, inviterKey: data.inviterKey};
  } catch (error) {
    reportError(error, 'invite_accept_failed');
    return {ok: false, reason: 'failed'};
  }
}

/** Withdraws an unused invite. Only the inviter can, per the rules. */
export async function revokeInvite(token: string): Promise<void> {
  if (!token) return;
  try {
    await deleteDoc(doc(db, invitesRef(), token));
  } catch (error) {
    reportError(error, 'invite_revoke_failed');
  }
}

/**
 * The link handed to the other person.
 *
 * A custom scheme rather than an https URL on purpose: an https link is
 * resolved by whatever app opens it, so the token would travel through a
 * browser, a preview fetcher and any link scanner in between. This one is
 * opened by this app or by nothing.
 *
 * The token sits in the fragment, which is the half of a URL that is not sent
 * to a server even when one is involved.
 */
export const INVITE_SCHEME = 'chatterbox://invite';

export function inviteLink(token: string): string {
  return `${INVITE_SCHEME}#${token}`;
}

/** The token in a link, or null if this is not one. Tolerant of stray spaces. */
export function parseInviteLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed.startsWith(`${INVITE_SCHEME}#`)) return null;
  const token = trimmed.slice(INVITE_SCHEME.length + 1);
  return /^[0-9a-f]{64}$/.test(token) ? token : null;
}
