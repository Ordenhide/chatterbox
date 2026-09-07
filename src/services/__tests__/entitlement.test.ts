// snapshotGuard (pulled in by the module under test) reports errors,
// which loads RNFB's native modules — unavailable under Jest. Mocked here the
// same way account/e2eeKeys/firebaseChat tests already do.
jest.mock('../errorLog', () => ({reportError: jest.fn()}));

jest.mock('../firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...segments: string[]) => ({path: segments.join('/')}),
  onSnapshot: jest.fn(),
}));

import {isProActive} from '../entitlement';

const NOW = 1_700_000_000_000;
const FUTURE = NOW + 86_400_000;
const PAST = NOW - 86_400_000;

// Mirrors functions/__tests__/entitlement.test.js. Both copies of this logic
// must agree: the client's drives the UI lock, the server's is the actual
// paywall, and a divergence would either lock out paying users or show
// non-payers an unlocked button that then errors.
describe('isProActive', () => {
  it('grants Pro for an active subscription inside its paid period', () => {
    expect(isProActive({status: 'active', currentPeriodEnd: FUTURE}, NOW)).toBe(true);
  });

  it('grants Pro during a trial', () => {
    expect(isProActive({status: 'trialing', currentPeriodEnd: FUTURE}, NOW)).toBe(true);
  });

  it('keeps Pro while past_due but still inside the paid period (card-retry grace)', () => {
    expect(isProActive({status: 'past_due', currentPeriodEnd: FUTURE}, NOW)).toBe(true);
  });

  it('revokes past_due once the paid period has actually ended', () => {
    expect(isProActive({status: 'past_due', currentPeriodEnd: PAST}, NOW)).toBe(false);
  });

  it('revokes an active subscription whose period has elapsed', () => {
    expect(isProActive({status: 'active', currentPeriodEnd: PAST}, NOW)).toBe(false);
  });

  it('denies canceled, unpaid, and incomplete regardless of period end', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired'] as const) {
      expect(isProActive({status, currentPeriodEnd: FUTURE}, NOW)).toBe(false);
    }
  });

  it('denies when there is no entitlement at all — the default for every new user', () => {
    expect(isProActive(null, NOW)).toBe(false);
    expect(isProActive(undefined, NOW)).toBe(false);
  });

  it('denies malformed documents rather than throwing', () => {
    expect(isProActive({status: 'active'} as never, NOW)).toBe(false);
    expect(isProActive({status: 'active', currentPeriodEnd: 'forever'} as never, NOW)).toBe(false);
  });

  it('treats the exact expiry instant as expired, not entitled', () => {
    expect(isProActive({status: 'active', currentPeriodEnd: NOW}, NOW)).toBe(false);
    expect(isProActive({status: 'active', currentPeriodEnd: NOW + 1}, NOW)).toBe(true);
  });
});
