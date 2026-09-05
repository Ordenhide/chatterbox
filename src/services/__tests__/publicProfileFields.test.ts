/**
 * Nothing may write an email, a photo URL or a display name into
 * `users/{uid}`.
 *
 * The rules refuse all three (firestore.rules, identityFieldsHonest), so a
 * client that tries does not leak anything — it fails with permission-denied
 * and loses whatever the user was doing. That is how this was found: the web
 * profile screen still mirrored a rename into the profile document, so
 * renaming yourself would have silently stopped working.
 *
 * A rules test cannot catch that, because the rule was right. This scans both
 * clients for the write instead, which is the half that was wrong.
 *
 * The scan is deliberately shallow — it finds `doc(..., 'users', ...)` and
 * reads the object literal that follows — so it will not see a write built
 * somewhere else and passed in. It catches the shape every existing writer
 * uses, and the shape anyone adding one would reach for.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..', '..');
const BANNED = ['email', 'photoURL', 'displayName'] as const;

/** Every .ts/.tsx under a directory, skipping tests and node_modules. */
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

/**
 * The argument text of every `setDoc`/`updateDoc`/`batch.set` call whose
 * document path names the `users` collection.
 *
 * Extracted by matching parentheses from the call rather than by a line
 * window, because a window wide enough to hold the object literal is also wide
 * enough to catch the unrelated code beside it — the first version of this
 * flagged the in-memory user object that sits next to one of these writes.
 */
function profileWrites(source: string): string[] {
  const found: string[] = [];
  const call = /\b(?:setDoc|updateDoc|batch\.set)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = call.exec(source))) {
    let depth = 1;
    let i = match.index + match[0].length;
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') depth--;
    }
    const args = source.slice(match.index + match[0].length, i - 1);
    // The first argument is the document reference. Anything deeper in the
    // object literal that happens to say 'users' is not a path.
    const ref = args.split(',').slice(0, 4).join(',');
    if (/['"]users['"]/.test(ref) || /usersRef\(\)/.test(ref)) found.push(args);
  }
  return found;
}

describe('the public profile document', () => {
  const files = [...sourceFiles(path.join(ROOT, 'src')), ...sourceFiles(path.join(ROOT, 'web', 'src'))];

  it('finds the writers, so a passing run means something', () => {
    const writers = files.filter(f => profileWrites(fs.readFileSync(f, 'utf8')).length > 0);
    // upsertUserProfile, the two account-bootstrap writes in AuthContext, and
    // their web twins. If this drops to nothing the scan has stopped working.
    expect(writers.length).toBeGreaterThanOrEqual(3);
  });

  it.each(BANNED)('never writes %s', field => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const block of profileWrites(fs.readFileSync(file, 'utf8'))) {
        // Whitespace around the colon is collapsed first. Without that the
        // negative lookahead below is satisfied by the *space* after the colon
        // — `\s*` matches nothing, the lookahead sees ' delete…' rather than
        // 'delete…', and every exempted line reads as an offender. The first
        // version of this test did exactly that and flagged its own migration.
        const flat = block.replace(/\s*:\s*/g, ':').replace(/\s+/g, ' ');
        // `field: deleteField()` is the migration, not a write — it is how an
        // account created before this clears itself on the next sign-in.
        // Two forms, because the real offender used the second one:
        // `{displayName: name}` and the shorthand `{displayName}`. A scan that
        // only knew about the colon passed while the bug was still there.
        const assigned = new RegExp(`\\b${field}:(?!deleteField\\(\\))`);
        const shorthand = new RegExp(`[{,] ?${field} ?[,}]`);
        if (assigned.test(flat) || shorthand.test(flat)) {
          offenders.push(path.relative(ROOT, file));
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});
