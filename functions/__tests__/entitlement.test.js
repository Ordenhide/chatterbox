const {
  isProActive,
  entitlementFromSubscription,
  shouldApplyEvent,
} = require('../entitlement');

const NOW = 1_700_000_000_000;
const FUTURE = NOW + 86_400_000; // +1 day
const PAST = NOW - 86_400_000; // -1 day

describe('isProActive', () => {
  test('grants Pro for an active subscription inside its paid period', () => {
    expect(isProActive({status: 'active', currentPeriodEnd: FUTURE}, NOW)).toBe(true);
  });

  test('grants Pro during a trial', () => {
    expect(isProActive({status: 'trialing', currentPeriodEnd: FUTURE}, NOW)).toBe(true);
  });

  test('keeps Pro while past_due but still inside the paid period (card-retry grace)', () => {
    // Stripe retries a failed renewal for days; the user already paid for
    // this period, so revoking mid-period would be the bigger bug.
    expect(isProActive({status: 'past_due', currentPeriodEnd: FUTURE}, NOW)).toBe(true);
  });

  test('revokes past_due once the paid period has actually ended', () => {
    expect(isProActive({status: 'past_due', currentPeriodEnd: PAST}, NOW)).toBe(false);
  });

  test('revokes an active subscription whose period has elapsed', () => {
    // Guards the case where the renewal webhook never arrives: the stored
    // status stays "active" forever, so expiry has to be enforced by time.
    expect(isProActive({status: 'active', currentPeriodEnd: PAST}, NOW)).toBe(false);
  });

  test('denies canceled, unpaid, and incomplete regardless of period end', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired']) {
      expect(isProActive({status, currentPeriodEnd: FUTURE}, NOW)).toBe(false);
    }
  });

  test('denies when there is no entitlement at all — the default for every new user', () => {
    expect(isProActive(null, NOW)).toBe(false);
    expect(isProActive(undefined, NOW)).toBe(false);
    expect(isProActive({}, NOW)).toBe(false);
  });

  test('denies malformed or spoofed-shape documents rather than throwing', () => {
    expect(isProActive({status: 'active'}, NOW)).toBe(false);
    expect(isProActive({status: 'active', currentPeriodEnd: 'forever'}, NOW)).toBe(false);
    expect(isProActive('active', NOW)).toBe(false);
  });

  test('treats the exact expiry instant as expired, not entitled', () => {
    expect(isProActive({status: 'active', currentPeriodEnd: NOW}, NOW)).toBe(false);
    expect(isProActive({status: 'active', currentPeriodEnd: NOW + 1}, NOW)).toBe(true);
  });
});

describe('entitlementFromSubscription', () => {
  const subscription = {
    id: 'sub_123',
    status: 'active',
    current_period_end: 1_700_086_400, // seconds
    cancel_at_period_end: false,
    customer: 'cus_abc',
    items: {data: [{price: {id: 'price_monthly'}}]},
  };

  test('maps a Stripe subscription to the stored entitlement shape', () => {
    expect(entitlementFromSubscription(subscription)).toEqual({
      status: 'active',
      currentPeriodEnd: 1_700_086_400_000,
      cancelAtPeriodEnd: false,
      stripeCustomerId: 'cus_abc',
      stripeSubscriptionId: 'sub_123',
      priceId: 'price_monthly',
    });
  });

  test('converts Stripe seconds to epoch milliseconds', () => {
    // A missed x1000 here would expire every subscription in 1970 — i.e.
    // silently revoke Pro from every paying customer.
    const {currentPeriodEnd} = entitlementFromSubscription(subscription);
    expect(currentPeriodEnd).toBe(subscription.current_period_end * 1000);
    expect(isProActive({status: 'active', currentPeriodEnd}, 1_700_000_000_000)).toBe(true);
  });

  test('accepts an expanded customer object as well as a bare id', () => {
    const expanded = {...subscription, customer: {id: 'cus_expanded'}};
    expect(entitlementFromSubscription(expanded).stripeCustomerId).toBe('cus_expanded');
  });

  test('carries cancel_at_period_end through so the UI can say "ends on ..."', () => {
    const canceling = {...subscription, cancel_at_period_end: true};
    expect(entitlementFromSubscription(canceling).cancelAtPeriodEnd).toBe(true);
  });

  test('tolerates a subscription with no line items rather than crashing the webhook', () => {
    const noItems = {...subscription, items: undefined};
    expect(entitlementFromSubscription(noItems).priceId).toBeNull();
  });

  test('rejects a subscription with no usable period end', () => {
    expect(() => entitlementFromSubscription(null)).toThrow(/required/);
    expect(() => entitlementFromSubscription({id: 'sub_1'})).toThrow(/current_period_end/);
  });
});

describe('shouldApplyEvent', () => {
  test('applies any event when nothing is stored yet', () => {
    expect(shouldApplyEvent(null, NOW)).toBe(true);
    expect(shouldApplyEvent({}, NOW)).toBe(true);
  });

  test('applies a newer event', () => {
    expect(shouldApplyEvent({lastEventAt: PAST}, NOW)).toBe(true);
  });

  test('ignores an older event — stale "canceled" must not revoke a live subscription', () => {
    // Stripe retries deliveries and does not guarantee order, so this is a
    // real delivery pattern, not a hypothetical one.
    expect(shouldApplyEvent({lastEventAt: NOW}, PAST)).toBe(false);
  });

  test('applies a same-timestamp redelivery (idempotent retry)', () => {
    expect(shouldApplyEvent({lastEventAt: NOW}, NOW)).toBe(true);
  });
});
