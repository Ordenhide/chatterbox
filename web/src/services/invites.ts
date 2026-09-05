/**
 * Invite links, web half. Mirrors src/services/invites.ts — see that file for
 * why the email directory had to go and what the token is doing.
 *
 * It exists separately because `web/` is a reimplementation rather than shared
 * code. The two must not drift: the same collection, the same document shape,
 * the same rules enforcing both. A divergence here would show up as one client
 * minting links the other cannot open.
 *
 * The one deliberate difference is where the outstanding invite is remembered.
 * Mobile uses MMKV; this uses localStorage, which the user can clear and a
 * private window does not keep. Losing it costs the ability to show or
 * withdraw the link, not the link itself.
 */
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {db} from '../firebase';
import {bytesToBase64, bytesToHex, secureRandomBytes} from './crypto';
import {getDeviceKeypairIfEnrolled} from './e2eeKeys';

const TOKEN_BYTES = 32;

/** Kept identical to the mobile client, and under the rules' 7-day ceiling. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export const INVITE_SCHEME = 'chatterbox://invite';

const OUTSTANDING_KEY = 'chatterbox:invite:outstanding';

export type Invite = {
  token: string;
  inviterUid: string;
  /** Base64 X25519 public key — the same one `publicKeys` already publishes. */
  inviterKey: string;
  expiresAt: number;
  acceptedBy: string | null;
};

export type InviteState = 'pending' | 'accepted' | 'expired' | 'gone';

export type CreateInviteResult =
  | {ok: true; invite: Invite}
  | {ok: false; reason: 'not-enrolled' | 'failed'};

export type AcceptInviteResult =
  | {ok: true; inviterUid: string; inviterKey: string}
  | {ok: false; reason: 'not-found' | 'expired' | 'already-used' | 'own-invite' | 'failed'};

export function newInviteToken(): string {
  return bytesToHex(secureRandomBytes(TOKEN_BYTES));
}

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

/**
 * Mints an invite for this browser's published key.
 *
 * `getDeviceKeypairIfEnrolled`, never the enrolling variant: making an invite
 * must not be the thing that publishes a fresh keypair over an account that
 * already has one.
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
    await setDoc(doc(db, 'invites', invite.token), {
      inviterUid: invite.inviterUid,
      inviterKey: invite.inviterKey,
      expiresAt: invite.expiresAt,
      acceptedBy: null,
      createdAt: serverTimestamp(),
    });
    return {ok: true, invite};
  } catch (error) {
    console.warn('createInvite failed:', error);
    return {ok: false, reason: 'failed'};
  }
}

/**
 * Claims an invite, returning who it was from.
 *
 * The expiry is checked here *and* in the rules. This check gives the user a
 * reason rather than a permission error; the rules are what enforce it, since
 * this clock belongs to whoever holds the link.
 */
export async function acceptInvite(token: string, userId: string): Promise<AcceptInviteResult> {
  if (!token || !userId) return {ok: false, reason: 'failed'};
  try {
    const snapshot = await getDoc(doc(db, 'invites', token));
    if (!snapshot.exists()) return {ok: false, reason: 'not-found'};

    const data = snapshot.data() as Partial<Invite> | undefined;
    if (!data?.inviterUid || !data.inviterKey) return {ok: false, reason: 'not-found'};
    // Ahead of 'expired' and 'already-used': inviting yourself is a mistake
    // with a clearer explanation than either.
    if (data.inviterUid === userId) return {ok: false, reason: 'own-invite'};
    if (data.acceptedBy) return {ok: false, reason: 'already-used'};
    if (typeof data.expiresAt === 'number' && data.expiresAt < Date.now()) {
      return {ok: false, reason: 'expired'};
    }

    await updateDoc(doc(db, 'invites', token), {acceptedBy: userId});
    return {ok: true, inviterUid: data.inviterUid, inviterKey: data.inviterKey};
  } catch (error) {
    console.warn('acceptInvite failed:', error);
    return {ok: false, reason: 'failed'};
  }
}

/** Withdraws an unused invite. Only the inviter can, per the rules. */
export async function revokeInvite(token: string): Promise<void> {
  if (!token) return;
  try {
    await deleteDoc(doc(db, 'invites', token));
  } catch (error) {
    console.warn('revokeInvite failed:', error);
  }
}

/**
 * Whether a link this browser minted is still open.
 *
 * A failed read reports 'pending', not 'gone': claiming the link is dead
 * because the network was down would push the user to mint a second one while
 * the first is still live.
 */
export async function inviteState(token: string): Promise<InviteState> {
  try {
    const snapshot = await getDoc(doc(db, 'invites', token));
    if (!snapshot.exists()) return 'gone';
    const data = snapshot.data() as Partial<Invite> | undefined;
    if (data?.acceptedBy) return 'accepted';
    if (typeof data?.expiresAt === 'number' && data.expiresAt < Date.now()) return 'expired';
    return 'pending';
  } catch (error) {
    console.warn('inviteState failed:', error);
    return 'pending';
  }
}

export function rememberInvite(invite: Invite): void {
  try {
    localStorage.setItem(OUTSTANDING_KEY, JSON.stringify(invite));
  } catch {
    // The invite exists on the server either way.
  }
}

/** The remembered invite, or null. Expired ones are dropped rather than shown. */
export function outstandingInvite(): Invite | null {
  try {
    const raw = localStorage.getItem(OUTSTANDING_KEY);
    if (!raw) return null;
    const invite = JSON.parse(raw) as Partial<Invite>;
    if (typeof invite?.token !== 'string' || !/^[0-9a-f]{64}$/.test(invite.token)) return null;
    if (typeof invite.expiresAt !== 'number' || invite.expiresAt < Date.now()) {
      forgetInvite();
      return null;
    }
    return invite as Invite;
  } catch {
    return null;
  }
}

export function forgetInvite(): void {
  try {
    localStorage.removeItem(OUTSTANDING_KEY);
  } catch {
    // Nothing to do: a store that cannot be written cannot be cleared either.
  }
}
