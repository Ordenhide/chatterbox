import {doc, getDocFromServer, onSnapshot, serverTimestamp, setDoc} from 'firebase/firestore';
import {httpsCallable} from 'firebase/functions';
import {auth, db, functions} from '../firebase';

/**
 * Single active session per account.
 *
 * The account's `users/{uid}.activeSessionId` names the one session allowed to
 * be signed in. Every client watches that field and signs itself out when it
 * changes to someone else's id, so a new sign-in anywhere displaces the old
 * session everywhere. This mirrors the mobile client's protocol (see
 * src/services/session.ts and src/contexts/AuthContext.tsx) and shares the same
 * Firestore field, so web and mobile displace each other correctly.
 *
 * The id is per *browser*, not per tab, so several tabs of the same browser are
 * one session and never evict one another.
 */

const SESSION_KEY = 'cb_web_session';

/**
 * The explicit sign-in claim currently in flight, if any.
 *
 * Firebase fires onAuthStateChanged the moment signInWithEmailAndPassword
 * resolves — which is *before* the claimSession() that follows it in
 * services/auth.ts completes. Without this guard, App.tsx's [user] effect
 * races ahead and calls verifyOrAdoptSession() while activeSessionId still
 * names the *previous* device, so a brand-new sign-in concludes it has been
 * displaced and immediately signs itself back out.
 *
 * That race is not new, but routing the claim through the claimSession Cloud
 * Function widened it: a network round trip instead of a single fast setDoc.
 *
 * This used to add that the function's billing account was closed, so every
 * call ran out the clock and fell back — which made the race one that lost
 * every time. That is no longer true: the function is deployed and answers
 * immediately. The guard stays because the race does: Firebase resolves
 * sign-in before the claim that follows it, however fast the claim is. The
 * mobile client has always guarded this explicitly; see claimInProgressRef in
 * src/contexts/AuthContext.tsx.
 */
let claimInFlight: Promise<string> | null = null;

/** True while an explicit sign-in is still claiming the session. */
export function isClaimInFlight(): boolean {
  return claimInFlight !== null;
}

/**
 * Resolves once any in-flight explicit claim has settled, so callers read
 * `activeSessionId` only after it reflects this sign-in. Never rejects: a
 * failed claim is handled by claimSession's own fallback, and a caller
 * waiting here should proceed to read either way.
 */
async function awaitClaimInFlight(): Promise<void> {
  const pending = claimInFlight;
  if (!pending) return;
  try {
    await pending;
  } catch {
    // claimSession already falls back internally; nothing to do here.
  }
}

/** Stable id for this browser, created on first use and reused thereafter. */
export function getSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && existing.trim()) return existing;
  } catch {
    // Storage blocked (private mode / disabled cookies) — fall through.
  }
  const created =
    'web_' +
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  try {
    localStorage.setItem(SESSION_KEY, created);
  } catch {
    // Non-persistent id: this browser still behaves as a session for its
    // lifetime, it just won't be recognised as the same one after a reload.
  }
  return created;
}

/**
 * Takes ownership of the account for this browser, displacing whatever session
 * held it. Unconditional by design — this is what makes a fresh sign-in evict
 * the previous device. Call it only for an *explicit* sign-in, never on page
 * load, or reopening a tab would silently steal the session back from the
 * device that legitimately took it.
 *
 * Routes through the same `claimSession` Cloud Function the mobile app uses
 * (functions/index.js) rather than writing activeSessionId directly: that
 * gives web the same rate limiting and session-claimed custom claim mobile
 * already gets, instead of a second, weaker implementation of the same
 * operation. Falls back to the direct write mobile also falls back to if the
 * function is unreachable, so a function outage degrades to the old
 * behavior rather than blocking sign-in.
 *
 * The explicit timeout below is load-bearing, not cosmetic: the SDK default is
 * 70s. A broken function that fails fast is harmless — the catch below covers
 * it — but one that hangs for that long makes sign-in itself feel broken long
 * before the fallback ever runs. This used to add that the project's billing
 * account was closed, so every call hung and the fallback was the only path
 * that ever ran; that is fixed, and the timeout is now what it says it is: a
 * bound on how long sign-in can wait, for a call that normally answers in
 * well under a second.
 */
const CLAIM_FUNCTION_TIMEOUT_MS = 8000;

/**
 * Set once the Cloud Function has proven unreachable in this page session, so
 * later claims skip straight to the direct write instead of each paying the
 * timeout again.
 */
let claimFunctionUnavailable = false;

/** Test seam — clears the module-level claim state between cases. */
export function _resetClaimState(): void {
  claimInFlight = null;
  claimFunctionUnavailable = false;
}

export function claimSession(uid: string): Promise<string> {
  const pending = performClaim(uid);
  claimInFlight = pending;
  return pending.finally(() => {
    // Only clear if a newer claim hasn't already replaced us.
    if (claimInFlight === pending) claimInFlight = null;
  });
}

async function performClaim(uid: string): Promise<string> {
  const sessionId = getSessionId();
  const writeDirectly = () =>
    setDoc(
      doc(db, 'users', uid),
      {activeSessionId: sessionId, sessionUpdatedAt: serverTimestamp()},
      {merge: true},
    );

  if (claimFunctionUnavailable) {
    await writeDirectly();
    return sessionId;
  }

  try {
    const claimSessionFn = httpsCallable(functions, 'claimSession', {timeout: CLAIM_FUNCTION_TIMEOUT_MS});
    // Session id only. This used to carry a device description including 120
    // characters of user agent, which landed on the public profile document —
    // a fingerprint readable by every contact. See functions/index.js.
    await claimSessionFn({sessionId});
    // The function just rotated this account's custom claims; force-refresh
    // so this tab's token reflects them immediately rather than waiting up
    // to an hour for its natural refresh. Non-critical if it fails — the
    // token will refresh on its own eventually, same as mobile's fallback.
    try {
      await auth.currentUser?.getIdToken(true);
    } catch {
      // ignore — see comment above
    }
  } catch {
    // Function unreachable/not deployed — fall back to the direct write so
    // sign-in still succeeds, just without the function's extra protections.
    // Remember the failure so the next sign-in in this page session doesn't
    // pay the timeout again before reaching this same fallback.
    claimFunctionUnavailable = true;
    await writeDirectly();
  }
  return sessionId;
}

/**
 * Validates a *restored* sign-in (page load with a persisted Firebase session).
 *
 * Returns false when another session owns the account, meaning this browser was
 * displaced while it was away and must sign out. When the account is unclaimed,
 * or already ours, we (re)assert ownership and return true.
 *
 * App.tsx also reaches here on a *fresh* sign-in, because onAuthStateChanged
 * can't distinguish the two — hence the wait below. Without it this reads
 * activeSessionId before the accompanying claim has written it, sees the
 * previous device still listed, and reports a just-signed-in user as
 * displaced.
 */
export async function verifyOrAdoptSession(uid: string): Promise<boolean> {
  await awaitClaimInFlight();

  const sessionId = getSessionId();
  const userRef = doc(db, 'users', uid);

  let current: string | null = null;
  try {
    // getDocFromServer, NOT getDoc: this client runs Firestore with a
    // persistent IndexedDB cache (see firebase.ts), so a plain getDoc can be
    // served instantly from disk with whatever activeSessionId was cached
    // *before* this sign-in. Deciding "you have been displaced" — and
    // signing the user out — from a possibly-arbitrarily-stale cached value
    // is wrong on its own, and its speed also made it reliably win the race
    // against the claim that was still in flight.
    const snap = await getDocFromServer(userRef);
    current = snap.exists() ? ((snap.data().activeSessionId as string) ?? null) : null;
  } catch (err) {
    // Anything that stops us reading the authoritative value — offline, a
    // transient network failure, or a permission error — is NOT treated as
    // proof of displacement.
    //
    // It is tempting to special-case permission-denied, since firestore.rules
    // is written to deny this read for a stale session (hasCurrentSession) and
    // the rules are deployed. It still is not proof: the same error arrives
    // when a fresh sign-in's token has not propagated to Firestore yet, and
    // the rule's own 120-second allowance means a genuinely displaced device
    // is often *not* denied. Failing closed here would bounce users out of a
    // working app in the common case to catch the rare one slightly earlier.
    // The live listener below still catches a genuine takeover.
    return true;
  }

  if (current && current !== sessionId) return false;

  try {
    await setDoc(
      userRef,
      {activeSessionId: sessionId, sessionUpdatedAt: serverTimestamp()},
      {merge: true},
    );
  } catch {
    // Ownership is already recorded or the write is queued offline; the read
    // above established that nobody else holds the session.
  }
  return true;
}

/**
 * Watches for another device claiming the account and invokes `onTakeover`.
 * Fires only on a *different* non-empty id, so our own claim writes and a
 * cleared field don't sign us out.
 */
export function listenForSessionTakeover(uid: string, onTakeover: () => void): () => void {
  const sessionId = getSessionId();
  return onSnapshot(
    doc(db, 'users', uid),
    snap => {
      // While our own sign-in is still claiming, the document legitimately
      // still names the previous device — reacting to that would sign the
      // user out of the session they are in the middle of establishing.
      if (isClaimInFlight()) return;
      const current = snap.data()?.activeSessionId as string | undefined;
      if (current && current !== sessionId) onTakeover();
    },
    () => {
      // Listener errors are not treated as proof of a takeover — signing out
      // here would boot users on a flaky connection, and a permission error
      // on a fresh sign-in can simply mean the auth token has not propagated
      // to Firestore yet. Same reasoning as verifyOrAdoptSession's catch
      // above: the deployed rules do deny this read for a stale session, and
      // that still does not make permission-denied a reliable signal.
    },
  );
}
