/**
 * A component that renders English instead of calling `t` is invisible until
 * someone switches language, and by then it has usually been there for weeks.
 *
 * Three of them shipped that way: InviteModal, NewChatModal and
 * GroupMembersModal were written while `web/` had only two languages and the
 * modal beside them was already hardcoded, so matching it looked like
 * consistency. It was thirty strings the language switcher could not reach.
 *
 * This reads the source rather than rendering, because the failure is not a
 * wrong render — it is a string that was never wired to anything.
 */
import {describe, expect, it} from 'vitest';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = join(__dirname, '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : tsxFiles(full);
    return name.endsWith('.tsx') && !name.includes('.test.') ? [full] : [];
  });
}

/**
 * A line that is nothing but an English sentence. Deliberately narrow: it
 * catches prose sitting in JSX, which is the shape all thirty offenders had,
 * and leaves identifiers, imports and single words alone.
 */
const PROSE = /^[A-Z][a-z]+(?: [A-Za-z(),.!?'’…—-]+){2,14}[.?!]?$/;

/**
 * `>text</` — a JSX text node. The closing `</` is what separates it from a
 * TypeScript generic: `Promise<void>` has the same `>…<` shape.
 */
const TEXT_NODE = />([^<>\n]+)<\//g;

/**
 * `{cond ? 'Mute' : 'Unmute'}` — a label inside an expression, which the
 * pattern above cannot see because the words never sit between the tags.
 * Both branches capitalised, which is what a pair of labels looks like and
 * what an icon name ('mic' : 'micOff') does not.
 */
const TERNARY_LABEL = /\?\s*'([A-Z][^']{1,40})'\s*:\s*'([A-Z][^']{1,40})'/g;

/** A label with an expression after it: `Active until {…}`. */
const LABEL_THEN_EXPRESSION = /^[A-Z][A-Za-z]+(?: [A-Za-z()]+)*\s*\{/;

/**
 * Two words that stay as they are in every language: the product's name, and
 * the legend printed on a physical key.
 */
const NOT_COPY = new Set(['Chatterbox', 'Esc']);

/** Strips `{…}` repeatedly, so a nested call like `t('k', {n: x})` clears. */
function withoutExpressions(text: string): string {
  let out = text;
  for (let i = 0; i < 5 && out.includes('{'); i++) out = out.replace(/\{[^{}]*\}/g, '');
  return out.trim();
}

function scan(file: string): {prose: string[]; labels: string[]} {
  const prose: string[] = [];
  const labels: string[] = [];
  let inBlockComment = false;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('{/*') || t.startsWith('/*')) inBlockComment = true;
      if (inBlockComment) {
        if (t.includes('*/')) inBlockComment = false;
        return;
      }
      if (t.startsWith('//') || t.startsWith('*')) return;
      const where = `${file.replace(ROOT, 'web/src')}:${i + 1}`;
      if (PROSE.test(t)) prose.push(`${where}  ${t.slice(0, 60)}`);
      for (const m of line.matchAll(TEXT_NODE)) {
        const text = withoutExpressions(m[1]);
        // A leftover brace means the `>` that started this match was a
        // comparison inside an expression (`{unread > 99 ? …}`), not a tag.
        if (/[{}]/.test(text)) continue;
        if (/[A-Za-z]{2}/.test(text) && !NOT_COPY.has(text)) {
          labels.push(`${where}  ${text.slice(0, 40)}`);
        }
      }
      for (const m of line.matchAll(TERNARY_LABEL)) labels.push(`${where}  ${m[1]} / ${m[2]}`);
      if (LABEL_THEN_EXPRESSION.test(t)) labels.push(`${where}  ${t.slice(0, 40)}`);
    });
  return {prose, labels};
}

describe('components speak through the dictionary', () => {
  const files = tsxFiles(ROOT).filter(f => !f.includes(join('i18n', 'index')));

  it('finds the components, so a passing run means something', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('no component renders a bare English sentence', () => {
    expect(files.flatMap(f => scan(f).prose)).toEqual([]);
  });

  it('no component renders an untranslated label', () => {
    expect(files.flatMap(f => scan(f).labels)).toEqual([]);
  });
});
