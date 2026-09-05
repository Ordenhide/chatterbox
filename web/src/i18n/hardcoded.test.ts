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

describe('components speak through the dictionary', () => {
  const files = tsxFiles(ROOT).filter(f => !f.includes(join('i18n', 'index')));

  it('finds the components, so a passing run means something', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('no component renders a bare English sentence', () => {
    const offenders: string[] = [];
    for (const file of files) {
      let inBlockComment = false;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const t = line.trim();
          if (t.startsWith('/*')) inBlockComment = true;
          if (inBlockComment) {
            if (t.includes('*/')) inBlockComment = false;
            return;
          }
          if (t.startsWith('//') || t.startsWith('*')) return;
          if (PROSE.test(t)) {
            offenders.push(`${file.replace(ROOT, 'web/src')}:${i + 1}  ${t.slice(0, 60)}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
