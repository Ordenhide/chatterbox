# Chatterbox marketing site

Plain static HTML/CSS, no build step. Deploy this folder as-is.

## Deploy to Cloudflare Pages

1. Push this repo to GitHub (already done: `https://github.com/Ordenhide/chatterbox`).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick this repo.
3. Build settings:
   - **Build command:** leave empty
   - **Build output directory:** `website`
4. Deploy. Cloudflare will give you a `*.pages.dev` URL immediately; attach a custom domain later from the same project's **Custom domains** tab if you want one.

Alternatively, for a one-off deploy without connecting Git: `Workers & Pages → Create → Pages → Direct Upload`, and drag in this `website/` folder.

## How the "Download" button works

The button links to `https://github.com/Ordenhide/chatterbox/releases/latest`, which is empty until you publish a release. To publish one:

1. One-time setup — add these secrets in **GitHub repo → Settings → Secrets and variables → Actions**:
   - `CHATTERBOX_KEYSTORE_BASE64`
   - `CHATTERBOX_STORE_PASSWORD`
   - `CHATTERBOX_KEY_ALIAS`
   - `CHATTERBOX_KEY_PASSWORD`

   (Values were generated for you — see the message where this was set up. Keep them safe; this keystore is your app's permanent signing identity.)

2. Whenever you want a new release: `git tag v1.0.0 && git push origin v1.0.0`. The `.github/workflows/release-apk.yml` workflow builds a signed release APK and attaches it to a GitHub Release automatically.

## Updating content

- `index.html` — landing page copy/features
- `privacy.html` — mirrors `src/screens/PrivacyPolicyScreen.tsx`; keep both in sync if the in-app policy changes
- `styles.css` — shared styles for both pages
