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
 * "error: Failed to parse firebase.json". The root file holds the Hosting
 * headers, whose Content-Security-Policy values are full of apostrophes —
 * `default-src 'none'`, `script-src 'self'` — because CSP requires them.
 *
 * So ios/firebase.json exists to be found first. This checks that it still is,
 * and that it stays free of the one character that breaks the script.
 *
 * Worth having as a unit test rather than only as an iOS CI job: it costs
 * nothing and runs on every push, while an xcodebuild needs a macOS runner.
 * The real break lasted a week — from the commit that added the headers
 * through a full pre-release audit — because nothing built iOS at all.
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

  it('shadows a root file that genuinely could not be read', () => {
    // The other half of the reason this exists. If the root file ever became
    // apostrophe-free, the shadow would be unnecessary — and this failing is
    // how you would find out, rather than carrying the file forever.
    const root = readFileSync(ROOT_JSON, 'utf8');
    expect(survivesSingleQuoteInterpolation(root)).toBe(false);
    // And say why, so the failure above is self-explaining.
    expect(root).toContain("default-src 'none'");
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
