/**
 * Every Cloud Function a client calls by name must exist in functions/index.js.
 *
 * A callable is joined to its caller by a string and nothing else. Delete or
 * rename the function and every client still compiles, still passes its own
 * tests (which mock httpsCallable), and in production gets `not-found` on
 * each call — which most call sites catch and report rather than surface.
 * Written when sessionHeartbeat was deleted, so that the next removal cannot
 * leave a caller behind the way the reverse had gone unnoticed: a function
 * that every foreground phone called once a minute while nothing, anywhere,
 * read what it wrote.
 */
import {readFileSync, readdirSync, statSync} from 'fs';
import {join, relative} from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const CLIENT_DIRS = ['src', join('web', 'src')];
const FUNCTIONS_INDEX = join(ROOT, 'functions', 'index.js');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** name -> files calling it */
function clientCallables(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const dir of CLIENT_DIRS) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/httpsCallable\(\s*[^,]+?,\s*['"`]([A-Za-z0-9_]+)['"`]/g)) {
        const list = found.get(m[1]) ?? [];
        list.push(relative(ROOT, file));
        found.set(m[1], list);
      }
    }
  }
  return found;
}

function exportedFunctions(): Set<string> {
  const text = readFileSync(FUNCTIONS_INDEX, 'utf8');
  return new Set([...text.matchAll(/^exports\.([A-Za-z0-9_]+)\s*=/gm)].map(m => m[1]));
}

describe('client callables and deployed functions', () => {
  it('finds the callables it is meant to check', () => {
    // Pinned so a changed call style cannot turn the next assertion into a
    // check over nothing. One of each shape in use: a `functions` variable,
    // and an inline getFunctions() — whose parentheses an earlier version of
    // the pattern excluded, silently dropping two of the six names.
    const names = clientCallables();
    expect(names.has('claimSession')).toBe(true);
    expect(names.has('fetchLinkPreview')).toBe(true);
    expect(names.has('markViewOnceViewed')).toBe(true);
  });

  it('every name a client calls is exported by functions/index.js', () => {
    const exported = exportedFunctions();
    const missing = [...clientCallables()]
      .filter(([name]) => !exported.has(name))
      .map(([name, files]) => `${name} (called from ${files.join(', ')})`);
    expect(missing).toEqual([]);
  });
});

describe('the session heartbeat stays deleted', () => {
  it('is neither exported nor called, and nothing writes its timestamp', () => {
    // It kept no session alive — single-session enforcement is claimSession
    // plus the activeSessionId listener — while giving the server a
    // minute-resolution record of when each user had the app open. If a
    // liveness signal is ever genuinely needed, it needs a reader first.
    expect(exportedFunctions().has('sessionHeartbeat')).toBe(false);
    expect(clientCallables().has('sessionHeartbeat')).toBe(false);
    const writers = [FUNCTIONS_INDEX, ...CLIENT_DIRS.flatMap(d => sourceFiles(join(ROOT, d)))]
      .filter(f => readFileSync(f, 'utf8').includes('sessionHeartbeatAt'))
      .map(f => relative(ROOT, f));
    expect(writers).toEqual([]);
  });
});
