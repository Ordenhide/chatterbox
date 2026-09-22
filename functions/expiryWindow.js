/**
 * Which messages a chat's disappearing-messages policy may delete.
 *
 * Its own file, and a pure function, because the property that matters here
 * is not "does the sweep run" but "what can it possibly reach" — and that is
 * exactly the part that was wrong. processExpiredMessages deleted on
 * `createdAt < now - expiry` with no lower bound, so enabling "delete after 1
 * hour" destroyed everything older than an hour: the whole conversation, in
 * the next five-minute tick, irrecoverably. The scheduled function reported
 * `ok`, because it had done what it was told.
 *
 * A window is returned only when both halves of the policy are present. The
 * activation time is not optional bookkeeping — without it, backlog and new
 * messages are indistinguishable, and the two possible errors are not
 * symmetric: failing to delete is a gap someone can notice and report, and
 * deleting is permanent. So a chat missing it is skipped.
 *
 * The web client's sweepExpiredMessages (web/src/services/chat.ts) is the
 * client-side twin of this and takes the same three decisions in the same
 * order. Keep them in step.
 */

/**
 * @param {{messageExpiry?: unknown, messageExpirySince?: unknown}} chat
 * @param {number} nowMs
 * @returns {{sinceMs: number, cutoffMs: number} | null} the half-open window
 *   [sinceMs, cutoffMs) of createdAt values that may be deleted, or null when
 *   nothing in this chat may be.
 */
function expirySweepWindow(chat, nowMs) {
  const hours = Number(chat && chat.messageExpiry);
  // No policy, or a nonsense one. `> 0` also covers the "off" setting, which
  // both clients write as 0 rather than by clearing the field.
  if (!Number.isFinite(hours) || hours <= 0) return null;

  const sinceMs = Number(chat && chat.messageExpirySince);
  // A policy whose activation time never landed. See the note above on why
  // this skips rather than sweeps from the beginning of time.
  if (!Number.isFinite(sinceMs) || sinceMs <= 0) return null;

  if (!Number.isFinite(nowMs)) return null;

  const cutoffMs = nowMs - hours * 3600000;
  // Nothing sent since the policy was enabled is old enough yet. Returning a
  // window here would be harmless (it would be empty) but it would also be
  // a query per chat per tick for the whole window a policy is younger than
  // its own timer.
  if (cutoffMs <= sinceMs) return null;

  return {sinceMs, cutoffMs};
}

module.exports = {expirySweepWindow};
