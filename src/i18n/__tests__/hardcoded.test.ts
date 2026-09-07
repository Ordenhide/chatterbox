/**
 * A screen that renders English instead of calling `t` is invisible until
 * someone switches language, and by then it has usually been there for weeks.
 *
 * The web half of the app already has this test (web/src/i18n/hardcoded.test.ts,
 * written after thirty such strings shipped in three modals). Mobile had the
 * same problem and no test: RecoveryPhraseScreen's entire copy, the bookmark
 * empty state, Focus Mode, the error boundary, and two hundred strings in
 * ChatScreen — all English in a fifteen-language app, because i18next falls
 * back silently and nothing ever failed.
 *
 * This reads the source rather than rendering, because the failure is not a
 * wrong render — it is a string that was never wired to anything.
 */
import {readdirSync, readFileSync, statSync} from 'fs';
import {join} from 'path';

const ROOT = join(__dirname, '..', '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return name.endsWith('.tsx') && !name.includes('.test.') ? [full] : [];
  });
}

/**
 * A line that is nothing but an English sentence — prose sitting in JSX.
 * Deliberately narrow: it leaves identifiers, imports and single words alone.
 */
const PROSE = /^[A-Z][a-z]+(?: [A-Za-z(),.!?'’…—-]+){2,14}[.?!]?$/;

/**
 * `>text</` — a JSX text node. The closing `</` is what separates it from a
 * TypeScript generic: `Promise<void>` has the same `>…<` shape and is not a
 * label anyone reads.
 *
 * Braces are allowed inside and stripped before the check, because
 * `>Schedule Message {count ? \`(${count})\` : ''}</Text>` is an English label
 * with an expression after it — and requiring a brace-free segment let that
 * one through the whole first pass.
 */
const TEXT_NODE = />([^<>\n]+)<\//g;

/**
 * `{cond ? 'Stop' : 'Voice'}` — a label inside an expression, which the text
 * node pattern above cannot see because the words never sit between the tags.
 * Eight of these hid in ChatScreen through the whole first pass, including the
 * attach sheet's Voice and Location buttons; the emulator found them, not the
 * test. Both branches quoted and capitalised, which is what a pair of labels
 * looks like and what an icon name ('lock' : 'alertTriangle') does not.
 */
const TERNARY_LABEL = /\?\s*'([A-Z][^']{1,40})'\s*:\s*'([A-Z][^']{1,40})'/g;

/**
 * A label on its own line with an expression after it — `Schedule Message
 * {count ? …}`, `Opens {new Date(…)}`. Neither of the patterns above can see
 * these: the words touch no tag on their own line, and the braces stop the
 * prose pattern from matching the whole line.
 */
const LABEL_THEN_EXPRESSION = /^[A-Z][A-Za-z]+(?: [A-Za-z()]+)*\s*\{/;

/**
 * `{name}'s safety number changed. Tap to verify.` — the mirror image of the
 * pattern above: the expression first, the sentence after it. All three
 * patterns miss this shape. PROSE anchors on `^[A-Z]` and the line starts
 * with a brace; TEXT_NODE needs `>…</` on one line and this text sits on its
 * own; LABEL_THEN_EXPRESSION wants the words before the brace.
 *
 * This is how the security-code-changed banner stayed English-only in a
 * fifteen-language app — the single warning that a contact's key may have
 * been substituted, which is the one sentence in the product you least want
 * a user unable to read.
 *
 * Three words and a full stop after the expression, so `{count} unread` and
 * `{a} · {b}` do not qualify; no braces after the first pair, so nested
 * expressions like `t('k', {n})` fall out.
 */
const EXPRESSION_THEN_LABEL =
  /^\{[^{}]+\}[^{}]*?\b[A-Za-z]{2,}\b(?:[^{}]*\b[A-Za-z]{2,}\b){2,}[^{}]*[.?!]$/;

/** Strips `{…}` repeatedly, so a nested call like `t('k', {n: x})` clears. */
function withoutExpressions(text: string): string {
  let out = text;
  for (let i = 0; i < 5 && out.includes('{'); i++) out = out.replace(/\{[^{}]*\}/g, '');
  return out.trim();
}

function scan(file: string): {prose: string[]; nodes: string[]} {
  const prose: string[] = [];
  const nodes: string[] = [];
  let inBlockComment = false;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const trimmed = line.trim();
      // `{/*` as well as `/*`: a JSX comment is the commonest place for prose.
      if (trimmed.startsWith('{/*') || trimmed.startsWith('/*')) inBlockComment = true;
      if (inBlockComment) {
        if (trimmed.includes('*/')) inBlockComment = false;
        return;
      }
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (PROSE.test(trimmed)) prose.push(`${file}:${i + 1}  ${trimmed.slice(0, 60)}`);
      for (const match of line.matchAll(TEXT_NODE)) {
        const text = withoutExpressions(match[1]);
        // A leftover brace means the `>` that started this match was a
        // comparison inside an expression (`{unread > 99 ? …}`), not a tag.
        if (/[{}]/.test(text)) continue;
        if (/[A-Za-z]{2}/.test(text)) nodes.push(`${file}:${i + 1}  ${text.slice(0, 40)}`);
      }
      for (const match of line.matchAll(TERNARY_LABEL)) {
        nodes.push(`${file}:${i + 1}  ${match[1]} / ${match[2]}`);
      }
      if (LABEL_THEN_EXPRESSION.test(trimmed)) {
        nodes.push(`${file}:${i + 1}  ${trimmed.slice(0, 40)}`);
      }
      if (EXPRESSION_THEN_LABEL.test(trimmed)) {
        nodes.push(`${file}:${i + 1}  ${trimmed.slice(0, 40)}`);
      }
    });
  return {prose, nodes};
}

describe('screens speak through the dictionary', () => {
  const files = tsxFiles(ROOT);

  it('finds the screens, so a passing run means something', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('no screen renders a bare English sentence', () => {
    const offenders = files.flatMap(f => scan(f).prose.map(s => s.replace(ROOT, 'src')));
    expect(offenders).toEqual([]);
  });

  it('no screen renders an untranslated label', () => {
    const offenders = files.flatMap(f => scan(f).nodes.map(s => s.replace(ROOT, 'src')));
    expect(offenders).toEqual([]);
  });
});
