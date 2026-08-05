/**
 * Pure subscription-entitlement logic, split out from index.js so it can be
 * unit-tested without a Stripe account or a Firestore connection — same
 * split as aiChat.js / translate.js / speechToText.js / ssrfGuard.js.
 *
 * The client has a byte-equivalent copy of `isProActive` (src/services/
 * entitlement.ts, web/src/services/entitlement.ts) for UI gating. The two
 * must agree, but the client's copy is only ever advisory: the callable
 * functions re-check with THIS copy server-side, because a client can call
 * a callable directly with any signed-in token.
 */

/** Stripe statuses that mean "this person has paid and hasn't lapsed yet". */
const ENTITLED_STATUSES = new Set(['active', 'trialing']);

/**
 * Whether a stored entitlement grants Pro right now.
 *
 * `past_due` deliberately still counts, as long as the paid-for period
 * hasn't ended: Stripe puts a subscription in past_due while it retries a
 * failed card over several days, and most of those retries succeed. Cutting
 * someone off the instant a renewal blips — mid-period, after they've paid
 * for that period — is a worse failure than letting a genuinely-lapsed
 * subscriber keep access until `currentPeriodEnd`, which is the same moment
 * they'd lose it anyway. Once that timestamp passes, past_due stops counting.
 */
function isProActive(entitlement, now = Date.now()) {
  if (!entitlement || typeof entitlement !== 'object') return false;
  const {status, currentPeriodEnd} = entitlement;
  if (typeof currentPeriodEnd !== 'number' || !(currentPeriodEnd > now)) return false;
  return ENTITLED_STATUSES.has(status) || status === 'past_due';
}

/**
 * Maps a Stripe Subscription object to the document we store at
 * entitlements/{uid}. Kept pure (no Firestore, no network) so the webhook's
 * event→document mapping is testable against fixtures.
 *
 * Stripe reports period ends in SECONDS; everything in this codebase stores
 * epoch milliseconds, so the conversion happens here, once.
 */
function entitlementFromSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') {
    throw new Error('subscription is required');
  }
  const periodEndSecs = subscription.current_period_end;
  if (typeof periodEndSecs !== 'number') {
    throw new Error('subscription.current_period_end must be a number');
  }
  const item = subscription.items && subscription.items.data && subscription.items.data[0];
  return {
    status: subscription.status,
    currentPeriodEnd: periodEndSecs * 1000,
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
    stripeCustomerId:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    stripeSubscriptionId: subscription.id,
    priceId: item?.price?.id ?? null,
  };
}

/**
 * Guards against out-of-order webhook delivery. Stripe retries failed
 * deliveries and does not guarantee ordering, so a stale "canceled" event
 * can land after the "active" event that superseded it and silently revoke a
 * live subscription. Only apply an event at least as new as what's stored.
 */
function shouldApplyEvent(existing, incomingEventCreatedMs) {
  if (!existing || typeof existing.lastEventAt !== 'number') return true;
  return incomingEventCreatedMs >= existing.lastEventAt;
}

module.exports = {
  ENTITLED_STATUSES,
  isProActive,
  entitlementFromSubscription,
  shouldApplyEvent,
};
