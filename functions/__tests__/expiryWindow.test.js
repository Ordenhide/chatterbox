/**
 * The disappearing-messages sweep must never reach backwards.
 *
 * Every case here is about the same failure: `processExpiredMessages` deleted
 * on age alone, so choosing "delete after 1 hour" in the settings sheet
 * deleted the conversation. The first test is the one that would have caught
 * it, and it is written as the user's experience rather than as a boundary
 * check because that is what was actually broken.
 */
const {expirySweepWindow} = require('../expiryWindow');

const HOUR = 3600000;
const NOW = 1_700_000_000_000;

describe('expirySweepWindow', () => {
  it('never reaches messages sent before the policy was enabled', () => {
    // Policy switched on a minute ago, with 1-hour expiry, on a chat with a
    // year of history. Two hours have to pass before anything is deletable,
    // and even then only messages from after the switch.
    const enabledAt = NOW - 60000;
    expect(expirySweepWindow({messageExpiry: 1, messageExpirySince: enabledAt}, NOW)).toBeNull();

    const later = enabledAt + 90 * 60000;
    const window = expirySweepWindow({messageExpiry: 1, messageExpirySince: enabledAt}, later);
    expect(window).not.toBeNull();
    expect(window.sinceMs).toBe(enabledAt);
    // A message from before the switch — any message — sits outside the window.
    expect(window.sinceMs).toBeGreaterThan(enabledAt - 1);
    expect(window.cutoffMs).toBe(later - HOUR);
    expect(window.cutoffMs).toBeGreaterThan(window.sinceMs);
  });

  it('returns a window once the policy has outlived its own timer', () => {
    const enabledAt = NOW - 25 * HOUR;
    expect(expirySweepWindow({messageExpiry: 24, messageExpirySince: enabledAt}, NOW)).toEqual({
      sinceMs: enabledAt,
      cutoffMs: NOW - 24 * HOUR,
    });
  });

  it('skips a chat with a policy but no activation time', () => {
    // The shape every chat configured by the old mobile client is in. Sweeping
    // it from the beginning of time is precisely the bug; not sweeping it is a
    // gap someone can report.
    expect(expirySweepWindow({messageExpiry: 1}, NOW)).toBeNull();
    expect(expirySweepWindow({messageExpiry: 1, messageExpirySince: 0}, NOW)).toBeNull();
    expect(expirySweepWindow({messageExpiry: 1, messageExpirySince: null}, NOW)).toBeNull();
    expect(expirySweepWindow({messageExpiry: 1, messageExpirySince: 'soon'}, NOW)).toBeNull();
    expect(expirySweepWindow({messageExpiry: 1, messageExpirySince: -1}, NOW)).toBeNull();
  });

  it('skips a chat with no policy, however its "off" is written', () => {
    expect(expirySweepWindow({}, NOW)).toBeNull();
    expect(expirySweepWindow({messageExpiry: 0, messageExpirySince: NOW - HOUR}, NOW)).toBeNull();
    expect(expirySweepWindow({messageExpiry: -1, messageExpirySince: NOW - HOUR}, NOW)).toBeNull();
    expect(expirySweepWindow({messageExpiry: 'daily', messageExpirySince: NOW - HOUR}, NOW)).toBeNull();
  });

  it('survives the inputs a scheduled job can actually be handed', () => {
    expect(expirySweepWindow(null, NOW)).toBeNull();
    expect(expirySweepWindow(undefined, NOW)).toBeNull();
    expect(expirySweepWindow({messageExpiry: 1, messageExpirySince: NOW - 2 * HOUR}, NaN)).toBeNull();
  });

  it('is exclusive at the cutoff and inclusive at the activation time', () => {
    // The caller turns these into `createdAt >= sinceMs` and
    // `createdAt < cutoffMs`. A message sent in the same millisecond the
    // policy was enabled is covered by it; one sent exactly at the cutoff is
    // not yet expired.
    const enabledAt = NOW - 10 * HOUR;
    const {sinceMs, cutoffMs} = expirySweepWindow(
      {messageExpiry: 1, messageExpirySince: enabledAt},
      NOW,
    );
    expect(sinceMs).toBe(enabledAt);
    expect(cutoffMs).toBe(NOW - HOUR);
  });
});

describe('the sweep in index.js uses this window', () => {
  // A pure helper nothing calls is a test that proves nothing about the job
  // that does the deleting. Asserted on source because loading index.js means
  // loading firebase-admin's whole initialisation for a question about code —
  // the same reasoning collectionGroupIndexes.test.js sets out.
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const sweep = source.slice(
    source.indexOf('exports.processExpiredMessages'),
    source.indexOf('exports.markViewOnceViewed'),
  );

  it('finds the sweep, so the assertions below are about something', () => {
    expect(sweep).toContain('processExpiredMessages');
    expect(sweep.length).toBeGreaterThan(200);
  });

  it('asks expirySweepWindow rather than computing a cutoff of its own', () => {
    expect(source).toContain("require('./expiryWindow')");
    expect(sweep).toContain('expirySweepWindow(');
  });

  it('bounds the delete query below as well as above', () => {
    // The lower bound is the whole fix. Without it the query returns the
    // entire history regardless of what the window said.
    expect(sweep).toContain("'createdAt', '>='");
    expect(sweep).toContain("'createdAt', '<'");
  });
});
