/**
 * The queries that erase an account must be legal under the rules, at the
 * sizes a real account reaches.
 *
 * This is the same class of check as "purgeChat queries are legal under the
 * rules", and it exists for the same reason: a collection query is evaluated
 * per candidate document, and a rule that reads other documents spends a
 * budget while doing it — 10 document access calls for a single-document
 * request, 20 for a query. Exceed it and Firestore rejects **the whole
 * query**, not the document that tipped it over.
 *
 * What makes that dangerous here rather than merely annoying is the order of
 * operations in deleteAccount (services/account.ts): the sweeps run, their
 * failures are collected into `report.errors` rather than thrown, and then
 * the auth user is deleted. After that nobody can ever sign in as that uid
 * again, so anything a rejected query failed to delete is stranded on the
 * server permanently — while the user has been told their account is gone.
 *
 * `moments` is the case worth pinning. Its read rule is
 * canReadMomentResource(), which is the most expensive rule in the file: it
 * calls isSignedIn() (exists + get on the user document) and isBlocked()
 * twice (one exists each). The feature is deleted and its writes are refused,
 * but read and delete deliberately stay so that account deletion and data
 * export can still reach whatever documents an account accumulated while it
 * existed — which means this query has to keep working for exactly as long as
 * that data can exist.
 */
const {assertFails, assertSucceeds} = require('@firebase/rules-unit-testing');
const {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} = require('firebase/firestore');
const {makeTestEnv} = require('./helpers');

let testEnv;

beforeAll(async () => {
  testEnv = await makeTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async context => fn(context.firestore()));
}

function asUser(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

/** `count` moments authored by `uid`, as the deleted feature left them. */
async function seedMoments(uid, count, visibility = 'friends') {
  await seed(async db => {
    for (let i = 0; i < count; i++) {
      await setDoc(doc(db, `moments/m_${uid}_${i}`), {
        authorId: uid,
        visibility,
        text: `moment ${i}`,
      });
    }
  });
}

/** The query services/account.ts and services/dataExport.ts both run. */
function ownMoments(db, uid) {
  return getDocs(query(collection(db, 'moments'), where('authorId', '==', uid)));
}

describe('the moments sweep in deleteAccount', () => {
  it('finds what it is checking, so a pass is not an empty result set', async () => {
    // Pinned first. A query returning nothing succeeds trivially, and every
    // assertion below would then be about an empty collection.
    await seedMoments('alice', 3);
    const snap = await assertSucceeds(ownMoments(asUser('alice'), 'alice'));
    expect(snap.size).toBe(3);
  });

  it('is legal at one moment', async () => {
    await seedMoments('alice', 1);
    const snap = await assertSucceeds(ownMoments(asUser('alice'), 'alice'));
    expect(snap.size).toBe(1);
  });

  /**
   * The size that matters. If the rule's document reads were charged per
   * candidate document rather than deduplicated across the query, the budget
   * of 20 would be gone after the fifth or sixth document and this would
   * fail — taking every moment in the account with it.
   */
  it('is legal at thirty moments, not just at one', async () => {
    await seedMoments('alice', 30);
    const snap = await assertSucceeds(ownMoments(asUser('alice'), 'alice'));
    expect(snap.size).toBe(30);
  });

  it('stays legal when the author has blocks recorded in both directions', async () => {
    // isBlocked() is consulted twice per document, so an account that has
    // actually used blocking is the case where those exists() calls hit
    // something rather than missing.
    await seed(async db => {
      await setDoc(doc(db, 'blocks/alice_mallory'), {blockerId: 'alice', blockedId: 'mallory'});
      await setDoc(doc(db, 'blocks/mallory_alice'), {blockerId: 'mallory', blockedId: 'alice'});
    });
    await seedMoments('alice', 25);
    const snap = await assertSucceeds(ownMoments(asUser('alice'), 'alice'));
    expect(snap.size).toBe(25);
  });

  it('lets the author delete each one it found', async () => {
    // The query is only half the sweep. Deleting is a single-document write
    // under a cheaper rule, but it is what actually erases the data.
    await seedMoments('alice', 5);
    const snap = await ownMoments(asUser('alice'), 'alice');
    for (const d of snap.docs) {
      await assertSucceeds(deleteDoc(doc(asUser('alice'), 'moments', d.id)));
    }
  });

  it('does not let the same query reach somebody else’s moments', async () => {
    // The counterpart, and not vacuous: alice's own query above succeeds, so
    // this failing is about the filter rather than about reads being off.
    await seedMoments('alice', 3, 'friends');
    await assertFails(ownMoments(asUser('mallory'), 'alice'));
  });
});
