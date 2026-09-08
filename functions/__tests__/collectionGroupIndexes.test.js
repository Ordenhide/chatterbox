/**
 * Every collectionGroup query must have an index declared at COLLECTION_GROUP
 * scope.
 *
 * A `COLLECTION`-scoped index looks right in firestore.indexes.json and is
 * accepted by `firebase deploy`, but it cannot serve a collectionGroup query —
 * Firestore rejects the query with code 9, "The query requires an index". The
 * scheduled jobs that ran these queries caught that error, logged it, and
 * returned normally, so every invocation reported `finished with status: 'ok'`
 * while delivering nothing. Scheduled messages sat unsent for over twelve
 * hours before anyone noticed, and reminders and the live-location sweep were
 * failing the same way.
 *
 * Nothing about the deploy, the invocation count, or the function's status
 * distinguishes that state from working. This test does, from the source, so
 * the next one is caught before it ships rather than by someone reporting that
 * a feature quietly does nothing.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'index.js');
const INDEX_FILE = path.join(__dirname, '..', '..', 'firestore.indexes.json');

/**
 * Finds each `collectionGroup('name')` and the `.where('field', …)` calls
 * chained onto it.
 *
 * Deliberately textual. Requiring the functions bundle here would mean loading
 * firebase-admin and its whole initialisation path for what is a question
 * about source code, and the chained-builder shape this looks for is the only
 * way these queries are written in this file.
 */
function collectionGroupQueries(source) {
  const found = [];
  const re = /collectionGroup\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    // The chain runs until the call that executes it. Bounded so an unmatched
    // `.get()` cannot swallow the rest of the file.
    const rest = source.slice(match.index, match.index + 600);
    const end = rest.search(/\.get\(\)|\.stream\(\)|\.onSnapshot\(/);
    const chain = end === -1 ? rest : rest.slice(0, end);
    const fields = [];
    const whereRe = /\.where\(\s*['"]([A-Za-z0-9_.]+)['"]/g;
    let w;
    while ((w = whereRe.exec(chain)) !== null) fields.push(w[1]);
    found.push({
      name: match[1],
      fields,
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return found;
}

const source = fs.readFileSync(SOURCE, 'utf8');
const config = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
const queries = collectionGroupQueries(source);

/** Composite indexes at collection-group scope, by collection. */
function compositeCovers(name, fields) {
  return (config.indexes || []).some(
    index =>
      index.collectionGroup === name &&
      index.queryScope === 'COLLECTION_GROUP' &&
      fields.every(field => (index.fields || []).some(f => f.fieldPath === field)),
  );
}

/** Single-field indexes at collection-group scope, via fieldOverrides. */
function overrideCovers(name, field) {
  return (config.fieldOverrides || []).some(
    override =>
      override.collectionGroup === name &&
      override.fieldPath === field &&
      (override.indexes || []).some(i => i.queryScope === 'COLLECTION_GROUP'),
  );
}

describe('collectionGroup queries are backed by collection-group indexes', () => {
  it('finds the queries at all', () => {
    // Guards the parser itself: if index.js is restructured so the regex stops
    // matching, every assertion below would vacuously pass and this file would
    // silently stop protecting anything.
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every(q => q.fields.length > 0)).toBe(true);
  });

  it.each(queries.map(q => [`${q.name} (index.js:${q.line})`, q]))(
    '%s',
    (_label, query) => {
      const covered =
        query.fields.length > 1
          ? compositeCovers(query.name, query.fields)
          : compositeCovers(query.name, query.fields) ||
            overrideCovers(query.name, query.fields[0]);

      expect({
        collection: query.name,
        fields: query.fields,
        covered,
      }).toEqual({
        collection: query.name,
        fields: query.fields,
        covered: true,
      });
    },
  );
});

describe('the index file itself', () => {
  it('never leaves a group-queried collection with only a collection-scoped index', () => {
    // The specific mistake that caused the outage: the index exists, names the
    // right fields, and is simply scoped wrong. Deploy accepts it, so the only
    // signal is a query failing at runtime.
    //
    // This used to assert something stricter and, it turned out, false — that
    // a collection queried as a group must have *no* COLLECTION-scoped index,
    // on the assumption that group-queried meant group-queried only. It is not:
    // the Cloud Functions sweep every chat's scheduledMessages and every user's
    // reminders as groups, while the clients query one chat's and one user's
    // collection-scoped. Both scopes are needed, and Firestore will not serve
    // one query with the other's index. The stricter version failed the moment
    // the client's missing indexes were added — see
    // src/services/__tests__/collectionIndexes.test.ts, which covers that
    // direction.
    //
    // What is actually wrong is a COLLECTION index standing in for a group one,
    // so that is what this looks for: same collection, same fields, no
    // COLLECTION_GROUP index beside it.
    const grouped = new Set(queries.map(q => q.name));
    const sameFields = (a, b) =>
      a.length === b.length && a.every((f, i) => f === b[i]);
    const indexes = config.indexes || [];
    const fieldsOf = i => (i.fields || []).map(f => f.fieldPath);

    const misscoped = indexes
      .filter(i => grouped.has(i.collectionGroup) && (i.queryScope ?? 'COLLECTION') !== 'COLLECTION_GROUP')
      .filter(
        i =>
          !indexes.some(
            other =>
              other.collectionGroup === i.collectionGroup &&
              other.queryScope === 'COLLECTION_GROUP' &&
              sameFields(fieldsOf(other), fieldsOf(i)),
          ),
      )
      .map(i => `${i.collectionGroup} [${fieldsOf(i).join(', ')}]`);
    expect(misscoped).toEqual([]);
  });
});
