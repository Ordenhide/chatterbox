/**
 * How this app reads a Firestore listener's results, kept apart from the
 * queries themselves so the policy can be read — and tested — on its own.
 *
 * Both rules here answer the same question, which onSnapshot asks in two
 * different ways: is this "there is nothing" or "I do not know yet"? Reporting
 * the second as the first is what empties a screen that had content on it.
 */
import {reportError} from './telemetry';

export const isPermissionDenied = (error: any) =>
  error?.code === 'firestore/permission-denied' || error?.code === 'permission-denied';

export const logError = (error: unknown, context: string) => {
  if (__DEV__) {
    console.error(context, error);
  }
  reportError(error, context);
};

/**
 * Error handling for a *listener*, which differs from a one-shot call.
 *
 * Deleting or leaving a chat revokes read access while listeners are still
 * attached — the rules' isChatParticipant() reads the chat document, which by
 * then is gone — so every listener on that chat terminates with
 * permission-denied. That is a listener's normal end of life, not a fault.
 * Reporting it would raise a red error screen during an ordinary delete and
 * bury genuine failures in Crashlytics under noise from routine use.
 *
 * Three listeners here already did this inline and three did not (listenChat
 * among them, which is how deleting a chat surfaced an error). Sharing one
 * helper is what stops the next listener from missing it.
 *
 * Anything that is *not* permission-denied is still a real failure and is
 * reported as before.
 */
export const logListenerError = (error: unknown, context: string) => {
  if (isPermissionDenied(error)) {
    if (__DEV__) {
      console.warn(`${context}: listener closed — access revoked (chat deleted or session ended)`);
    }
    return;
  }
  logError(error, context);
};

/**
 * What a listener should show its caller after its own failure.
 *
 * onSnapshot reports two different things through the same channel: "you may
 * no longer read this" and "that read did not work". Every listener here
 * answered both by handing the caller an empty result — so a transient
 * failure, the kind that happens on a token refresh or when the network
 * changes under a backgrounded app, was indistinguishable from a conversation
 * with no messages in it. The thread went blank and stayed blank, because
 * nothing re-delivers a snapshot that already failed; leaving the screen and
 * coming back built a new listener, which is why it "fixed itself".
 *
 * Only a revoked read means the data is genuinely gone — the chat was deleted,
 * or this user was removed from it — and only then is clearing honest. Any
 * other failure leaves the last good render in place, which is stale at worst
 * and correct at best, where a wipe is simply wrong.
 *
 * `clear` rather than a boolean return so each caller states its own empty
 * value, and so the common case reads as "do nothing".
 */
export const onListenerError = (error: unknown, context: string, clear: () => void) => {
  logListenerError(error, context);
  if (isPermissionDenied(error)) clear();
};


/**
 * True when a snapshot is empty only because Firestore has not synced yet.
 *
 * On subscribe, Firestore serves an immediate snapshot from its own local
 * cache and follows it with the server's. If the cache has nothing for that
 * query — a chat opened for the first time on this device, or a cache the OS
 * has since evicted — the first snapshot arrives empty with `fromCache` set,
 * and the real one lands a round trip later.
 *
 * Delivering that empty snapshot means the caller replaces whatever was on
 * screen with nothing, and holds there until the server answers: a thread that
 * opens blank and fills in seconds later, or never on a bad connection. Worse,
 * it races the caller's own seeding from local storage — seed first and the
 * snapshot wipes it, snapshot first and the seed survives, which is exactly
 * the shape of a bug that happens "sometimes".
 *
 * A genuinely empty collection still arrives from the server with `fromCache`
 * false and is delivered normally. The one case this defers is an empty
 * *offline* collection, which renders the same empty screen either way.
 */
export function isUnsyncedEmpty(snapshot: {
  docs?: unknown[];
  metadata?: {fromCache?: boolean};
} | null | undefined): boolean {
  if (!snapshot) return false;
  return (snapshot.docs?.length ?? 0) === 0 && snapshot.metadata?.fromCache === true;
}
