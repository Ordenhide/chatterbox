/**
 * The project's domain is chatterbox.fans, and chatterbox[.]app is not ours.
 *
 * chatterbox[.]app was written into the code for weeks as though it were the
 * project's own. It never was: it redirects to
 * forsale.godaddy.com/forsale/chatterbox[.]app, listed for sale on Afternic.
 * By the time that was noticed (2026-09-24), unreleased v1.2 sent users there
 * from three places that act on what they are told:
 *
 *  - the in-app update check polled chatterbox[.]app/downloads/version.json and
 *    offered an "Open chatterbox[.]app" button, in 52 languages — so whoever
 *    bought the domain could announce an "update" and serve their own APK;
 *  - the privacy policy told readers to write to privacy@chatterbox[.]app;
 *  - the Wikipedia User-Agent, which Wikimedia's policy requires to carry a
 *    working contact, named that address too.
 *
 * Released v1.0.0 and v1.1.0 have no update check (it arrived 2026-09-20);
 * they carry only the policy's contact address, which cannot be recalled.
 *
 * The old domain is written `chatterbox[.]app` wherever it has to be named —
 * here and in DEPLOYING.md — the "defanged" form security writing uses for a
 * host nobody should follow. That keeps the scan below total, with no file
 * exempt from it.
 *
 * This fails on any reference to the old domain, anywhere in the repository,
 * and on any chatterbox.<tld> address that is not chatterbox.fans, so the next
 * domain that is merely *assumed* to be ours has to get past a test first.
 */
import {execFileSync} from 'child_process';
import {readFileSync} from 'fs';
import {join} from 'path';

const ROOT = join(__dirname, '..', '..');
const DOMAIN = 'chatterbox.fans';

/** Every tracked text file, except the macOS project, where `chatterbox[.]app` is the bundle's file name. */
const files: Array<[string, string]> = execFileSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8'})
  .split('\n')
  .filter(f => f && !f.startsWith('macos-app/') && !/\.(png|jpe?g|ico|ttf|otf|keystore|jar|webp|gif)$/.test(f))
  .flatMap(f => {
    try {
      return [[f, readFileSync(join(ROOT, f), 'utf8')] as [string, string]];
    } catch {
      return [];
    }
  });

/** `chatterbox[.]app` as a host or address — not the Android package `com.chatterbox.app`. */
const OLD = /(?<![A-Za-z0-9_])chatterbox\.app(?![A-Za-z0-9_])/g;
const isPackageName = (text: string, index: number) => text.slice(Math.max(0, index - 4), index) === 'com.';

describe('the domain the project actually owns', () => {
  it('scans the repository and finds the new domain where users are sent', () => {
    // Pinned first: the cases below assert absence, and a scan that read
    // nothing would pass them. These are the places that *act* on the domain.
    expect(files.length).toBeGreaterThan(500);
    const at = (f: string) => files.find(([name]) => name === f)?.[1] ?? '';
    expect(at('src/services/updateCheck.ts')).toContain(`'https://${DOMAIN}/downloads/version.json'`);
    expect(at('src/screens/ProfileScreen.tsx')).toContain(`https://${DOMAIN}/#download`);
    expect(at('src/i18n/privacyPolicy.ts')).toContain(`POLICY_CONTACT_EMAIL = 'privacy@${DOMAIN}'`);
    expect(at('src/services/wikipediaSummary.ts')).toContain(`(https://${DOMAIN}; privacy@${DOMAIN})`);
    expect(at('web/src/services/wikipediaSummary.ts')).toContain(`(https://${DOMAIN}; privacy@${DOMAIN})`);
    expect(at('scripts/build-site-html.mjs')).toContain(`'https://dl.${DOMAIN}/chatterbox-latest.apk'`);
  });

  it('never refers to chatterbox[.]app, which is for sale and not ours', () => {
    const found: string[] = [];
    for (const [f, text] of files) {
      for (const m of text.matchAll(OLD)) {
        if (isPackageName(text, m.index!)) continue;
        found.push(`${f}:${text.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('uses no other chatterbox.<tld> as a host or an address', () => {
    // A URL host (//…chatterbox.x, or a subdomain of it) or an email domain.
    // chatterbox-eyz.pages.dev does not match: it is Cloudflare's, and named.
    const HOST = /(?:\/\/|@|\b[a-z0-9-]+\.)chatterbox\.([a-z]{2,})\b/g;
    const found: string[] = [];
    for (const [f, text] of files) {
      for (const m of text.matchAll(HOST)) {
        if (m[1] === 'fans') continue;
        // The login handle's domain, anon.chatterbox.invalid. RFC 2606 reserves
        // .invalid so no one can ever register it, and it is load-bearing in
        // the other direction: it is part of what every recovery phrase
        // derives, so changing it would point every existing phrase at an
        // account that does not exist. See anonymousIdentity.ts.
        if (m[1] === 'invalid') continue;
        if (m[0].startsWith('com.')) continue; // the Android package, com.chatterbox.app
        found.push(`${f}: ${m[0]}`);
      }
    }
    expect(found).toEqual([]);
  });
});
