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
 * That race is not new, but it used to be unwinnable in practice: claiming
 * was a single fast setDoc. Routing the claim through the claimSession Cloud
 * Function stretched it to seconds (seconds this project actually pays right
 * now — the function's billing account is closed, so every call runs out the
 * clock and falls back), which turned a theoretical race into one that loses
 * every time. The mobile client has always guarded this explicitly; see
 * claimInProgressRef in src/contexts/AuthContext.tsx.
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
 * The explicit timeout below is load-bearing, not cosmetic: the SDK default
 * is 70s, and this project's Cloud Functions currently sit on a closed
 * billing account (2nd-gen functions run on Cloud Run, which needs active
 * billing to actually *execute*, not just to deploy — confirmed via the
 * Cloud Billing API, not assumed). A broken function that fails fast is
 * harmless — the catch below covers it — but one that hangs for up to 70s
 * makes sign-in itself feel broken long before the fallback ever runs.
 */
const CLAIM_FUNCTION_TIMEOUT_MS = 8000;

/**
 * Set once the Cloud Function has proven unreachable in this page session, so
 * later claims skip straight to the direct write instead of each paying the
 * timeout again. Mirrors the mobile heartbeat's `heartbeatUnavailable` flag.
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
    await claimSessionFn({
      sessionId,
      deviceInfo: {
        platform: 'web',
        deviceId: sessionId,
        deviceName: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : undefined,
      },
    });
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
    // proof of displacement. It is tempting to special-case
    // permission-denied (firestore.rules is *written* to deny this read for
    // a stale session), but those rules are not deployed yet, so today a
    // permission error can only mean something unexpected — e.g. the auth
    // token not having propagated to Firestore yet on a fresh sign-in.
    // Failing closed on it bounces users out of a working app for no
    // security benefit. The live listener below still catches a genuine
    // takeover, and this should be revisited when the rules actually ship.
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
      // to Firestore yet. firestore.rules *is* written to deny this read for
      // a stale session, which would make permission-denied meaningful — but
      // those rules are not deployed, so acting on it today only risks
      // signing out working sessions for no benefit. Revisit together with
      // the rules deployment.
    },
  );
}
