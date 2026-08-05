/**
 * Chatterbox Pro purchase flow (web only).
 *
 * Both calls hand back a Stripe-hosted URL that the caller redirects to —
 * card details never touch this app, which is what keeps it out of PCI scope.
 * The mobile client has no counterpart to this file on purpose: Apple and
 * Google require their own in-app purchase for digital goods sold inside an
 * app, so mobile reads entitlement (services/entitlement.ts) without selling.
 */
import {getFunctions, httpsCallable} from 'firebase/functions';
import {getApp} from 'firebase/app';

const functions = getFunctions(getApp());

export type ProPlan = 'monthly' | 'yearly';

/**
 * Starts Stripe Checkout and returns the URL to send the user to.
 *
 * Only the plan name crosses the wire — the actual price id is resolved
 * server-side from an allowlist, so a tampered client can't substitute a
 * cheaper (or free) price.
 */
export async function createCheckoutSession(plan: ProPlan): Promise<string> {
  const callable = httpsCallable<{plan: ProPlan; returnUrl: string}, {url: string}>(
    functions,
    'createCheckoutSession',
  );
  const result = await callable({plan, returnUrl: window.location.origin});
  return result.data.url;
}

/** Opens Stripe's billing portal, where a subscriber can update or cancel. */
export async function createBillingPortalSession(): Promise<string> {
  const callable = httpsCallable<{returnUrl: string}, {url: string}>(
    functions,
    'createBillingPortalSession',
  );
  const result = await callable({returnUrl: window.location.origin});
  return result.data.url;
}

/** True when a callable rejected because the caller isn't a Pro subscriber. */
export function isProRequiredError(error: unknown): boolean {
  const err = error as {code?: string; details?: {reason?: string}};
  return err?.code === 'functions/permission-denied' && err?.details?.reason === 'pro-required';
}
