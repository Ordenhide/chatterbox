/**
 * Generates website/index.html and website/index.<code>.html from the copy in
 * scripts/site-copy/.
 *
 * The landing page used to be one hand-written English file. That was fine
 * while the app was English-only; it stopped being fine once the app shipped
 * fifteen languages and a privacy policy translated into all of them. A
 * Japanese reader could read the legal document in Japanese but had to work
 * out from English prose whether they wanted the app at all, which is the
 * wrong way round — the page that makes the claims should be readable by
 * whoever has to evaluate them.
 *
 * Copy lives in scripts/site-copy/<code>.mjs, one file per language, all the
 * same shape. Everything structural — layout, icons, the order of the
 * sections — lives here, so a translation cannot accidentally change the page.
 *
 * Run after editing any of it:  node scripts/build-site-html.mjs
 * `--check` verifies without writing; a test runs it, so a forgotten run
 * fails CI rather than shipping a page that disagrees with its own source.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {SITE_LANGUAGES, languageMeta} from './site-copy/languages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The two Android routes, each null until it actually exists.
 *
 * Null is not a placeholder to be filled in optimistically. The download card
 * has a shape for every combination, and the pages are generated from these
 * two constants, so the card cannot advertise a route that is not there. A
 * store button that 404s is worse than no store button on a page whose whole
 * argument is that it describes the app accurately — and the APK link sat
 * here pointing at a file nobody had built yet, in fifteen languages.
 *
 * PLAY_URL: the listing's URL once it is live. Note that Google's brand
 * guidelines want their own badge artwork rather than a text button; drop it
 * in website/assets/ and swap `playButton` below.
 *
 * APK_URL: where the signed build is actually served from. It used to be the
 * relative 'downloads/chatterbox-latest.apk', which was correct while the site
 * was on Firebase Hosting and the release copied the APK into website/. On
 * Cloudflare Pages it cannot be: a Pages asset is capped at 25 MiB and the APK
 * is ~122 MB, so a deploy carrying it fails outright. The APK lives in R2,
 * whose egress is free, and this is an absolute URL to it.
 *
 * It must equal APK_PUBLIC_URL in .github/workflows/release-apk.yml, which is
 * what the same run writes into version.json and what uploads the object.
 * siteDeploy.test.ts asserts they agree, because a disagreement means the
 * download button and the update manifest point at different places and only
 * one of them is real.
 *
 * Set by hand rather than by looking for the file, so that CI, a fresh clone
 * and the deploying machine all generate the same pages.
 *
 * The prerequisite is manual and outside this repository: the bucket and its
 * custom domain have to exist before a tag is pushed, or the same run that
 * publishes this page uploads the object to a bucket whose domain resolves
 * nowhere. See DEPLOYING.md.
 */
export const PLAY_URL = null;
export const APK_URL = 'https://dl.chatterbox.app/chatterbox-latest.apk';

const escape = s =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pageName = code => (code === 'en' ? 'index.html' : `index.${code}.html`);
const policyName = code => (code === 'en' ? 'privacy.html' : `privacy.${code}.html`);

/**
 * What a *link* points at, as opposed to what the file is called.
 *
 * Firebase Hosting runs with `cleanUrls: true`, which serves `index.ja.html`
 * at `/index.ja` and permanently redirects the `.html` form to it. Every
 * hreflang here pointed at the `.html` form, so all sixteen alternates on
 * every page were 301s to the URL that actually serves — which works, and is
 * not what you want a search engine to index or a canonical set to be built
 * from. The English page is the site root rather than `/index`.
 */
const pageHref = code => (code === 'en' ? './' : `index.${code}`);
const policyHref = code => (code === 'en' ? 'privacy' : `privacy.${code}`);

/**
 * Escapes a copy string, then substitutes the two link placeholders.
 *
 * Copy files are data, not templates: they are escaped first and the anchors
 * put in afterwards, so the only markup a translation can introduce is the
 * link it was given, pointing where this function decides.
 */
const text = (raw, copy, code) =>
  escape(raw)
    .replace(/\{policy\}/g, `<a href="${policyHref(code)}">${escape(copy.links.policy)}</a>`)
    .replace(
      /\{policyShort\}/g,
      `<a href="${policyHref(code)}">${escape(copy.links.policyShort)}</a>`,
    );

/* Icons are structure, not copy, so they live here and are the same on every
   page. Stroke-only, inheriting currentColor, to match the app's line work. */
const ICONS = {
  download: '<path d="M12 3v13M7 11l5 5 5-5M5 21h14" stroke-linecap="round" stroke-linejoin="round"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<path d="M4 3.5v17a1 1 0 0 0 1.5.87l14-8.5a1 1 0 0 0 0-1.74l-14-8.5A1 1 0 0 0 4 3.5z" stroke-linecap="round" stroke-linejoin="round"/>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-linecap="round" stroke-linejoin="round"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="M12 2l2.9 6.6L21 9.3l-5 4.6L17.4 21 12 17.3 6.6 21 8 13.9l-5-4.6 6.1-.7L12 2z" stroke-linecap="round" stroke-linejoin="round"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke-linecap="round" stroke-linejoin="round"/>',
  check:
    '<path d="M9 11l3 3L22 4" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke-linecap="round" stroke-linejoin="round"/>',
  burn: '<path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" stroke-linecap="round"/><path d="M12 2v10" stroke-linecap="round"/>',
  block: '<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14" stroke-linecap="round"/>',
  export: '<path d="M12 3v13M7 11l5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" stroke-linecap="round"/>',
};

const FEATURE_ICONS = ['chat', 'phone', 'star', 'book', 'lock', 'globe'];
const CONTROL_ICONS = ['lock', 'eye', 'clock', 'burn', 'block', 'export'];

const icon = name => `<svg class="icon" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

export function renderPage(code, copy, allCodes) {
  const meta = languageMeta(code);
  const t = raw => text(raw, copy, code);

  const alternates = allCodes
    .map(c => `  <link rel="alternate" hreflang="${languageMeta(c).lang}" href="${pageHref(c)}" />`)
    .concat('  <link rel="alternate" hreflang="x-default" href="./" />')
    .join('\n');

  const langMenu = allCodes
    .map(c =>
      c === code
        ? `        <span aria-current="true" lang="${languageMeta(c).lang}">${escape(languageMeta(c).native)}</span>`
        : `        <a href="${pageHref(c)}" lang="${languageMeta(c).lang}" hreflang="${languageMeta(c).lang}">${escape(languageMeta(c).native)}</a>`,
    )
    .join('\n');

  const reasons = copy.different.reasons
    .map(
      (r, i) => `        <li class="reason">
          <div class="reason-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</div>
          <div class="reason-body">
            <h3>${t(r.title)}</h3>
${r.body.map(p => `            <p>${t(p)}</p>`).join('\n')}${
        r.note ? `\n            <p class="reason-note">${t(r.note)}</p>` : ''
      }
          </div>
        </li>`,
    )
    .join('\n\n');

  const features = copy.features.cards
    .map(
      (c, i) => `        <div class="feature-card">
          <div class="feature-icon">${icon(FEATURE_ICONS[i])}</div>
          <h3>${t(c.title)}</h3>
          <p>${t(c.body)}</p>
        </div>`,
    )
    .join('\n');

  const controls = copy.controls.items
    .map(
      (c, i) => `        <div class="privacy-item">
          <div class="feature-icon">${icon(CONTROL_ICONS[i])}</div>
          <h4>${t(c.title)}</h4>
          <p>${t(c.body)}</p>
        </div>`,
    )
    .join('\n');

  const ledger = (col, cls) => `        <div class="ledger-col ${cls}">
          <h3>${t(col.title)}</h3>
          <ul>
${col.items.map(li => `            <li>${t(li)}</li>`).join('\n')}
          </ul>
        </div>`;

  // The card is assembled from what exists. See PLAY_URL / APK_URL above.
  const playButton = PLAY_URL
    ? `          <a class="btn btn-primary" href="${PLAY_URL}">
            ${icon('play')}
            ${t(copy.download.play)}
          </a>`
    : `          <span class="btn btn-pending" aria-disabled="true">
            ${icon('play')}
            ${t(copy.download.playPending)}
          </span>`;
  const apkButton = APK_URL
    ? `
          <a class="btn btn-secondary" href="${APK_URL}">
            ${icon('download')}
            ${t(copy.download.apk)}
          </a>`
    : '';
  // Which Android sentence is true depends on which routes exist: the store,
  // the file on this site, or neither of them yet.
  //
  // The intro paragraph further down is on the same footing and was not: it
  // picked `intro` whenever APK_URL was set, and `intro`'s middle clause is a
  // claim about PLAY_URL — "On Android, Google Play keeps it updated". With an
  // APK published and no listing, which is the state this project has been in
  // since the APK route existed, the page said Play keeps the app updated two
  // sentences above `playPendingNote` saying the listing is not live. In all
  // fifty-two languages, on the page whose whole argument is that it describes
  // the app accurately.
  //
  // It now shares secondNote's condition, so `intro` is only used when both
  // routes exist and every other combination gets `introWebOnly` ("The Android
  // build is on its way to Google Play"), which is true of all of them. The one
  // combination with no true sentence is a live listing and no APK; it would
  // need a fourth variant in every language, and nothing reaches it, because
  // APK_URL was set long before the listing was filed.
  const androidNote = PLAY_URL
    ? copy.download.playNote
    : APK_URL
      ? copy.download.playPendingNote
      : copy.download.androidPendingNote;
  const secondNote = PLAY_URL && APK_URL ? copy.download.apkNote : copy.download.iosNote;

  return `<!doctype html>
<html lang="${meta.lang}" dir="${meta.dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escape(copy.meta.title)}</title>
  <meta name="description" content="${escape(copy.meta.description)}" />
  <link rel="icon" type="image/svg+xml" href="assets/icon.svg" />
${alternates}
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="backdrop">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
  </div>

  <nav class="nav">
    <div class="nav-inner">
      <a href="${pageHref(code)}" class="brand">
        <img class="brand-mark" src="assets/icon.svg" alt="" width="28" height="28" />
        Chatterbox
      </a>
      <div class="nav-links">
        <a href="#different">${t(copy.nav.different)}</a>
        <a href="#features">${t(copy.nav.features)}</a>
        <a href="#limits">${t(copy.nav.limits)}</a>
        <a href="#download" class="nav-cta">${t(copy.nav.get)}</a>
      </div>
    </div>
  </nav>

  <main class="wrap">
    <section class="hero">
      <div>
        <span class="eyebrow">${t(copy.hero.eyebrow)}</span>
        <h1>${t(copy.hero.title)}</h1>
        <p class="lead">${t(copy.hero.lead)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#download">
            ${icon('download')}
            ${t(copy.hero.primary)}
          </a>
          <a class="btn btn-secondary" href="${policyHref(code)}">${t(copy.hero.secondary)}</a>
        </div>
        <div class="hero-badges">
${copy.hero.badges.map(b => `          <span class="badge">${t(b)}</span>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="section" id="different">
      <div class="section-head">
        <span class="eyebrow">${t(copy.different.eyebrow)}</span>
        <h2>${t(copy.different.title)}</h2>
        <p>${t(copy.different.intro)}</p>
      </div>

      <ol class="reasons">
${reasons}
      </ol>
    </section>

    <section class="section" id="features">
      <div class="section-head">
        <span class="eyebrow">${t(copy.features.eyebrow)}</span>
        <h2>${t(copy.features.title)}</h2>
        <p>${t(copy.features.intro)}</p>
      </div>

      <div class="feature-grid">
${features}
      </div>
    </section>

    <section class="section" id="privacy">
      <div class="section-head">
        <span class="eyebrow">${t(copy.controls.eyebrow)}</span>
        <h2>${t(copy.controls.title)}</h2>
      </div>

      <div class="privacy-strip">
${controls}
      </div>
    </section>

    <section class="section" id="limits">
      <div class="section-head">
        <span class="eyebrow">${t(copy.limits.eyebrow)}</span>
        <h2>${t(copy.limits.title)}</h2>
        <p>${t(copy.limits.intro)}</p>
      </div>

      <div class="ledger">
${ledger(copy.limits.sealed, 'ledger-yes')}
${ledger(copy.limits.visible, 'ledger-no')}
      </div>

      <p class="ledger-note">${t(copy.limits.note)}</p>
    </section>

    <section class="section" id="download">
      <div class="download-card">
        <h2>${t(copy.download.title)}</h2>
        <p>${t(PLAY_URL && APK_URL ? copy.download.intro : copy.download.introWebOnly)}</p>
        <div class="download-actions">
${playButton}
          <a class="btn btn-secondary" href="/app/">
            ${icon('globe')}
            ${t(copy.download.web)}
          </a>${apkButton}
        </div>
        <p class="download-note">
          ${t(androidNote)}
          <br /><br />
          ${t(secondNote)}
        </p>
      </div>
    </section>
  </main>

  <footer>
    <div class="wrap footer-inner">
      <span>${t(copy.footer.rights)}</span>
      <div class="footer-links">
        <a href="${policyHref(code)}">${t(copy.footer.privacy)}</a>
      </div>
    </div>
    <nav class="wrap site-langs" aria-label="${escape(copy.nav.language)}">
${langMenu}
    </nav>
  </footer>
</body>
</html>
`;
}

/**
 * Structural and honesty checks across the fifteen copy files.
 *
 * The risk with a translated marketing page is the same as with a translated
 * legal one, and it points the same way: the English admits that an earlier
 * version queried Wikipedia thirty times behind your back, that Google sees
 * every connection, and that nothing has been audited. A translation that
 * quietly drops a reason, merges two ledger rows into one, or loses the
 * sentence naming Google is a *different* page wearing the same design, and
 * the reader with the softer one has no way to know.
 *
 * Wording is on whoever edits it. Shape, and the handful of proper nouns that
 * carry the admissions, are checked here.
 */
export function validate(copies) {
  const english = copies.en;
  const problems = [];
  const check = (code, ok, what) => {
    if (!ok) problems.push(`${code}: ${what}`);
  };

  for (const [code, copy] of Object.entries(copies)) {
    // Every string the page renders has to be there and non-empty. A missing
    // key would otherwise render the literal `undefined` into the page.
    const strings = [];
    const collect = (node, path) => {
      if (typeof node === 'string') {
        strings.push([path, node]);
      } else if (Array.isArray(node)) {
        node.forEach((v, i) => collect(v, `${path}[${i}]`));
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) collect(v, path ? `${path}.${k}` : k);
      } else {
        problems.push(`${code}: ${path} is not text`);
      }
    };
    collect(copy, '');
    for (const [path, value] of strings) {
      check(code, value.trim().length > 0, `${path} is empty`);
    }

    if (code === 'en') continue;

    const counts = [
      ['hero.badges', copy.hero.badges.length, english.hero.badges.length],
      ['different.reasons', copy.different.reasons.length, english.different.reasons.length],
      ['features.cards', copy.features.cards.length, english.features.cards.length],
      ['controls.items', copy.controls.items.length, english.controls.items.length],
      ['limits.sealed.items', copy.limits.sealed.items.length, english.limits.sealed.items.length],
      [
        'limits.visible.items',
        copy.limits.visible.items.length,
        english.limits.visible.items.length,
      ],
    ];
    for (const [path, got, want] of counts) {
      check(code, got === want, `${path} has ${got} entries, English has ${want}`);
    }

    // A reason that loses its note has lost the concession, which is the part
    // of the reason a reader actually needs.
    english.different.reasons.forEach((r, i) => {
      const mine = copy.different.reasons[i];
      if (!mine) return;
      check(code, mine.body.length === r.body.length, `reason ${i + 1} has a different paragraph count`);
      check(code, Boolean(mine.note) === Boolean(r.note), `reason ${i + 1} ${r.note ? 'lost' : 'gained'} its note`);
    });

    // The placeholders are how the policy gets linked. Losing one turns a link
    // into the literal text `{policy}` on the page.
    check(code, copy.limits.intro.includes('{policy}'), 'limits.intro lost the {policy} link');
    const lastReason = copy.different.reasons[copy.different.reasons.length - 1];
    check(
      code,
      Boolean(lastReason && lastReason.note && lastReason.note.includes('{policyShort}')),
      'the last reason lost the {policyShort} link',
    );

    // Proper nouns that carry the admissions. These do not translate, so their
    // absence means the sentence around them went missing.
    //
    // The three AI providers used to be on this list. They came off when the
    // AI features were held back from the first release: the page no longer
    // claims to name them, because it no longer sends anything to them. Put
    // them back the same day the features come back — the reason that
    // replaced them says the privacy policy still lists them, and that
    // sentence has to stay true in all fifteen.
    const whole = JSON.stringify(copy);
    for (const name of ['WebRTC', 'Chatterbox']) {
      check(code, whole.includes(name), `never names ${name}`);
    }
    // Counted, not just present. Google is named eight times in the English
    // page and every one of them is load-bearing: it rents the servers, it
    // sees the connection metadata, it receives what the AI features send, it
    // runs the store. A translation that comes back with seven has dropped one
    // of those sentences, and a mere presence check would wave it through.
    // Not transliterated in any of the fifteen, so the count is comparable.
    const googles = t => (JSON.stringify(t).match(/Google/g) || []).length;
    check(
      code,
      googles(copy) >= googles(english),
      `names Google ${googles(copy)} times, English names it ${googles(english)} — a sentence about what Google sees or receives has gone`,
    );

    // An untranslated file is a real failure mode: copy en.mjs, forget to
    // translate, ship an English page under a Japanese filename.
    check(code, copy.hero.title !== english.hero.title, 'hero.title is still the English text');
    check(code, copy.meta.title !== english.meta.title, 'meta.title is still the English text');
  }

  if (problems.length) {
    throw new Error(`site copy problems:\n  ${problems.join('\n  ')}`);
  }
}

export async function generate() {
  const codes = SITE_LANGUAGES.map(l => l.code);
  const copies = {};
  for (const code of codes) {
    copies[code] = (await import(`./site-copy/${code}.mjs`)).default;
  }
  validate(copies);
  const pages = {};
  for (const code of codes) {
    pages[`website/${pageName(code)}`] = renderPage(code, copies[code], codes);
  }
  return pages;
}

if (process.argv[1] && process.argv[1].endsWith('build-site-html.mjs')) {
  const pages = await generate();
  if (process.argv.includes('--check')) {
    const stale = Object.entries(pages).filter(([path, html]) => {
      try {
        return readFileSync(join(ROOT, path), 'utf8') !== html;
      } catch {
        return true;
      }
    });
    if (stale.length) {
      console.error(
        'website landing pages are out of date with scripts/site-copy/:\n  ' +
          stale.map(([p]) => p).join('\n  ') +
          '\nRun: node scripts/build-site-html.mjs',
      );
      process.exit(1);
    }
    console.log('website landing pages are up to date');
  } else {
    for (const [path, html] of Object.entries(pages)) {
      writeFileSync(join(ROOT, path), html);
      console.log(`wrote ${path}`);
    }
  }
}
