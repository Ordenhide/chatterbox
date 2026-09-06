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
 */
const TEXT_NODE = />([^<>{}\n]+)<\//g;

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
        const text = match[1].trim();
        if (/[A-Za-z]{2}/.test(text)) nodes.push(`${file}:${i + 1}  ${text.slice(0, 40)}`);
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
