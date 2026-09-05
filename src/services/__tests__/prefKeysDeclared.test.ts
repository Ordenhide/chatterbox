/**
 * Every key passed to the synchronous MMKV preference API must be declared in
 * `PREF_KEYS`.
 *
 * An undeclared key does not fail quietly. `assertPrefKey` throws, so the read
 * logs an error and falls back to its default — and the *write* throws all the
 * way out, which means the setting can never be turned on at all. On the
 * emulator this showed up as a red error toast over the chat list on every
 * render pass, from two keys added with the privacy toggles and never declared:
 * `typing_indicator` and `read_receipts`. Both switches were permanently stuck
 * off, and the failure looked like a storage problem rather than a missing
 * entry in a list.
 *
 * The unit tests could not catch it because they mock `storageMMKV` — mocking
 * the module also mocks away the guard. This reads the source instead.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const storage = fs.readFileSync(path.join(SRC, 'services', 'storageMMKV.ts'), 'utf8');

const declared = new Set(
  [...storage.slice(storage.indexOf('const PREF_KEYS'), storage.indexOf('PREF_PREFIXES'))
    .matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]),
);

const prefixes = [
  ...storage
    .slice(storage.indexOf('const PREF_PREFIXES'), storage.indexOf('function isPrefKey'))
    .matchAll(/'([a-z0-9_]+)'/g),
].map(m => m[1]);

/** Literal keys handed to the synchronous preference API anywhere in src/. */
function usedKeys(): {key: string; file: string}[] {
  const found: {key: string; file: string}[] = [];
  for (const file of sourceFiles(SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const m of source.matchAll(/\b(?:get|set)(?:Boolean|Number|String)\(\s*'([^']+)'/g)) {
      found.push({key: m[1], file: path.relative(SRC, file)});
    }
  }
  return found;
}

describe('synchronous MMKV preference keys', () => {
  const used = usedKeys();

  it('finds the call sites, so a passing run means something', () => {
    expect(used.length).toBeGreaterThan(5);
    // The list itself has to have parsed, or every key would look declared.
    expect(declared.has('screenshot_protection')).toBe(true);
  });

  it('are all declared', () => {
    const undeclaredKeys = used
      .filter(({key}) => !declared.has(key) && !prefixes.some(p => key.startsWith(p)))
      .map(({key, file}) => `${key} (${file})`);
    expect([...new Set(undeclaredKeys)]).toEqual([]);
  });
});
