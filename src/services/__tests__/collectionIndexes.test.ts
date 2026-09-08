import fs from 'fs';
import path from 'path';

/**
 * Every *collection-scoped* composite query in the client must have a
 * COLLECTION-scoped index.
 *
 * functions/__tests__/collectionGroupIndexes.test.js covers the mirror image
 * and explains what it cost: a COLLECTION index cannot serve a collectionGroup
 * query, the scheduled jobs caught the resulting error, logged it, returned
 * normally, and scheduled messages sat unsent for twelve hours while every
 * invocation reported success.
 *
 * The inverse was never checked, and had the same hole. `scheduledMessages`
 * and `reminders` carried COLLECTION_GROUP indexes only — correct for the
 * Cloud Functions that sweep them, useless to the clients, which query a
 * single chat's or a single user's subcollection. Firestore answers those with
 * FAILED_PRECONDITION, and both listeners pass `() => callback([])` as their
 * error handler, so the failure arrives as "you have no scheduled messages"
 * and "you have no reminders". Quieter than the outage this file's counterpart
 * describes, and indistinguishable from an empty account.
 *
 * A composite index is required whenever an equality filter and an ordering
 * name different fields, which is exactly what this looks for.
 */
const ROOT = path.resolve(__dirname, '../../..');
const INDEX_FILE = path.join(ROOT, 'firestore.indexes.json');

type Declared = {collectionGroup: string; queryScope: string; fields: string[]};

function declaredIndexes(): Declared[] {
  const raw = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  return raw.indexes.map((i: any) => ({
    collectionGroup: i.collectionGroup,
    // Absent means COLLECTION — the same default `firebase deploy` applies.
    queryScope: i.queryScope ?? 'COLLECTION',
    fields: i.fields.map((f: any) => f.fieldPath),
  }));
}

function sourceFiles(dir: string): string[] {
  return fs
    .readdirSync(path.join(ROOT, dir), {withFileTypes: true})
    .flatMap(entry => {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(rel);
      return /\.tsx?$/.test(entry.name) ? [rel] : [];
    });
}

/**
 * Maps a collection-ref helper to the collection id it ends at, so a query
 * written against `scheduledRef(chatId)` can be attributed to
 * `scheduledMessages`. Only the last string literal matters: Firestore indexes
 * are keyed by collection id, not by path.
 */
function refHelpers(source: string): Map<string, string> {
  const helpers = new Map<string, string>();
  const pattern = /const (\w+)\s*=\s*\([^)]*\)\s*=>\s*\n?\s*collection\(([^;]*?)\);/g;
  for (const match of source.matchAll(pattern)) {
    const literals = [...match[2].matchAll(/'([^']+)'/g)].map(m => m[1]);
    if (literals.length) helpers.set(match[1], literals[literals.length - 1]);
  }
  return helpers;
}

type Composite = {file: string; collection: string; equality: string; order: string};

/**
 * The text inside a `query(` call, matched by counting parentheses.
 *
 * A regex cannot do this: the first attempt stopped at the closing paren of
 * `scheduledRef(chatId)` and found nothing at all — which is why the first
 * assertion below checks that this parser still sees the two queries it was
 * written for. A guard that silently matches nothing passes every test under
 * it.
 */
function queryBodies(source: string): string[] {
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf('query(', from);
    if (start === -1) return bodies;
    let depth = 0;
    let i = start + 'query'.length;
    for (; i < source.length; i++) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    bodies.push(source.slice(start + 'query('.length, i));
    from = start + 1;
  }
}

/** Every `query(ref, where('a','==',…), orderBy('b'))` in the client. */
function compositeQueries(): Composite[] {
  const found: Composite[] = [];
  for (const file of sourceFiles('src/services')) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const helpers = refHelpers(source);
    for (const body of queryBodies(source)) {
      const where = body.match(/where\(\s*'([^']+)'\s*,\s*'=='/);
      const order = body.match(/orderBy\(\s*'([^']+)'/);
      if (!where || !order || where[1] === order[1]) continue;

      const helperCall = body.match(/^\s*(\w+)\s*\(/);
      const inlineCollection = body.match(/^\s*collection\(([\s\S]*?)\)/);
      let collection: string | undefined;
      if (helperCall && helperCall[1] !== 'collection') {
        collection = helpers.get(helperCall[1]);
      } else if (inlineCollection) {
        const literals = [...inlineCollection[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
        collection = literals[literals.length - 1];
      }
      if (!collection) continue;
      found.push({file, collection, equality: where[1], order: order[1]});
    }
  }
  return found;
}

describe('collection-scoped composite indexes', () => {
  const indexes = declaredIndexes();
  const queries = compositeQueries();

  it('finds the composite queries it is meant to be guarding', () => {
    // A parser that silently matches nothing would make every assertion below
    // pass. Both of these are the ones that were missing an index.
    const pairs = queries.map(q => `${q.collection}:${q.equality}+${q.order}`);
    expect(pairs).toEqual(
      expect.arrayContaining([
        'scheduledMessages:sent+scheduledFor',
        'reminders:sent+remindAt',
      ]),
    );
  });

  it.each(
    // Deduplicated: the same query shape in two files needs one index.
    [...new Map(queries.map(q => [`${q.collection}:${q.equality}+${q.order}`, q])).values()].map(
      q => [`${q.collection} (${q.equality} + ${q.order})`, q] as const,
    ),
  )('%s has a COLLECTION-scoped index', (_label, q) => {
    const match = indexes.find(
      i =>
        i.collectionGroup === q.collection &&
        i.queryScope === 'COLLECTION' &&
        i.fields.includes(q.equality) &&
        i.fields.includes(q.order),
    );
    // A COLLECTION_GROUP index for the same fields does not count, and is the
    // exact mistake this exists to catch — see the note at the top.
    expect(match).toBeDefined();
  });
});
