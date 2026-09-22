/**
 * Every write to `lastMessage` carries `sealed`.
 *
 * `sealed` is a security-facing label: the chat list renders a padlock from
 * it, on both clients. It was set by the send path and by nothing else, and
 * `setDoc(..., {merge: true})` merges a map field by field — so the flag
 * survived every other write and went on describing a message that was no
 * longer the last one.
 *
 * Both directions are wrong, and one of them is the worst kind of wrong this
 * app can produce:
 *
 *   - a stale `sealed: true` over a plaintext preview is the UI claiming
 *     encryption that this message does not have
 *   - a stale `sealed: false` over a sealed one renders the preview blank,
 *     which is the bug MULTIDEVICE.md records as fixed
 *
 * Checked on source rather than by driving Firestore, because the property is
 * "no writer forgets it" — a behavioural test would only ever cover the
 * writers someone remembered to write a test for, which is exactly the set
 * that was already correct.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const SOURCES = [
  join(__dirname, '..', 'firebaseChat.ts'),
  join(__dirname, '..', '..', '..', 'web', 'src', 'services', 'chat.ts'),
];

/**
 * Each `lastMessage: { ... }` object literal in a file, as source text.
 *
 * Brace-matched rather than regex-terminated: these literals contain nested
 * objects (`file: {uri}`) and a lazy match to the first `}` would cut one in
 * half and then find `sealed` missing from a fragment.
 */
function lastMessageLiterals(text: string): {file: string; snippet: string}[] {
  const out: {file: string; snippet: string}[] = [];
  const marker = /lastMessage:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(text)) !== null) {
    const open = text.indexOf('{', m.index);
    let depth = 0;
    let end = open;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    out.push({file: '', snippet: text.slice(open, end + 1)});
  }
  return out;
}

/** Comments stripped, so prose mentioning `sealed` cannot satisfy the check. */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join('\n');
}

const literals = SOURCES.flatMap(path => {
  const text = codeOnly(readFileSync(path, 'utf8'));
  return lastMessageLiterals(text).map(l => ({...l, file: path.split('/chatterbox/')[1] ?? path}));
});

describe('the chat-list preview never claims the wrong protection', () => {
  it('finds the writes it is checking, and parses them whole', () => {
    // Pinned twice over. Nothing here is about a set difference, so a parser
    // that found nothing would report every writer compliant — and one that
    // truncated at the first nested brace would report them all broken.
    expect(literals.length).toBeGreaterThanOrEqual(5);
    expect(literals.some(l => l.file.startsWith('src/'))).toBe(true);
    expect(literals.some(l => l.file.startsWith('web/src/'))).toBe(true);
  });

  it('matches braces rather than stopping at the first one', () => {
    // Pinned on a fixture, not on the tree: no literal in either file happens
    // to nest an object today, so asserting that one does would pin the
    // codebase's current shape instead of this parser. A lazy match would
    // return `{a: {b: 1}` here and then find `sealed` missing from a fragment.
    const [one] = lastMessageLiterals('lastMessage: {a: {b: 1}, sealed: true},');
    expect(one.snippet).toBe('{a: {b: 1}, sealed: true}');
  });

  it('ignores a `sealed` that only appears in a comment', () => {
    const stripped = codeOnly('x = 1; // lastMessage: {text: "", sealed: true}\ny = 2;');
    expect(lastMessageLiterals(stripped)).toEqual([]);
  });

  it('sets sealed on every lastMessage write', () => {
    const missing = literals
      .filter(l => !/\bsealed\b/.test(l.snippet) && !/\.\.\.\s*\w*[Pp]review/.test(l.snippet))
      .map(l => `${l.file}: ${l.snippet.replace(/\s+/g, ' ').slice(0, 90)}`);
    expect(missing).toEqual([]);
  });

  it('routes the ones that compute a preview through the shared helper', () => {
    // The helper is what keeps `sealed` and `text` consistent with each other.
    // A writer that sets `sealed` by hand beside a `text` it computed itself
    // is how the two came apart in the first place.
    const mobile = readFileSync(SOURCES[0], 'utf8');
    const web = readFileSync(SOURCES[1], 'utf8');
    expect(mobile).toContain('export function lastMessagePreview');
    expect(web).toContain('export function lastMessagePreview');
    // Two call sites each: the send path and the recompute.
    expect(mobile.match(/lastMessagePreview\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(web.match(/lastMessagePreview\(/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

/*
 * lastMessagePreview's own behaviour is tested in firebaseChat.test.ts,
 * which already mocks the Firestore seam this module reaches at import time.
 */
