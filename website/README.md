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

Firebase Hosting serves this folder (`firebase.json` → `hosting.public`):

```
firebase deploy --only hosting
```

`cleanUrls` is on, so `/index.ja.html` redirects to `/index.ja`. Links in the
generated pages keep the `.html` so the folder also works on a plain static
host, or opened straight off disk.

The APK, once there is a signed one, goes at `downloads/chatterbox-latest.apk`
— the path `APK_URL` expects. `.github/workflows/release-apk.yml` builds one on
a `v*` tag and attaches it to a GitHub Release; the repository is private, so
that release page is not a link this site can offer to a reader.
