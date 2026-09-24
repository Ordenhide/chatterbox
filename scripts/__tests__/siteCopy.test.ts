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

  /**
   * The download card cannot recommend a route it also says is unavailable.
   *
   * The generator picks three sentences from three constants, and one of them
   * was keyed on the wrong constant: the intro paragraph chose `intro`
   * whenever APK_URL was set, and `intro` claims "Google Play keeps it
   * updated" — a statement about PLAY_URL. With an APK and no listing, every
   * one of the fifty-two pages said Play keeps the app updated, two sentences
   * above the note saying the listing is not live.
   *
   * Asserted on the generated pages rather than on the copy, because the copy
   * is fine: all four sentences are true of the state they describe, and the
   * defect was entirely in which one got chosen. Nothing else here would see
   * that — --check compares the pages to what the generator produces, so it
   * agreed with the contradiction.
   */
  const pages = () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '..', '..', 'website');
    return fs
      .readdirSync(dir)
      .filter((f: string) => /^index(\.[\w-]+)?\.html$/.test(f))
      .map((f: string) => [f, fs.readFileSync(path.join(dir, f), 'utf8') as string] as const);
  };

  it('finds the generated pages it is about to check', () => {
    // Every case below asserts that something is *absent*, so a glob that
    // matched nothing would pass all of them. One page per site language,
    // counted from the language list rather than pinned to a number, so
    // adding a language does not fail this for the wrong reason — but a
    // language whose page was never generated does.
    const fs = require('fs');
    const path = require('path');
    const langs: string = fs.readFileSync(
      path.join(__dirname, '..', 'site-copy', 'languages.mjs'),
      'utf8',
    );
    const codes = [...langs.matchAll(/\{code: '([\w-]+)'/g)].map(m => m[1]);
    expect(codes.length).toBeGreaterThan(50);
    const found = pages();
    expect(found.length).toBe(codes.length);
    expect(found.some(([f]) => f === 'index.html')).toBe(true);
    // And they are the pages with the download card, not some other index.
    for (const [file, html] of found) {
      expect([file, html.includes('id="download"')]).toEqual([file, true]);
    }
  });

  /**
   * Read as text, not imported: these are ESM and jest's transform here is not.
   * Scoped to the `download:` block first, because `intro` is also a key under
   * `limits`.
   */
  const englishDownload = (field: string): string => {
    const fs = require('fs');
    const path = require('path');
    const src: string = fs.readFileSync(path.join(__dirname, '..', 'site-copy', 'en.mjs'), 'utf8');
    const block = src.match(/download:\s*\{[\s\S]*?\n  \},/);
    if (!block) throw new Error('en.mjs: could not find the download block');
    const m = block[0].match(new RegExp(`\\b${field}:\\s*\`([^\`]*)\``));
    if (!m) throw new Error(`en.mjs: could not read download.${field}`);
    return m[1];
  };

  it('reads the four download sentences out of the English copy', () => {
    // The case below compares generated pages against these strings, so an
    // extractor that returned '' would make every page "contain" it and the
    // absence assertions would be meaningless.
    expect(englishDownload('intro')).toContain('Google Play keeps it updated');
    expect(englishDownload('introWebOnly')).toContain('on its way to Google Play');
    expect(englishDownload('playPendingNote')).toContain('not live yet');
  });

  it('never promises store updates on a page that says the listing is not live', () => {
    const fs = require('fs');
    const path = require('path');
    const generator: string = fs.readFileSync(
      path.join(__dirname, '..', 'build-site-html.mjs'),
      'utf8',
    );
    // Once the listing is live `intro` becomes the true sentence and this case
    // stops applying; until then it must not be the one on the page.
    if (!/export const PLAY_URL = null;/.test(generator)) return;

    const intro = englishDownload('intro');
    const introWebOnly = englishDownload('introWebOnly');
    for (const [file, html] of pages()) {
      expect([file, html.includes(intro)]).toEqual([file, false]);
      expect([file, html.includes(introWebOnly)]).toEqual([file, file === 'index.html']);
    }
  });
});
