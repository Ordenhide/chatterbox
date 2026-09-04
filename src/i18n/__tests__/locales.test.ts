/**
 * JSON lets a key be written twice and keeps only the last one, silently. A
 * translation file is exactly where that goes unnoticed: en.json declared
 * "call" twice, so the first block — the group-call explanation — was
 * discarded at parse time, and because en is also the fallback language,
 * every user in every language who tapped call in a group chat got an alert
 * titled with the literal string "call.groupUnsupportedTitle".
 *
 * Nothing catches this otherwise. The file is valid JSON, TypeScript never
 * sees the raw text, and the app renders the key name rather than crashing,
 * so it only ever surfaces as a screenshot from a user.
 */
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

/**
 * Every duplicated key path in a JSON document, in source order.
 *
 * Written against the raw text because every JSON parser has already thrown
 * the evidence away by the time it returns — the duplicate is gone from the
 * object, which is the whole problem.
 */
function duplicateKeys(source: string): string[] {
  const duplicates: string[] = [];
  // One Set of seen keys per open object, so only *sibling* keys collide;
  // the same name nested under two different parents is normal and fine.
  const scopes: Set<string>[] = [];
  const trail: string[] = [];
  let pendingKey: string | null = null;
  // Survives the colon that consumes pendingKey, because the object a key
  // opens is written *after* that colon and needs the name for the path.
  let lastKey: string | null = null;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (ch === '"') {
      let text = '';
      i++;
      for (; i < source.length && source[i] !== '"'; i++) {
        // A quote can only end the string if it isn't escaped, and a literal
        // backslash must not be mistaken for an escape of the next character.
        if (source[i] === '\\') text += source[i++];
        text += source[i];
      }
      // A string is a key only when a colon follows it; otherwise it is a
      // value, and a value that happens to repeat is not a duplicate.
      let j = i + 1;
      while (j < source.length && /\s/.test(source[j])) j++;
      if (source[j] === ':') pendingKey = text;
      continue;
    }

    if (ch === '{') {
      trail.push(lastKey ?? '');
      scopes.push(new Set());
      pendingKey = null;
      lastKey = null;
      continue;
    }

    if (ch === '}') {
      trail.pop();
      scopes.pop();
      lastKey = null;
      continue;
    }

    if (ch === ':' && pendingKey !== null) {
      const scope = scopes[scopes.length - 1];
      if (scope) {
        const full = [...trail.filter(Boolean), pendingKey].join('.');
        if (scope.has(pendingKey)) duplicates.push(full);
        scope.add(pendingKey);
      }
      lastKey = pendingKey;
      pendingKey = null;
    }
  }

  return duplicates;
}

const localeFiles = fs.readdirSync(LOCALES_DIR).filter(name => name.endsWith('.json'));

describe('locale files', () => {
  it('finds every locale file, so a passing run means something', () => {
    // Without this, a wrong path would make every test below vacuously pass.
    expect(localeFiles.length).toBeGreaterThan(1);
    expect(localeFiles).toContain('en.json');
  });

  it.each(localeFiles)('%s declares each key once', name => {
    const source = fs.readFileSync(path.join(LOCALES_DIR, name), 'utf8');
    expect(duplicateKeys(source)).toEqual([]);
  });
});

describe('duplicateKeys', () => {
  // Control tests. A detector that silently never fires would leave every
  // suite above green while the bug it exists for walked straight past it.
  it('reports a repeated key', () => {
    expect(duplicateKeys('{"a": 1, "a": 2}')).toEqual(['a']);
  });

  it('reports a repeated key nested under its parent', () => {
    expect(duplicateKeys('{"call": {"end": 1, "end": 2}}')).toEqual(['call.end']);
  });

  it('accepts the same name under two different parents', () => {
    expect(duplicateKeys('{"a": {"x": 1}, "b": {"x": 2}}')).toEqual([]);
  });

  it('does not mistake a repeated string value for a key', () => {
    expect(duplicateKeys('{"a": "dup", "b": "dup"}')).toEqual([]);
  });

  it('does not mistake a colon or brace inside a string for structure', () => {
    expect(duplicateKeys('{"a": "x: {y}", "b": "z"}')).toEqual([]);
  });

  it('handles escaped quotes without losing track of the string', () => {
    expect(duplicateKeys('{"a": "say \\"hi\\"", "a": 2}')).toEqual(['a']);
  });

  it('finds duplicates inside objects in an array', () => {
    expect(duplicateKeys('{"xs": [{"k": 1, "k": 2}]}')).toEqual(['xs.k']);
  });
});

/**
 * The other half of the same failure: a key the code asks for that no locale
 * defines. i18next renders the key path itself rather than throwing, so
 * `errors.generic` reached four alerts in ChatSettingsScreen as literal body
 * text. English is the fallback language, so a gap here is a gap in every
 * language at once — which makes en.json the only file worth checking.
 *
 * Only statically-written keys can be checked. A computed one is invisible
 * here, so this is a floor, not a guarantee.
 */
function staticTranslationKeys(dir: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g;

  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const source = fs.readFileSync(full, 'utf8');
      for (const match of source.matchAll(pattern)) {
        if (!found.has(match[1])) found.set(match[1], full);
      }
    }
  };

  walk(dir);
  return found;
}

function lookup(translations: unknown, keyPath: string): unknown {
  let node: any = translations;
  for (const part of keyPath.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

describe('translation keys used in code', () => {
  const english = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
  const used = staticTranslationKeys(path.join(__dirname, '..', '..'));

  it('finds the call sites, so a passing run means something', () => {
    // A regex that matched nothing would make the check below vacuous.
    expect(used.size).toBeGreaterThan(100);
  });

  it('are all defined in the fallback language', () => {
    const missing = [...used]
      .filter(([key]) => typeof lookup(english, key) !== 'string')
      .map(([key, file]) => `${key} (${path.relative(path.join(__dirname, '..', '..'), file)})`);
    expect(missing).toEqual([]);
  });
});
