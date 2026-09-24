/**
 * The web client survives a release.
 *
 * `website/app/` is the built web client. It is gitignored and produced by
 * web/'s `build:site`, so a CI checkout does not contain it. A Cloudflare
 * Pages deploy replaces the site's whole file set rather than merging into it,
 * and `website/index.html` links to `/app/` — so a release that deploys the
 * site without building the web client first publishes a site whose own
 * "open the web app" link is a 404.
 *
 * That was the state of release-apk.yml from the day the Hosting deploy was
 * added (2026-09-20, to self-distribute the APK) and it could not have been
 * noticed: the deploy only runs on a `v*` tag, and none had been pushed
 * since. The first release would have been its first execution.
 *
 * The second half of this file is the same defect one level down. Serving the
 * app from `/app/` instead of `/` is something vite handles for asset URLs
 * inside index.html and cannot handle anywhere else — a runtime string in TS,
 * or a file copied verbatim out of `public/`. Every one of those assumed the
 * origin root, so in the only build that ships: the app-shell worker did not
 * register, an installed PWA started on the landing page, and the workers'
 * notification icons and click targets pointed at the marketing site.
 *
 * The FCM registration is in the same state but was never an outage: its
 * VAPID key is unset, so the branch holding it is statically false and the
 * built bundle contains no reference to that worker. It is pinned here
 * because the path would have failed on the day the key was configured.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

/**
 * YAML comments removed, so an assertion about what a workflow *does* is not
 * satisfied — or broken — by prose about it. The same trick, and the same
 * reason, as codeOnly in src/screens/chat/__tests__/timestampToggle.test.ts:
 * the "no Firebase Hosting left" case below failed on a comment that names
 * FIREBASE_SERVICE_ACCOUNT to say which workflows still use it.
 *
 * Only whole-line comments are stripped. A `#` inside a quoted value is not a
 * comment, and no step here has a trailing one.
 */
const withoutComments = (yaml: string): string =>
  yaml
    .split('\n')
    .filter(line => !/^\s*#/.test(line))
    .join('\n');

describe('the release deploys a web client that works where it is served', () => {
  const workflow = read('.github', 'workflows', 'release-apk.yml');

  /**
   * Steps in order, as raw text blocks.
   *
   * Matched on what each step *runs* rather than on its `name`, so renaming a
   * step cannot quietly empty this out — and the pin below fails loudly if
   * the split stops working at all.
   */
  const steps = workflow.split(/\n      - (?=name:|uses:)/);

  it('finds the steps it is checking, and splits every one of them', () => {
    // Without this, a workflow reorganised past the splitter would leave
    // every assertion below searching an empty list and passing.
    expect(steps.length).toBeGreaterThanOrEqual(8);
    expect(steps.some(s => s.includes('assembleRelease'))).toBe(true);
    expect(steps.some(s => s.includes('pages deploy .'))).toBe(true);
    expect(steps.some(s => s.includes('r2 object put'))).toBe(true);

    // The split above is deliberately strict about indentation, so count the
    // steps a second time with a lenient pattern and require the two to
    // agree. Written after a mutation escaped: re-indenting one step to
    // `-  name:` is still valid YAML, and the strict splitter silently
    // merged it into its predecessor while every assertion here stayed
    // green. A splitter that under-splits has to fail, not shrug.
    const lenient = workflow.match(/^\s+-\s+(?:name|uses):/gm) ?? [];
    expect(steps.length).toBe(lenient.length + 1);
  });

  it('builds the web client before deploying the site', () => {
    const build = steps.findIndex(s => s.includes('npm run build:site'));
    const deploy = steps.findIndex(s => s.includes('pages deploy .'));
    expect(build).toBeGreaterThanOrEqual(0);
    expect(deploy).toBeGreaterThanOrEqual(0);
    expect(build).toBeLessThan(deploy);
  });

  it('uploads the APK before the site that advertises it goes live', () => {
    // The download button is published by the Pages deploy. If the object
    // lands after it, there is a window in which the site offers a file that
    // does not exist, and if the upload fails there is no window — the site is
    // simply wrong until the next tag.
    const upload = steps.findIndex(s => s.includes('r2 object put'));
    const deploy = steps.findIndex(s => s.includes('pages deploy .'));
    expect(upload).toBeGreaterThanOrEqual(0);
    expect(upload).toBeLessThan(deploy);
  });

  it('deploys the site from inside website/, away from the Firebase functions', () => {
    // Pages bundles a `functions/` directory in the working directory as edge
    // functions, and the repository root has one — the Firebase Cloud
    // Functions. Deployed from the root, wrangler tried to compile them and
    // failed with 50 errors on the first preview deploy (2026-09-24). No flag
    // moves it; the working directory is the only lever.
    const deploy = steps.find(s => s.includes('pages deploy .'))!;
    expect(deploy).toMatch(/working-directory:\s*website\b/);
    const fs = require('fs');
    expect(fs.existsSync(join(ROOT, 'functions'))).toBe(true); // the reason
    expect(fs.existsSync(join(ROOT, 'website', 'functions'))).toBe(false);
  });

  it('writes the APK to the real bucket, not a simulated one', () => {
    // Cloudflare's reference documents --local and --remote without saying
    // which is the default. Without --remote this may write inside the runner,
    // which is then destroyed: the run stays green and the release ships a
    // download link to nothing.
    const upload = steps.find(s => s.includes('r2 object put'));
    expect(upload).toContain('--remote');
    // Served as anything else, Android's installer will not open the file.
    expect(upload).toContain('application/vnd.android.package-archive');
  });

  it('keeps the APK out of the Pages deploy, which caps an asset at 25 MiB', () => {
    // The release used to `cp` the APK into website/downloads/. On Pages that
    // is not a slow deploy, it is a failed one — and the failure would arrive
    // on the first tag, with the signed APK already built.
    expect(workflow).not.toMatch(/cp .*app-release\.apk website/);
    const checksum = steps.find(s => s.includes('version.json'));
    expect(checksum).toBeDefined();
    expect(checksum).not.toContain('website/downloads/chatterbox-latest.apk');
  });

  it('keeps the web build and the APK upload on the same tag gate as the deploy', () => {
    // workflow_dispatch exists to prove the signed APK still builds without
    // touching the live website. A build step that ran unconditionally would
    // not break that, but one that published would.
    for (const needle of ['npm run build:site', 'r2 object put', 'pages deploy .']) {
      const step = steps.find(s => s.includes(needle));
      expect([needle, step?.includes('refs/tags/v')]).toEqual([needle, true]);
    }
  });

  it('points the download button and the update manifest at the same place', () => {
    // Two constants in two files, and nothing else compares them: APK_URL
    // generates the button on 53 pages, APK_PUBLIC_URL is written into
    // version.json by the same run that uploads the object.
    const generator = read('scripts', 'build-site-html.mjs');
    const apkUrl = generator.match(/export const APK_URL = '([^']*)';/);
    const publicUrl = workflow.match(/APK_PUBLIC_URL: (\S+)/);
    expect(apkUrl).not.toBeNull();
    expect(publicUrl).not.toBeNull();
    expect(apkUrl![1]).toBe(publicUrl![1]);
    // And it has to be absolute: a relative path would resolve against the
    // Pages origin, where the file deliberately is not.
    expect(apkUrl![1]).toMatch(/^https:\/\//);
  });

  it('has no Firebase Hosting left to deploy to', () => {
    // The site moved to Cloudflare on 2026-09-24. A leftover hosting block in
    // firebase.json is not inert: it is a second, stale definition of the
    // security headers, and the last time this project had headers in a file
    // its host did not read, they shipped nowhere for months while looking
    // exactly like a control.
    const code = withoutComments(workflow);
    expect(code).not.toContain('deploy --only hosting');
    expect(code).not.toContain('FIREBASE_SERVICE_ACCOUNT');
    expect(code).not.toContain('google-github-actions/auth');
    // The stripper has to have done something, or the three above pass for
    // the wrong reason on a file whose comments were never the problem.
    expect(code.length).toBeLessThan(workflow.length);
    expect(workflow).toContain('FIREBASE_SERVICE_ACCOUNT');
    expect(Object.keys(JSON.parse(read('firebase.json')))).not.toContain('hosting');
  });

  it('exercises that same build in CI, so a release is not its first run', () => {
    const ci = read('.github', 'workflows', 'ci.yml');
    expect(ci).toContain('npm run build:site');
  });
});

describe('the web client does not assume it is served from the origin root', () => {
  it('registers both service workers relative to the base URL', () => {
    const pwa = read('web', 'src', 'pwa.ts');
    const push = read('web', 'src', 'services', 'push.ts');
    // The scripts are deployed beside the app, at /app/, so a leading slash
    // points at the marketing site and 404s.
    expect(pwa).not.toMatch(/register\(\s*['"]\/sw\.js['"]/);
    expect(push).not.toMatch(/register\(\s*['"]\/firebase-messaging-sw\.js['"]/);
    expect(pwa).toContain('BASE_URL');
    expect(push).toContain('BASE_URL');
  });

  it('keeps the FCM registration scope under the base URL', () => {
    // A worker at /app/ cannot claim a scope above its own directory without
    // a Service-Worker-Allowed header, which Hosting does not send here.
    const push = read('web', 'src', 'services', 'push.ts');
    expect(push).not.toContain("scope: '/firebase-cloud-messaging-push-scope'");
    expect(push).toMatch(/scope: `\$\{base\}firebase-cloud-messaging-push-scope`/);
  });

  it('resolves the service workers\' own asset paths against their location', () => {
    // These are copied verbatim out of public/; no build step substitutes a
    // base path, so they derive it from self.location instead.
    for (const file of ['sw.js', 'firebase-messaging-sw.js']) {
      const text = read('web', 'public', file);
      expect(text).toContain("new URL('./', self.location).pathname");
      expect(text).not.toMatch(/icon:\s*['"]\/icon\.svg['"]/);
      expect(text).not.toMatch(/badge:\s*['"]\/icon\.svg['"]/);
    }
    expect(read('web', 'public', 'sw.js')).not.toContain("const SHELL = '/index.html'");
  });

  it('points notification icons at the app, not the origin root', () => {
    // The only one of these on a path that runs today: showLocalNotification
    // is what useReminders and useChatNotifications call, so this icon 404'd
    // on every notification the deployed app has ever shown.
    const push = read('web', 'src', 'services', 'push.ts');
    expect(push).not.toMatch(/icon:\s*['"]\/icon\.svg['"]/);
    expect(push).toContain('BASE_URL}icon.svg');
  });

  it('starts an installed PWA in the app, not on the landing page', () => {
    // start_url and scope resolve against the manifest's own URL. Absolute
    // "/" sent an installed app to the marketing site; "./" is /app/ in the
    // site build and / under `vite dev`, which is correct in both.
    const manifest = JSON.parse(read('web', 'public', 'manifest.webmanifest'));
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });

  it('describes the app without the features it no longer has', () => {
    // Moments was removed from both clients on 2026-09-05. These two strings
    // are the app's own description in a browser tab and in an installed
    // app's listing, and neither is generated from scripts/site-copy, so
    // nothing else would have caught them.
    const manifest = read('web', 'public', 'manifest.webmanifest');
    const html = read('web', 'index.html');
    expect(manifest).not.toMatch(/moments/i);
    expect(html).not.toMatch(/content="[^"]*moments/i);
  });
});

/**
 * The headers the site actually serves, now that Cloudflare decides them.
 *
 * These have lived in three files. They began in `web/public/_headers` — this
 * syntax — while the site was on Firebase Hosting, which does not read it, so
 * they shipped nowhere for months while reading in review exactly like a
 * control. They were ported into `firebase.json`, and are ported back here
 * because the site moved to Pages on 2026-09-24.
 *
 * The move is not a copy, and that is what these cases are for. Firebase
 * merged two matching rules by *overriding* a repeated header; Cloudflare
 * joins them with a comma. Permissions-Policy takes the first occurrence of a
 * repeated directive, so a catch-all `microphone=()` beside the app's
 * `microphone=(self)` does not widen to the app — it denies the microphone and
 * camera to the whole web client. No calls, no voice messages, and no error
 * the app could show, because the browser refuses before any of its code runs.
 */
describe('the site headers survived the move to Cloudflare', () => {
  const HEADERS = read('website', '_headers');

  /** `/pattern` at column 0, its headers indented under it. */
  const rules: Array<{pattern: string; headers: Record<string, string>}> = [];
  for (const line of HEADERS.split('\n')) {
    if (/^#/.test(line) || !line.trim()) continue;
    if (/^\//.test(line)) {
      rules.push({pattern: line.trim(), headers: {}});
      continue;
    }
    const m = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
    if (m && rules.length) rules[rules.length - 1].headers[m[1]] = m[2];
  }

  const setters = (header: string) => rules.filter(r => header in r.headers);

  it('parses the rules it is about to check', () => {
    // Without this, a syntax change that the parser stops recognising leaves
    // every case below asserting over an empty list — and most of them assert
    // that something is *not* there.
    expect(rules.length).toBeGreaterThanOrEqual(7);
    expect(rules.map(r => r.pattern)).toEqual(
      expect.arrayContaining(['/*', '/', '/index*', '/privacy*', '/app', '/app/*', '/app/assets/*']),
    );
    expect(rules.every(r => Object.keys(r.headers).length > 0)).toBe(true);
  });

  it('carries every header the Firebase config used to set', () => {
    // Recorded rather than read from firebase.json, whose hosting block is
    // deleted in the same commit. A port that quietly dropped one of these
    // would otherwise look like a clean move.
    const ported = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Content-Security-Policy',
      'Content-Security-Policy-Report-Only',
      'Cache-Control',
    ];
    for (const header of ported) {
      expect([header, setters(header).length > 0]).toEqual([header, true]);
    }
  });

  it('never sets a header on the catch-all that another rule also sets', () => {
    // This is the whole invariant. Cloudflare joins duplicates with a comma
    // instead of overriding, so anything on `/*` can never be narrowed or
    // widened further down — it can only be appended to.
    const catchAll = rules.filter(r => r.pattern === '/*');
    expect(catchAll).toHaveLength(1);
    for (const header of Object.keys(catchAll[0].headers)) {
      const others = setters(header).filter(r => r.pattern !== '/*');
      expect([header, others.map(r => r.pattern)]).toEqual([header, []]);
    }
  });

  it('lets the web client use the microphone and camera', () => {
    // The app needs both for calls and voice messages. Asserted on every rule
    // that can match a path under /app, so a new one denying them fails here
    // rather than in a call that will not connect.
    const appRules = rules.filter(r => r.pattern.startsWith('/app'));
    const withPolicy = appRules.filter(r => 'Permissions-Policy' in r.headers);
    expect(withPolicy.length).toBeGreaterThanOrEqual(2);
    for (const r of withPolicy) {
      expect([r.pattern, r.headers['Permissions-Policy']]).toEqual([
        r.pattern,
        expect.stringContaining('microphone=(self)'),
      ]);
      expect(r.headers['Permissions-Policy']).toContain('camera=(self)');
      // Live location is sent from the mobile app; nothing on the web asks.
      expect(r.headers['Permissions-Policy']).toContain('geolocation=()');
    }
  });

  it('denies the microphone and camera on the marketing pages', () => {
    // The inverse, and the reason the catch-all cannot carry this header: the
    // generated pages load nothing and ask for nothing.
    for (const pattern of ['/', '/index*', '/privacy*']) {
      const r = rules.find(x => x.pattern === pattern)!;
      expect([pattern, r.headers['Permissions-Policy']]).toEqual([
        pattern,
        expect.stringContaining('microphone=()'),
      ]);
      expect(r.headers['Permissions-Policy']).toContain('camera=()');
    }
  });

  it('enforces the marketing CSP and only reports the app one', () => {
    // The app's policy has never been exercised against the running client,
    // and an enforced policy wrong in one directive takes the whole thing
    // down rather than degrading. The marketing pages are generated and load
    // nothing, so theirs can be enforced.
    for (const pattern of ['/', '/index*', '/privacy*']) {
      const r = rules.find(x => x.pattern === pattern)!;
      expect([pattern, r.headers['Content-Security-Policy']]).toEqual([
        pattern,
        expect.stringContaining("default-src 'none'"),
      ]);
    }
    for (const r of rules.filter(x => x.pattern.startsWith('/app'))) {
      expect([r.pattern, 'Content-Security-Policy' in r.headers]).toEqual([r.pattern, false]);
    }
    expect(setters('Content-Security-Policy-Report-Only').length).toBeGreaterThanOrEqual(2);
  });

  it('has no rewrite that can answer the app\'s own files with its shell', () => {
    // Firebase had `rewrites: /app/** → /app/index.html`, harmlessly, because
    // Firebase applies a rewrite only when no file matches. Pages applies
    // _redirects *before* static assets. Ported as `/app/* /app/ 200`, it
    // answered the 2.1 MB JavaScript bundle with the 2.9 KB HTML shell on the
    // first preview deploy (2026-09-24) — the web client would have loaded
    // blank. Cloudflare's docs say real files win; on this project they did not.
    const fs = require('fs');
    const file = join(ROOT, 'website', '_redirects');
    const rules = fs.existsSync(file)
      ? (fs.readFileSync(file, 'utf8') as string)
          .split('\n')
          .filter(l => l.trim() && !/^\s*#/.test(l))
      : [];
    const shadowing = rules.filter(l => /^\s*\/(app|\*)/.test(l));
    expect(shadowing).toEqual([]);
  });

  it('needs no fallback, because neither client puts a route in the path', () => {
    // The reason the rule above can simply be absent. If either of these ever
    // changes — a path router on the web, an https invite link — deep links
    // under /app/ become real and need a fallback that does not shadow assets.
    const hashRoute = read('web', 'src', 'hooks', 'useHashRoute.ts');
    const built = [...hashRoute.matchAll(/return `([^`]*)`/g)].map(m => m[1]);
    expect(built.length).toBeGreaterThanOrEqual(2);
    for (const b of built) expect([b, b.startsWith('#/')]).toEqual([b, true]);
    expect(hashRoute).not.toMatch(/pushState\(/);
    for (const f of [['src', 'services', 'invites.ts'], ['web', 'src', 'services', 'invites.ts']]) {
      expect(read(...f)).toContain("INVITE_SCHEME = 'chatterbox://invite'");
    }
  });

  it('keeps Pages out of single-page-app mode with a top-level 404 page', () => {
    // Without website/404.html, Pages answers every unmatched path with
    // /index.html and a 200: typos rendered the landing page, and a missing
    // /downloads/version.json came back as 200 text/html — the same shape as
    // the registrar's parking page.
    const page = read('website', '404.html');
    // Served *at the address that was not found*, so a relative asset URL
    // would resolve under /a/b/ and the page would render unstyled.
    expect(page).toContain('href="/styles.css"');
    expect(page).not.toMatch(/(href|src)="(?!\/|#|https?:)[^"]+"/);
  });
});

describe('the worker the first deploy left at the root', () => {
  // That deploy served the web client at `/` and registered /sw.js with scope
  // `/`. Its successor serves the landing page there, so a browser's periodic
  // recheck of /sw.js would find a 404 — which fails the update and leaves
  // the old worker running forever. website/sw.js is what it finds instead.
  const worker = read('website', 'sw.js');
  const code = worker.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('unregisters itself once it has cleaned up', () => {
    expect(code).toMatch(/self\.registration\.unregister\(\)/);
    expect(code).toMatch(/skipWaiting\(\)/);
  });

  it('intercepts nothing while it is alive', () => {
    // A fetch handler here would put a worker between every visitor and the
    // landing page, which is the thing this file exists to remove.
    expect(code).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(code).not.toMatch(/respondWith/);
  });

  it('leaves the web client\'s cache entries alone', () => {
    // Same cache name as web/public/sw.js, which is deployed at /app/sw.js.
    // Deleting the whole cache would throw away the client's current shell.
    expect(read('web', 'public', 'sw.js')).toContain("const CACHE = 'chatterbox-v1'");
    expect(code).toContain("caches.open('chatterbox-v1')");
    expect(code).toMatch(/startsWith\('\/app\/'\)/);
    expect(code).not.toMatch(/caches\.delete\(/);
  });
});
