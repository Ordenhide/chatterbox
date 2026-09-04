/**
 * How this app reacts to a Firestore listener failing.
 *
 * The web twin of src/services/listenerErrors.ts in the mobile client — same
 * policy, same names, matching this repo's parallel-not-shared convention.
 *
 * onSnapshot reports two different things through the same channel: "you may
 * no longer read this" and "that read did not work". Both listeners here
 * answered both by handing the caller an empty result, which is exactly what
 * a conversation with no messages looks like. So a transient failure — a
 * token refresh, a dropped connection, a tab waking from sleep — blanked the
 * open thread, and nothing re-delivers a snapshot that already failed, so it
 * stayed blank until the view was rebuilt.
 *
 * Only a revoked read means the data is genuinely gone: the chat was deleted,
 * or this user was removed from it. Any other failure leaves the last good
 * render in place, which is stale at worst where a wipe is simply wrong.
 *
 * isUnsyncedEmpty below answers the same question for a *successful* snapshot
 * that happens to be empty.
 */

/** The JS SDK reports `permission-denied`; RNFB namespaces it. Accept both. */
export function isPermissionDenied(error: unknown): boolean {
  const code = (error as {code?: unknown} | null)?.code;
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}

/**
 * `clear` rather than a boolean return so each caller states its own empty
 * value, and so the common case reads as "do nothing".
 */
export function onListenerError(error: unknown, context: string, clear: () => void): void {
  if (isPermissionDenied(error)) {
    // Routine: a deleted chat revokes every listener attached to it. Not a
    // fault, and not worth a console error on every delete.
    console.warn(`${context}: listener closed — access revoked`);
    clear();
    return;
  }
  console.warn(`${context}:`, error instanceof Error ? error.message : error);
}

/**
 * True when a snapshot is empty only because Firestore has not synced yet.
 *
 * On subscribe, Firestore serves an immediate snapshot from its own local
 * cache and follows it with the server's. If the cache has nothing for that
 * query — a chat opened for the first time in this browser, or storage the
 * browser has since cleared — the first snapshot arrives empty with
 * `fromCache` set, and the real one lands a round trip later. Delivering it
 * replaces whatever was on screen with nothing until the server answers.
 *
 * A genuinely empty collection still arrives from the server with `fromCache`
 * false and is delivered normally.
 */
export function isUnsyncedEmpty(snapshot: {
  docs?: unknown[];
  metadata?: {fromCache?: boolean};
} | null | undefined): boolean {
  if (!snapshot) return false;
  return (snapshot.docs?.length ?? 0) === 0 && snapshot.metadata?.fromCache === true;
}
