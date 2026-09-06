/**
 * Holds an invite token that arrived by link until there is somewhere to put
 * it.
 *
 * A `chatterbox://invite#<token>` link can be tapped at any moment, including
 * with the app closed and nobody signed in — which is in fact the common case,
 * since the person being invited is usually installing the app because of this
 * link. The token therefore cannot be handed straight to a screen: it has to
 * survive a cold start and a sign-up before there is a navigator, let alone an
 * account to accept with.
 *
 * Module scope rather than storage, deliberately. A token that outlives the
 * process is a token that reappears weeks later and opens a conversation the
 * person no longer remembers agreeing to; the invite is valid for 24 hours
 * and a link that was not acted on in one session is better re-tapped.
 *
 * Nothing here accepts anything. It parks a token, and the screen still asks.
 * Accepting is single-use and cannot be undone — a link consumed by a mis-tap
 * on launch is a conversation the inviter has to notice and unpick.
 */
import {parseInviteLink} from './invites';

let pending: string | null = null;

/**
 * Records the token in a link, if it is one. Returns whether it took it, so a
 * caller can tell an invite link apart from every other URL the OS may hand
 * the app.
 */
export function captureInviteUrl(url: string | null | undefined): boolean {
  const token = parseInviteLink(url);
  if (!token) return false;
  pending = token;
  return true;
}

/**
 * The parked token, cleared as it is read.
 *
 * Read-once because the caller navigates with it: leaving it set would send
 * the user back to the invite screen every time the app resumed, long after
 * they had dealt with it.
 */
export function takePendingInvite(): string | null {
  const token = pending;
  pending = null;
  return token;
}

/** Whether a link is waiting, without consuming it. */
export function hasPendingInvite(): boolean {
  return pending !== null;
}

/** Test seam. */
export function __clearPendingInvite(): void {
  pending = null;
}
