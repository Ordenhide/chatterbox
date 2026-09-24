# Chatterbox marketing site

Static HTML and CSS. No bundler, no framework — but **most of the HTML here is
generated, and editing it by hand is wasted work**: the next generator run
overwrites it, and a test fails in the meantime.

| Files | Generated from | Command |
| --- | --- | --- |
| `index.html`, `index.<lang>.html` | `scripts/site-copy/<lang>.mjs` | `node scripts/build-site-html.mjs` |
| `privacy.html`, `privacy.<lang>.html` | `src/i18n/privacyPolicy.ts` | `node scripts/build-privacy-html.mjs` |
| `app/` | the web client (`web/`) | `npm --prefix web run build:site` |
| `assets/icon.svg` | `scripts/make-icon.py` | `python3 scripts/make-icon.py` |

Hand-written: `styles.css`, this file, and `assets/screenshot-login.png`.

Both generators take `--check`, which verifies without writing. Jest runs both
(`scripts/__tests__/siteCopy.test.ts`, `src/i18n/__tests__/privacyPolicy.test.ts`),
so editing the copy and forgetting to regenerate fails CI instead of shipping a
site that contradicts its own source. That is not hypothetical: the privacy page
was hand-maintained once and spent months describing a messenger that stored
messages in the clear.

## Every language the app offers

The landing page and the policy both ship in every language the app offers.
`scripts/site-copy/languages.mjs` is the one list of them — writing direction
and each language's own name — and both generators read it, so a language
cannot exist on one page type and not the other.

To add a language: add it there, add `scripts/site-copy/<code>.mjs` (copy
`en.mjs` and translate), add its policy to `src/i18n/privacyPolicy.ts` and its
page furniture to `CHROME` in the privacy generator. Both generators throw
rather than emit an English page under a foreign name.

`validate()` in `build-site-html.mjs` checks the translations against English
for structure — same reasons, same ledger rows, same notes — and for the proper
nouns that carry the admissions. The failure mode it exists for is a
translation that is *softer* than the English, which no amount of review
catches once you cannot read the language.

## The two Android routes

`PLAY_URL` and `APK_URL` at the top of `scripts/build-site-html.mjs` are `null`
until each one actually exists. The download card has a shape for every
combination and says only what is true, so the page cannot advertise a store
listing that is not published or a file nobody has built. Setting either one is
a one-line edit followed by a regenerate.

When `PLAY_URL` is set: Google's brand guidelines want their own badge artwork
rather than the text button that is there now.

## Deploying

Cloudflare Pages serves this folder (`wrangler.toml` →
`pages_build_output_dir`). It moved off Firebase Hosting on 2026-09-24.

```
cd web && npm run build:site        # → website/app/
cd ../website && npx wrangler pages deploy . --project-name=chatterbox
```

From inside this folder, never from the repository root: Pages bundles a
`functions/` directory in the working directory as edge functions, and the
root has one — the Firebase Cloud Functions.

One project serves both: the marketing pages at `/` and the web client at
`/app/`, which is why `build:site` passes `--base=/app/` and why the `/app/`
links in the generated pages need no rewriting.

Pages strips `.html`, so `/index.ja.html` redirects to `/index.ja` — the same
behaviour Firebase's `cleanUrls` gave. Links in the generated pages keep the
`.html` so the folder also works on a plain static host, or opened straight off
disk.

`_headers` and `404.html` are hand-written. `_headers` carries what
`firebase.json` used to: the security headers, the enforced CSP on the
marketing pages and the Report-Only one on the app. There is deliberately no
`_redirects`: Firebase's `/app/**` rewrite, ported, served the app's own
JavaScript bundle as HTML, and the web client routes through the hash so it
never needed one — see the comment in `404.html`, whose presence is what stops
Pages answering unknown paths with the landing page. Read the comment at the top of `_headers` before adding a rule —
Cloudflare joins a repeated header with a comma instead of overriding it, and
getting that wrong denies the web client its microphone and camera.

**The APK is not in this folder.** A Pages asset is capped at 25 MiB and the
APK is ~122 MB, so `.github/workflows/release-apk.yml` uploads it to R2 on a
`v*` tag and `APK_URL` is an absolute URL to it. `downloads/` holds only
`version.json`, which `src/services/updateCheck.ts` polls. The same tag also
attaches the APK to a GitHub Release, which is where its SHA-256 is published
— a verification channel on a different host from the download itself.
