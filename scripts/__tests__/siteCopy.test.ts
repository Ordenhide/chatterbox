/**
 * The landing page ships in every language the app offers, generated from
 * scripts/site-copy/. Two things can go wrong between an edit and a deploy,
 * and neither is visible in review:
 *
 *  1. The copy changes and nobody re-runs the generator, so the site keeps
 *     serving the old claim. This is exactly how the site's privacy page went
 *     stale for months before it was generated from one source.
 *  2. A translation quietly loses a concession — the note admitting the
 *     ratchet does not always apply, the sentence saying Google sees every
 *     connection — and the page becomes a softer product in that language
 *     than in English, which is the version we would rather not be shipping
 *     to the readers least able to check.
 *
 * The generator carries the structural rules (see `validate` there, and the
 * comment above it); running it in --check mode enforces both at once, and
 * fails with the generator's own message naming the language and the problem.
 */
describe('the website landing pages', () => {
  it('are up to date with scripts/site-copy, in every language', () => {
    const {execFileSync} = require('child_process');
    const path = require('path');
    const script = path.join(__dirname, '..', 'build-site-html.mjs');
    execFileSync('node', [script, '--check'], {stdio: 'pipe'});
  });
});
