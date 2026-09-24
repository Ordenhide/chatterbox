/**
 * The iOS build reads a `firebase.json`, and it cannot read the root one.
 *
 * `@react-native-firebase/app` runs ios_config.sh as a build phase. It walks up
 * from $PROJECT_DIR for the first `firebase.json` and then does this:
 *
 *   ruby -Ku -e "require 'json'; output=JSON.parse('$_JSON_OUTPUT_RAW'); ..."
 *
 * The whole file is interpolated into a single-quoted Ruby string, so one
 * apostrophe anywhere in it ends the literal and the build stops with
 * "error: Failed to parse firebase.json". The root file used to hold the
 * Hosting headers, whose Content-Security-Policy values are full of
 * apostrophes — `default-src 'none'`, `script-src 'self'` — because CSP
 * requires them. The real break lasted a week, from the commit that added
 * those headers through a full pre-release audit, because nothing built iOS
 * at all.
 *
 * **That hazard is gone as of 2026-09-24**, when the site moved to Cloudflare
 * and the Hosting block left the root file with it. The apostrophes went with
 * the CSP, and the case below that asserted the root file "genuinely could not
 * be read" started failing — which is what its own comment said it was for.
 *
 * ios/firebase.json stays, because the apostrophe hazard was never its only
 * job: it declares `react-native` settings the root file does not have, and
 * those settings are the reason it exists now. The hazard is latent rather
 * than absent, so the guard below became the inverse — it fails if the root
 * file regains an apostrophe, which is the moment this file goes back to being
 * the only thing standing between iOS and a build that cannot parse its
 * config.
 *
 * Worth having as a unit test rather than only as an iOS CI job: it costs
 * nothing and runs on every push, while an xcodebuild needs a macOS runner.
 */
import {existsSync, readFileSync} from 'fs';
import {join} from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const IOS_JSON = join(ROOT, 'ios', 'firebase.json');
const ROOT_JSON = join(ROOT, 'firebase.json');

/** What ios_config.sh's ruby step can survive. */
function survivesSingleQuoteInterpolation(text: string): boolean {
  return !text.includes("'");
}

describe('the firebase.json the iOS build will read', () => {
  it('exists, so the search stops before the root file', () => {
    // Pinned first: without this file the assertions below would be about
    // nothing, and the root file — which cannot be read — would be found.
    expect(existsSync(IOS_JSON)).toBe(true);
  });

  it('is valid JSON', () => {
    expect(() => JSON.parse(readFileSync(IOS_JSON, 'utf8'))).not.toThrow();
  });

  it('contains no apostrophe, which is what the build script cannot survive', () => {
    expect(survivesSingleQuoteInterpolation(readFileSync(IOS_JSON, 'utf8'))).toBe(true);
  });

  it('declares settings the root file does not, which is why it still exists', () => {
    // Its standing reason, now that the apostrophe hazard has gone. Deleting
    // this file would let the search reach the root one, which carries no
    // `react-native` block at all — so FCM auto-init and App Check token
    // refresh would silently fall back to the SDK defaults on iOS.
    const mine = JSON.parse(readFileSync(IOS_JSON, 'utf8'))['react-native'];
    expect(Object.keys(mine ?? {}).length).toBeGreaterThan(0);
    expect(JSON.parse(readFileSync(ROOT_JSON, 'utf8'))['react-native']).toBeUndefined();
  });

  it('is what the root file would need if an apostrophe ever came back', () => {
    // The hazard is latent, not absent. While the root file is apostrophe-free
    // the search reaching it would merely be harmless; the moment a CSP, a
    // contraction in a comment, or any quoted value lands there, this file is
    // the only thing keeping the iOS build parsing its config — so that
    // change has to arrive with its own decision, not silently.
    //
    // Asserted as a state rather than a rule, so it reads as "this is how it
    // is today" and fails loudly on the day it stops being true.
    const root = readFileSync(ROOT_JSON, 'utf8');
    expect(survivesSingleQuoteInterpolation(root)).toBe(true);
    expect(root).not.toContain('hosting');
    // And the shadow is still first in the search, whatever the root holds.
    expect(existsSync(IOS_JSON)).toBe(true);
  });

  it('declares only settings whose SDK is actually linked', () => {
    // Keys that disable a library nobody compiled read as a protection and
    // enforce nothing. FirebaseAnalytics, Crashlytics, Performance and
    // InAppMessaging are absent from Podfile.lock; the policy says there is no
    // analytics, and that is true because they are not there, not because a
    // flag says so.
    const lock = readFileSync(join(ROOT, 'ios', 'Podfile.lock'), 'utf8');
    const config = JSON.parse(readFileSync(IOS_JSON, 'utf8'))['react-native'] ?? {};
    const forbidden = Object.keys(config).filter(k => /analytics|crashlytics|perf|in_app/.test(k));
    expect(forbidden).toEqual([]);
    for (const absent of ['FirebaseAnalytics', 'FirebaseCrashlytics', 'FirebasePerformance']) {
      expect(lock).not.toContain(`- ${absent} `);
    }
  });
});
