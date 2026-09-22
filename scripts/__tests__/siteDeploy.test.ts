/**
 * The web client survives a release.
 *
 * `website/app/` is the built web client. It is gitignored and produced by
 * web/'s `build:site`, so a CI checkout does not contain it. A Firebase
 * Hosting deploy replaces the site's whole file set rather than merging into
 * it, and `website/index.html` links to `/app/` — so a release that deploys
 * Hosting without building the web client first publishes a site whose own
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
    expect(steps.some(s => s.includes('deploy --only hosting'))).toBe(true);

    // The split above is deliberately strict about indentation, so count the
    // steps a second time with a lenient pattern and require the two to
    // agree. Written after a mutation escaped: re-indenting one step to
    // `-  name:` is still valid YAML, and the strict splitter silently
    // merged it into its predecessor while every assertion here stayed
    // green. A splitter that under-splits has to fail, not shrug.
    const lenient = workflow.match(/^\s+-\s+(?:name|uses):/gm) ?? [];
    expect(steps.length).toBe(lenient.length + 1);
  });

  it('builds the web client before deploying Hosting', () => {
    const build = steps.findIndex(s => s.includes('npm run build:site'));
    const deploy = steps.findIndex(s => s.includes('deploy --only hosting'));
    expect(build).toBeGreaterThanOrEqual(0);
    expect(deploy).toBeGreaterThanOrEqual(0);
    expect(build).toBeLessThan(deploy);
  });

  it('keeps the web build on the same tag gate as the deploy', () => {
    // workflow_dispatch exists to prove the signed APK still builds without
    // touching the live website. A build step that ran unconditionally would
    // not break that, but one that deployed would.
    const build = steps.find(s => s.includes('npm run build:site'));
    const deploy = steps.find(s => s.includes('deploy --only hosting'));
    expect(build).toContain("refs/tags/v");
    expect(deploy).toContain("refs/tags/v");
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
