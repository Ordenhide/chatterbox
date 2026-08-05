/**
 * Chatterbox Pro entitlement — read side.
 *
 * The entitlement document lives at `entitlements/{uid}`, a top-level
 * collection that is READ-ONLY to clients (firestore.rules) and written
 * exclusively by the Stripe webhook through the Admin SDK. It is deliberately
 * not a field on `users/{uid}`, because that document grants its owner
 * blanket write access — an entitlement there could be self-granted from the
 * browser console.
 *
 * `isProActive` here is advisory: it drives UI locks so people see a tidy
 * upgrade prompt instead of an error. It is NOT the paywall. Callables can be
 * invoked directly with any signed-in token, so the server re-checks with its
 * own copy (functions/entitlement.js) before doing any paid work.
 */
import {doc, onSnapshot} from 'firebase/firestore';
import {db} from '../firebase';

export type EntitlementStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired';

export interface Entitlement {
  status: EntitlementStatus;
  /** Epoch ms. Stripe reports seconds; the webhook converts before storing. */
  currentPeriodEnd: number;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  priceId?: string | null;
}

const ENTITLED_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing']);

/**
 * Whether an entitlement grants Pro right now. Must stay behaviourally
 * identical to functions/entitlement.js's copy — see that file for why
 * `past_due` still counts inside the paid period.
 */
export function isProActive(entitlement: Entitlement | null | undefined, now = Date.now()): boolean {
  if (!entitlement || typeof entitlement !== 'object') return false;
  const {status, currentPeriodEnd} = entitlement;
  if (typeof currentPeriodEnd !== 'number' || !(currentPeriodEnd > now)) return false;
  return ENTITLED_STATUSES.has(status) || status === 'past_due';
}

/**
 * Subscribes to this user's entitlement. Reports null when there is no
 * subscription, which is the normal state for most accounts — so callers
 * should treat null as "free tier", never as an error.
 */
export function listenEntitlement(
  uid: string,
  callback: (entitlement: Entitlement | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'entitlements', uid),
    snapshot => callback(snapshot.exists() ? (snapshot.data() as Entitlement) : null),
    error => {
      // Never hard-fail the app over a billing read; degrade to free tier.
      console.warn('entitlement listen failed:', error);
      callback(null);
    },
  );
}
