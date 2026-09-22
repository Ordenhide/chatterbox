/**
 * Firestore security rules, tested against a real emulator running the
 * actual firestore.rules file — not a re-implementation of the rules' logic
 * in JS, which would only ever prove the test author read the rules the same
 * way the rules themselves are written, not that the rules do what's
 * intended. `firebase emulators:exec` starts the emulator, runs this file,
 * and tears it down; see package.json's `test:rules` script.
 */
const {
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  arrayRemove,
  arrayUnion,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  updateDoc,
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

/** Writes fixture data directly, bypassing rules — for setting up state a
 * test needs to already exist before exercising the rule under test. */
async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async context => fn(context.firestore()));
}

/** authTimeSecs, if given, becomes the token's auth_time claim. Every test in
 * this file except the "session currency" block below omits it and relies on
 * isSignedIn()'s fail-open default for an account with no sessionClaimedAt
 * seeded — which is every seed() call elsewhere in this file, deliberately,
 * so those tests keep exercising the rule under test rather than session
 * timing. */
function asUser(uid, authTimeSecs) {
  const ctx = testEnv.authenticatedContext(uid, authTimeSecs != null ? {auth_time: authTimeSecs} : undefined);
  return ctx.firestore();
}

function anon() {
  return testEnv.unauthenticatedContext().firestore();
}

describe('users/{userId}', () => {
  it('lets a signed-in user read a profile they can name', async () => {
    await seed(db => setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'}));
    await assertSucceeds(getDoc(doc(asUser('bob'), 'users/alice')));
  });

  /**
   * The directory, closed. `get` and `list` are separate permissions and only
   * the second makes this collection searchable: with it denied, no query
   * returns anyone — which is why getUserByEmail and searchUsersByEmailOrName
   * could be deleted from both clients rather than merely unused.
   *
   * All three shapes are covered because a rule that forgot one would still
   * look closed. The email query is the one that used to power "new chat by
   * email"; the unfiltered list is the one that enumerates everybody.
   */
  it('refuses to let profiles be queried, by email, by name, or at all', async () => {
    await seed(async db => {
      await setDoc(doc(db, 'users/alice'), {email: 'alice@example.com', displayName: 'Alice'});
      await setDoc(doc(db, 'users/bob'), {email: 'bob@example.com', displayName: 'Bob'});
    });
    const bob = asUser('bob');
    await assertFails(getDocs(query(collection(bob, 'users'))));
    await assertFails(
      getDocs(query(collection(bob, 'users'), where('email', '==', 'alice@example.com'))),
    );
    await assertFails(
      getDocs(query(collection(bob, 'users'), where('displayName', '==', 'Alice'))),
    );
  });

  /**
   * `where('__name__', 'in', [...])` is the batch read the mobile client used
   * to use for group member profiles. Firestore evaluates it as a list, so it
   * is refused too — which is why services/firebaseChat.ts now reads those
   * profiles one document at a time. Pinned here so the batch is not
   * reintroduced as an optimisation.
   */
  it('refuses a batch read by document id, even for your own group', async () => {
    await seed(async db => {
      await setDoc(doc(db, 'users/alice'), {displayName: 'Alice'});
      await setDoc(doc(db, 'users/bob'), {displayName: 'Bob'});
    });
    await assertFails(
      getDocs(query(collection(asUser('bob'), 'users'), where('__name__', 'in', ['alice', 'bob']))),
    );
  });

  it('still lets you read your own profile without a current session', async () => {
    // The displaced-client carve-out below. It survives the split into
    // get/list: a client that has been signed out elsewhere still needs to
    // read the one document that tells it so.
    await seed(db => setDoc(doc(db, 'users/alice'), {activeSessionId: 'newer'}));
    await assertSucceeds(getDoc(doc(asUser('alice'), 'users/alice')));
  });

  it('denies reads to unauthenticated clients', async () => {
    await seed(db => setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'}));
    await assertFails(getDoc(doc(anon(), 'users/alice')));
  });

  it('lets a user write their own profile', async () => {
    await assertSucceeds(setDoc(doc(asUser('alice'), 'users/alice'), {profileVisibility: 'public'}));
  });

  describe('identity fields', () => {
    /** A signed-in context carrying a real email claim, as Firebase issues. */
    function asEmailUser(uid, email) {
      return testEnv.authenticatedContext(uid, {email}).firestore();
    }

    it('denies claiming an email the account does not hold', async () => {
      // The impersonation this rule exists for. Mallory sets her profile email
      // to Bob's; a victim searching for Bob's address (searchUsers queries
      // exactly this field) finds Mallory and starts an encrypted chat with
      // her. Trust-on-first-use will not flag it, because a first contact is
      // never flagged. The crypto holds; the identity under it does not.
      const mallory = asEmailUser('mallory', 'mallory@evil.example');
      await assertFails(
        setDoc(doc(mallory, 'users/mallory'), {
          email: 'bob@company.example',
          displayName: 'Bob',
        }),
      );
    });

    /**
     * The address is refused now, not merely validated. Writing your *own*
     * email used to be allowed and is the case that mattered most, since it is
     * what every honest client did — so it is the one pinned here.
     */
    it('denies a new profile carrying an email, even the account\'s own', async () => {
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertFails(
        setDoc(doc(alice, 'users/alice'), {email: 'alice@example.com', displayName: 'Alice'}),
      );
    });

    it('denies a profile carrying a photo URL', async () => {
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertFails(
        setDoc(doc(alice, 'users/alice'), {photoURL: 'https://example.com/a.jpg'}),
      );
    });

    it('denies an empty email as much as a real one — the field is the problem', async () => {
      const phoneUser = testEnv.authenticatedContext('pat', {}).firestore();
      await assertFails(setDoc(doc(phoneUser, 'users/pat'), {email: null, displayName: 'Pat'}));
    });

    it('denies changing an email an old account already has', async () => {
      await seed(db => setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'}));
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertFails(updateDoc(doc(alice, 'users/alice'), {email: 'alice@other.example'}));
    });

    /**
     * The migration path. Both clients write `deleteField()` for these on every
     * sign-in, so an account created before this clears itself the next time
     * its owner opens the app — no server-side backfill, and nothing the user
     * has to do.
     */
    it('allows deleting an email an old account already has', async () => {
      await seed(db =>
        setDoc(doc(db, 'users/alice'), {email: 'alice@example.com', displayName: 'Alice'}),
      );
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertSucceeds(
        setDoc(doc(alice, 'users/alice'), {email: deleteField(), displayName: 'Alice'}, {merge: true}),
      );
    });

    it('denies an account with no email claiming one', async () => {
      const phoneUser = testEnv.authenticatedContext('pat', {}).firestore();
      await assertFails(
        setDoc(doc(phoneUser, 'users/pat'), {email: 'bob@company.example'}),
      );
    });

    it('allows a profile carrying none of the three', async () => {
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertSucceeds(setDoc(doc(alice, 'users/alice'), {profileVisibility: 'public'}));
    });

    /**
     * The name is refused like the address. It could not simply be deleted —
     * a chat list of eight-character uids is not usable — so it moved to the
     * chat, sealed to the one person who needs it
     * (services/introductions.ts). Nothing on the server maps a uid to a
     * person's name any more.
     */
    it('denies a new profile carrying a display name', async () => {
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertFails(setDoc(doc(alice, 'users/alice'), {displayName: 'Alice'}));
    });

    it('allows deleting a display name an old account already has', async () => {
      await seed(db => setDoc(doc(db, 'users/alice'), {displayName: 'Alice', uid: 'alice'}));
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertSucceeds(
        setDoc(doc(alice, 'users/alice'), {displayName: deleteField()}, {merge: true}),
      );
    });

    it('denies a uid that disagrees with the document it sits in', async () => {
      // Anything acting on a profile's own data — adding its owner to a chat,
      // sealing to them — would be redirected at a third party.
      const mallory = asEmailUser('mallory', 'mallory@evil.example');
      await assertFails(setDoc(doc(mallory, 'users/mallory'), {uid: 'bob'}));
    });

    it('allows the matching uid', async () => {
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertSucceeds(setDoc(doc(alice, 'users/alice'), {uid: 'alice'}));
    });

    it('still allows an ordinary update that carries the existing email through', async () => {
      // The realistic write: setDoc(..., {merge: true}) from upsertUserProfile,
      // and updateDoc for an FCM token. Both present the merged document to
      // the rule.
      await seed(db => setDoc(doc(db, 'users/alice'), {email: 'alice@example.com', uid: 'alice'}));
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertSucceeds(updateDoc(doc(alice, 'users/alice'), {fcmToken: 'token-123'}));
    });

    it('still allows deleting the profile', async () => {
      await seed(db => setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'}));
      const alice = asEmailUser('alice', 'alice@example.com');
      await assertSucceeds(deleteDoc(doc(alice, 'users/alice')));
    });
  });

  it('denies writing another user\'s profile — this is the boundary that keeps activeSessionId honest', async () => {
    // If this ever failed, user A could set user B's activeSessionId and
    // forcibly sign B out (or worse, claim B's session) without ever holding
    // B's credentials — the whole single-session mechanism assumes this
    // boundary holds.
    await seed(db => setDoc(doc(db, 'users/bob'), {activeSessionId: 'bobs-real-session'}));
    await assertFails(
      updateDoc(doc(asUser('alice'), 'users/bob'), {activeSessionId: 'attacker-session'}),
    );
  });
});

describe('session currency (isSignedIn / hasCurrentSession) — enforced centrally, probed via users/{userId} reads', () => {
  const NOW_MS = Date.now();

  it('a displaced device — auth_time well before the latest claim — is denied everywhere isSignedIn() gates, not just the session doc itself', async () => {
    // bob is reading alice's profile; it's *bob's* token being evaluated, so
    // this is really "bob's device, displaced an hour ago, tries to do
    // anything at all". The old client-side-only mechanism relied on bob's
    // own listener noticing and signing him out; this is the server-side
    // backstop for when that doesn't happen.
    await seed(async db => {
      await setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'});
      await setDoc(doc(db, 'users/bob'), {sessionClaimedAt: Timestamp.fromMillis(NOW_MS)});
    });
    const anHourAgo = Math.floor((NOW_MS - 60 * 60 * 1000) / 1000);
    await assertFails(getDoc(doc(asUser('bob', anHourAgo), 'users/alice')));
  });

  // The carve-out that makes a displaced session recoverable. Without it,
  // isSignedIn() denied this read too, so listenForSessionTakeover could not
  // read the one document that would tell it it had been displaced — the app
  // just showed a wall of permission-denied instead of signing the user out.
  it('a displaced device can still read its OWN profile, so it can discover it was displaced', async () => {
    await seed(db => setDoc(doc(db, 'users/bob'), {sessionClaimedAt: Timestamp.fromMillis(NOW_MS)}));
    const anHourAgo = Math.floor((NOW_MS - 60 * 60 * 1000) / 1000);
    await assertSucceeds(getDoc(doc(asUser('bob', anHourAgo), 'users/bob')));
  });

  it('the carve-out is read-only — a displaced device cannot reclaim itself by writing', async () => {
    await seed(db => setDoc(doc(db, 'users/bob'), {sessionClaimedAt: Timestamp.fromMillis(NOW_MS)}));
    const anHourAgo = Math.floor((NOW_MS - 60 * 60 * 1000) / 1000);
    await assertFails(
      updateDoc(doc(asUser('bob', anHourAgo), 'users/bob'), {
        sessionClaimedAt: Timestamp.fromMillis(NOW_MS + 60_000),
      }),
    );
  });

  it('the carve-out is your own doc only — it does not reopen other profiles', async () => {
    await seed(async db => {
      await setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'});
      await setDoc(doc(db, 'users/bob'), {sessionClaimedAt: Timestamp.fromMillis(NOW_MS)});
    });
    const anHourAgo = Math.floor((NOW_MS - 60 * 60 * 1000) / 1000);
    await assertFails(getDoc(doc(asUser('bob', anHourAgo), 'users/alice')));
  });

  it('an unauthenticated client gets nothing from the carve-out', async () => {
    await seed(db => setDoc(doc(db, 'users/bob'), {sessionClaimedAt: Timestamp.fromMillis(NOW_MS)}));
    await assertFails(getDoc(doc(anon(), 'users/bob')));
  });

  it('an account that has never claimed a session is not enforced — fail-open by design (no retroactive lockout on deploy)', async () => {
    await seed(db => setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'}));
    // bob has no users/bob doc at all — the "predates this feature entirely"
    // case, not just "hasn't claimed recently".
    const longAgo = Math.floor((NOW_MS - 30 * 24 * 60 * 60 * 1000) / 1000);
    await assertSucceeds(getDoc(doc(asUser('bob', longAgo), 'users/alice')));
  });

  it('auth_time inside the grace window of a fresh claim is allowed', async () => {
    await seed(async db => {
      await setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'});
      await setDoc(doc(db, 'users/bob'), {sessionClaimedAt: Timestamp.fromMillis(NOW_MS)});
    });
    const ninetySecondsAgo = Math.floor((NOW_MS - 90 * 1000) / 1000);
    await assertSucceeds(getDoc(doc(asUser('bob', ninetySecondsAgo), 'users/alice')));
  });

  it('auth_time outside the grace window is denied', async () => {
    await seed(async db => {
      await setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'});
      await setDoc(doc(db, 'users/bob'), {sessionClaimedAt: Timestamp.fromMillis(NOW_MS)});
    });
    const tenMinutesAgo = Math.floor((NOW_MS - 10 * 60 * 1000) / 1000);
    await assertFails(getDoc(doc(asUser('bob', tenMinutesAgo), 'users/alice')));
  });
});

describe('users/{userId}/publicKeys/{keyId} — E2EE key enrollment', () => {
  it('lets any signed-in user read a peer\'s public key (required to encrypt to them)', async () => {
    await seed(db => setDoc(doc(db, 'users/alice/publicKeys/e2ee'), {publicKey: 'abc123'}));
    await assertSucceeds(getDoc(doc(asUser('bob'), 'users/alice/publicKeys/e2ee')));
  });

  it('denies unauthenticated reads', async () => {
    await seed(db => setDoc(doc(db, 'users/alice/publicKeys/e2ee'), {publicKey: 'abc123'}));
    await assertFails(getDoc(doc(anon(), 'users/alice/publicKeys/e2ee')));
  });

  it('lets a user publish their own public key', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('alice'), 'users/alice/publicKeys/e2ee'), {publicKey: 'abc123'}),
    );
  });

  it('denies writing to another user\'s publicKeys — this is the actual MITM boundary', async () => {
    // The whole point of this collection: if anyone besides the owner could
    // write here, they could substitute a key they control and read every
    // message sent to that person. See e2ee.ts's module doc — this rule is
    // the one thing standing between "trust on first use" and "no trust at
    // all", so it gets its own explicit adversarial test rather than relying
    // on the generic users/{userId} test above to imply it.
    await assertFails(
      setDoc(doc(asUser('mallory'), 'users/alice/publicKeys/e2ee'), {publicKey: 'mallory-key'}),
    );
  });
});

describe('users/{userId}/private, reminders, bookmarks — owner-only subcollections', () => {
  const paths = ['private/pushToken', 'reminders/r1', 'bookmarks/b1'];

  it.each(paths)('owner can read and write users/{uid}/%s', async subpath => {
    const db = asUser('alice');
    await assertSucceeds(setDoc(doc(db, `users/alice/${subpath}`), {v: 1}));
    await assertSucceeds(getDoc(doc(db, `users/alice/${subpath}`)));
  });

  it.each(paths)('a different signed-in user cannot read or write users/{uid}/%s', async subpath => {
    await seed(db => setDoc(doc(db, `users/alice/${subpath}`), {v: 1}));
    const bob = asUser('bob');
    await assertFails(getDoc(doc(bob, `users/alice/${subpath}`)));
    await assertFails(setDoc(doc(bob, `users/alice/${subpath}`), {v: 2}));
  });
});

describe('friendRequests/{requestId}', () => {
  it('lets the sender create a pending request naming themself as fromId', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('alice'), 'friendRequests/alice_bob'), {
        fromId: 'alice',
        toId: 'bob',
        status: 'pending',
      }),
    );
  });

  it('denies creating a request forging someone else as the sender', async () => {
    await assertFails(
      setDoc(doc(asUser('mallory'), 'friendRequests/alice_bob'), {
        fromId: 'alice',
        toId: 'bob',
        status: 'pending',
      }),
    );
  });

  it('denies a request at a non-canonical document id', async () => {
    // The friends rule decides consent by looking a request up at the
    // canonical pair id. A request reachable at some other id is a request
    // that lookup can never see, or — worse — one that names a pair the id
    // does not correspond to.
    await assertFails(
      setDoc(doc(asUser('alice'), 'friendRequests/req1'), {
        fromId: 'alice',
        toId: 'bob',
        status: 'pending',
      }),
    );
  });

  it('denies a self-addressed request', async () => {
    await assertFails(
      setDoc(doc(asUser('alice'), 'friendRequests/alice_alice'), {
        fromId: 'alice',
        toId: 'alice',
        status: 'pending',
      }),
    );
  });

  it('denies creating a request to someone who has blocked you', async () => {
    await seed(db => setDoc(doc(db, 'blocks/bob_alice'), {blockerId: 'bob', blockedId: 'alice'}));
    await assertFails(
      setDoc(doc(asUser('alice'), 'friendRequests/req1'), {
        fromId: 'alice',
        toId: 'bob',
        status: 'pending',
      }),
    );
  });

  it('lets sender and recipient read the request, denies a third party', async () => {
    await seed(db =>
      setDoc(doc(db, 'friendRequests/req1'), {fromId: 'alice', toId: 'bob', status: 'pending'}),
    );
    await assertSucceeds(getDoc(doc(asUser('alice'), 'friendRequests/req1')));
    await assertSucceeds(getDoc(doc(asUser('bob'), 'friendRequests/req1')));
    await assertFails(getDoc(doc(asUser('mallory'), 'friendRequests/req1')));
  });

  it('lets the sender read a not-yet-created request (resource == null case, needed for the duplicate check)', async () => {
    await assertSucceeds(getDoc(doc(asUser('alice'), 'friendRequests/does-not-exist')));
  });

  it('lets sender or recipient delete, denies a third party', async () => {
    await seed(db =>
      setDoc(doc(db, 'friendRequests/req1'), {fromId: 'alice', toId: 'bob', status: 'pending'}),
    );
    await assertFails(deleteDoc(doc(asUser('mallory'), 'friendRequests/req1')));
    await assertSucceeds(deleteDoc(doc(asUser('bob'), 'friendRequests/req1')));
  });
});

describe('friends/{friendId}', () => {
  /** A pending request from `from` to `to`, at the canonical pair id. */
  async function seedRequest(from, to) {
    const id = from < to ? `${from}_${to}` : `${to}_${from}`;
    await seed(db =>
      setDoc(doc(db, `friendRequests/${id}`), {fromId: from, toId: to, status: 'pending'}),
    );
  }

  it('denies a friendship nobody asked for', async () => {
    // The vulnerability these rules previously had, and which the test that
    // used to stand here asserted as correct: it created a friendship with no
    // request in existence and expected that to succeed. Both clients refuse
    // to accept a request not addressed to them, but that is client-side only
    // — the document could simply be written directly.
    //
    // Not a cosmetic badge either. isFriend() gates friends-only moments and
    // their images, so this was a way to read another account's posts.
    await assertFails(
      setDoc(doc(asUser('mallory'), 'friends/alice_mallory'), {
        userIds: ['alice', 'mallory'],
        status: 'accepted',
      }),
    );
  });

  it('denies it even when the impersonator sent the request themselves', async () => {
    // Otherwise consent would mean no more than having asked.
    await seedRequest('mallory', 'alice');
    await assertFails(
      setDoc(doc(asUser('mallory'), 'friends/alice_mallory'), {
        userIds: ['alice', 'mallory'],
        status: 'accepted',
      }),
    );
  });

  it('lets the recipient of a pending request create the friendship', async () => {
    await seedRequest('alice', 'mallory');
    await assertSucceeds(
      setDoc(doc(asUser('mallory'), 'friends/alice_mallory'), {
        userIds: ['alice', 'mallory'],
        status: 'accepted',
      }),
    );
  });

  it('denies creating a friendship between two other users', async () => {
    await seedRequest('alice', 'bob');
    await assertFails(
      setDoc(doc(asUser('mallory'), 'friends/alice_bob'), {
        userIds: ['alice', 'bob'],
        status: 'accepted',
      }),
    );
  });

  it('denies creating at the wrong (non-canonical) document id', async () => {
    // pairId() sorts lexicographically — "bob_alice" is not the canonical id
    // for {alice, bob}. The request is seeded so this fails on the id rather
    // than on missing consent.
    await seedRequest('bob', 'alice');
    await assertFails(
      setDoc(doc(asUser('alice'), 'friends/bob_alice'), {
        userIds: ['alice', 'bob'],
        status: 'accepted',
      }),
    );
  });

  it('denies a self-friendship even with a self-addressed request behind it', async () => {
    // Seeded past the rules on purpose. The friendRequests rule now refuses a
    // self-request, so this is checking that the friends rule rejects it too
    // rather than leaning on that — the two constraints fail independently.
    await seed(db =>
      setDoc(doc(db, 'friendRequests/alice_alice'), {
        fromId: 'alice',
        toId: 'alice',
        status: 'pending',
      }),
    );
    await assertFails(
      setDoc(doc(asUser('alice'), 'friends/alice_alice'), {
        userIds: ['alice', 'alice'],
        status: 'accepted',
      }),
    );
  });

  it('denies creation when either party has blocked the other', async () => {
    await seedRequest('alice', 'mallory');
    await seed(db =>
      setDoc(doc(db, 'blocks/alice_mallory'), {blockerId: 'alice', blockedId: 'mallory'}),
    );
    await assertFails(
      setDoc(doc(asUser('mallory'), 'friends/alice_mallory'), {
        userIds: ['alice', 'mallory'],
        status: 'accepted',
      }),
    );
  });

  it('refuses updates, since nothing legitimately edits a friendship', async () => {
    // Unconstrained updates let either party rewrite userIds, leaving a
    // document claiming a pairing its own id contradicts.
    await seed(db =>
      setDoc(doc(db, 'friends/alice_bob'), {userIds: ['alice', 'bob'], status: 'accepted'}),
    );
    await assertFails(
      updateDoc(doc(asUser('alice'), 'friends/alice_bob'), {userIds: ['alice', 'mallory']}),
    );
  });

  it('lets either participant delete, denies a non-participant', async () => {
    await seed(db =>
      setDoc(doc(db, 'friends/alice_bob'), {userIds: ['alice', 'bob'], status: 'accepted'}),
    );
    await assertFails(deleteDoc(doc(asUser('mallory'), 'friends/alice_bob')));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'friends/alice_bob')));
  });
});

describe('blocks/{blockId}', () => {
  it('lets a user create a block naming themself as blocker, at the canonical id', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('alice'), 'blocks/alice_bob'), {blockerId: 'alice', blockedId: 'bob'}),
    );
  });

  it('denies forging someone else as the blocker', async () => {
    await assertFails(
      setDoc(doc(asUser('mallory'), 'blocks/alice_bob'), {blockerId: 'alice', blockedId: 'bob'}),
    );
  });

  it('lets blocker and blocked read it, denies a third party', async () => {
    await seed(db => setDoc(doc(db, 'blocks/alice_bob'), {blockerId: 'alice', blockedId: 'bob'}));
    await assertSucceeds(getDoc(doc(asUser('alice'), 'blocks/alice_bob')));
    await assertSucceeds(getDoc(doc(asUser('bob'), 'blocks/alice_bob')));
    await assertFails(getDoc(doc(asUser('mallory'), 'blocks/alice_bob')));
  });

  it('only the blocker can remove the block — the blocked party cannot unblock themself', async () => {
    await seed(db => setDoc(doc(db, 'blocks/alice_bob'), {blockerId: 'alice', blockedId: 'bob'}));
    await assertFails(deleteDoc(doc(asUser('bob'), 'blocks/alice_bob')));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'blocks/alice_bob')));
  });
});

describe('moments/{momentId}', () => {
  /**
   * Moments is gone from both clients, and the rules now say so.
   *
   * Read and delete survive because account deletion and data export still
   * sweep this collection for whatever an account accumulated while the
   * feature existed — removing those would strand that data on the server,
   * which is the opposite of what deleting an account promises. Every write is
   * refused, because nothing in either client can produce one, and an open
   * `create` on a collection no client touches is not inert: it is writable
   * server storage the app does not know about.
   */
  it('refuses every create, authored as yourself or not', async () => {
    await expect(
      addDoc(collection(asUser('alice'), 'moments'), {authorId: 'alice', visibility: 'public'}),
    ).rejects.toBeDefined();
    await expect(
      addDoc(collection(asUser('alice'), 'moments'), {authorId: 'bob', visibility: 'public'}),
    ).rejects.toBeDefined();
  });

  it('a public moment is readable by anyone signed in, including strangers', async () => {
    await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'}));
    await assertSucceeds(getDoc(doc(asUser('stranger'), 'moments/m1')));
  });

  it('a friends-only moment is denied to a non-friend', async () => {
    await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'friends'}));
    await assertFails(getDoc(doc(asUser('stranger'), 'moments/m1')));
  });

  it('a friends-only moment is readable by an actual friend', async () => {
    await seed(async db => {
      await setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'friends'});
      await setDoc(doc(db, 'friends/alice_bob'), {userIds: ['alice', 'bob'], status: 'accepted'});
    });
    await assertSucceeds(getDoc(doc(asUser('bob'), 'moments/m1')));
  });

  it('blocking overrides even "public" visibility in both directions', async () => {
    // canReadMomentResource() ANDs !isBlocked in both directions onto every
    // branch, including the public one — worth its own test since it is easy
    // to accidentally "fix" by moving the block check inside only the
    // friends-visibility branch.
    await seed(async db => {
      await setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'});
      await setDoc(doc(db, 'blocks/alice_bob'), {blockerId: 'alice', blockedId: 'bob'});
    });
    await assertFails(getDoc(doc(asUser('bob'), 'moments/m1')));
  });

  it('refuses every update, including the author\'s own and a counter bump', async () => {
    await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public', likeCount: 0}));
    await assertFails(updateDoc(doc(asUser('bob'), 'moments/m1'), {likeCount: 1}));
    await assertFails(updateDoc(doc(asUser('bob'), 'moments/m1'), {text: 'edited by bob'}));
    await assertFails(updateDoc(doc(asUser('alice'), 'moments/m1'), {text: 'edited by author'}));
  });

  it('only the author can delete', async () => {
    await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'}));
    await assertFails(deleteDoc(doc(asUser('bob'), 'moments/m1')));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'moments/m1')));
  });

  describe('likes and comments', () => {
    it('refuses new likes and comments outright', async () => {
      await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'}));
      await assertFails(setDoc(doc(asUser('bob'), 'moments/m1/likes/bob'), {}));
      await expect(
        addDoc(collection(asUser('bob'), 'moments/m1/comments'), {authorId: 'bob', text: 'hi'}),
      ).rejects.toBeDefined();
    });

    it('still lets someone remove a like or a comment they left', async () => {
      // Delete stays for the same reason read does: whatever the feature left
      // behind has to remain removable, by its owner and by account deletion.
      await seed(async db => {
        await setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'});
        await setDoc(doc(db, 'moments/m1/likes/bob'), {});
        await setDoc(doc(db, 'moments/m1/comments/c1'), {authorId: 'bob', text: 'hi'});
      });
      await assertSucceeds(deleteDoc(doc(asUser('bob'), 'moments/m1/likes/bob')));
      await assertSucceeds(deleteDoc(doc(asUser('bob'), 'moments/m1/comments/c1')));
    });

    /**
     * A block of six tests lived here, asserting that the visibility model
     * gated *writes* as well as reads — a blocked user could not comment, a
     * stranger could not comment on a private moment, an actual friend still
     * could. It closed a real gap: create once asked only "are you authoring
     * as yourself" and never "are you allowed near this moment at all".
     *
     * Removed with the writes themselves. Four of the six asserted a denial,
     * and every denial is now unconditional — they would have stayed green
     * while proving nothing, which is worse than absent, because a suite of
     * vacuous passes reads as coverage. The other two asserted writes that no
     * longer happen.
     *
     * If Moments returns, these come back with it. The gap they closed is a
     * property of the visibility model, not of this collection, and it will be
     * just as easy to get wrong the second time.
     */

    describe('taking things back', () => {
      // Delete is deliberately not gated on read access: losing access must
      // never strand your own data somewhere you can no longer reach it.
      it('lets me unlike after the moment turns private', async () => {
        await seed(async db => {
          await setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'});
          await setDoc(doc(db, 'moments/m1/likes/bob'), {});
        });
        await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'private'}));
        await assertSucceeds(deleteDoc(doc(asUser('bob'), 'moments/m1/likes/bob')));
      });

      it('lets me delete my own comment after being blocked', async () => {
        await seed(async db => {
          await setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'});
          await setDoc(doc(db, 'moments/m1/comments/c1'), {authorId: 'mallory', text: 'oops'});
          await setDoc(doc(db, 'blocks/alice_mallory'), {blockerId: 'alice', blockedId: 'mallory'});
        });
        await assertSucceeds(deleteDoc(doc(asUser('mallory'), 'moments/m1/comments/c1')));
      });

      it('lets the moment author remove a comment from their own post', async () => {
        // Without this, a comment on your own post could only ever be removed
        // by whoever left it — which, for the case that matters, is nobody.
        await seed(async db => {
          await setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'});
          await setDoc(doc(db, 'moments/m1/comments/c1'), {authorId: 'mallory', text: 'abuse'});
        });
        await assertSucceeds(deleteDoc(doc(asUser('alice'), 'moments/m1/comments/c1')));
      });

      it('does not let a bystander delete somebody else\'s comment', async () => {
        await seed(async db => {
          await setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'});
          await setDoc(doc(db, 'moments/m1/comments/c1'), {authorId: 'bob', text: 'hi'});
        });
        await assertFails(deleteDoc(doc(asUser('mallory'), 'moments/m1/comments/c1')));
      });
    });
  });
});

describe('chats/{chatId}', () => {
  describe('blocking stops a chat starting', () => {
    async function seedBlock(blockerId, blockedId) {
      await seed(db =>
        setDoc(doc(db, `blocks/${blockerId}_${blockedId}`), {blockerId, blockedId}),
      );
    }

    it('denies the blocked party creating the chat', async () => {
      // The app promises exactly this — "You cannot start a chat with this
      // user" — and it was checked in one screen, client-side, and nowhere
      // else, so the blocked party could create the chat directly.
      await seedBlock('alice', 'mallory');
      await assertFails(
        setDoc(doc(asUser('mallory'), 'chats/c-new'), {participants: ['alice', 'mallory']}),
      );
    });

    it('denies the blocker creating it too', async () => {
      // Either direction is a reason not to open the conversation.
      await seedBlock('alice', 'mallory');
      await assertFails(
        setDoc(doc(asUser('alice'), 'chats/c-new'), {participants: ['alice', 'mallory']}),
      );
    });

    it('denies it regardless of which participant is listed first', async () => {
      // The block here is mallory→alice while the array reads
      // ['alice', 'mallory'], so only the second direction catches it. With
      // one direction checked, this is the case that slips through — and the
      // array's order is not something a rule should depend on.
      await seedBlock('mallory', 'alice');
      await assertFails(
        setDoc(doc(asUser('alice'), 'chats/c-new'), {participants: ['alice', 'mallory']}),
      );
    });

    it('allows an ordinary two-party chat', async () => {
      await assertSucceeds(
        setDoc(doc(asUser('alice'), 'chats/c-new'), {participants: ['alice', 'bob']}),
      );
    });

    it('does not apply to group chats', async () => {
      // Blocking someone does not make either of you leave a room you are
      // both already in, and a per-member lookup would run past the
      // document-read limit at the group cap.
      await seedBlock('alice', 'mallory');
      await assertSucceeds(
        setDoc(doc(asUser('alice'), 'chats/c-group'), {
          participants: ['alice', 'mallory', 'bob'],
        }),
      );
    });
  });

  it('lets a participant create a chat naming themself among participants', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('alice'), 'chats/c1'), {participants: ['alice', 'bob']}),
    );
  });

  it('denies creating a chat you are not a participant of', async () => {
    await assertFails(
      setDoc(doc(asUser('mallory'), 'chats/c1'), {participants: ['alice', 'bob']}),
    );
  });

  it('lets participants read/update, denies a non-participant', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob']}));
    await assertSucceeds(getDoc(doc(asUser('alice'), 'chats/c1')));
    await assertFails(getDoc(doc(asUser('mallory'), 'chats/c1')));
    await assertFails(updateDoc(doc(asUser('mallory'), 'chats/c1'), {pinnedBy: ['mallory']}));
    await assertSucceeds(updateDoc(doc(asUser('alice'), 'chats/c1'), {pinnedBy: ['alice']}));
  });

  // `participants` is the access-control list for the fan-out encryption: the
  // sender seals one copy per uid listed here, so whoever can edit this array
  // controls who can read every future message in the chat.
  describe('group membership', () => {
    beforeEach(async () => {
      await seed(db => setDoc(doc(db, 'chats/g1'), {participants: ['alice', 'bob']}));
    });

    it('lets a member add someone to the group', async () => {
      await assertSucceeds(
        updateDoc(doc(asUser('alice'), 'chats/g1'), {participants: ['alice', 'bob', 'carol']}),
      );
    });

    it('lets a member leave by removing only themself', async () => {
      await assertSucceeds(
        updateDoc(doc(asUser('bob'), 'chats/g1'), {participants: ['alice']}),
      );
    });

    // No admin roles exist yet, so "anyone may remove anyone" would be the only
    // available policy — which invites kick-wars and lets one member silently
    // cut everyone else out of a conversation.
    it('denies removing another member', async () => {
      await assertFails(
        updateDoc(doc(asUser('alice'), 'chats/g1'), {participants: ['alice']}),
      );
    });

    it('denies emptying the member list', async () => {
      await assertFails(updateDoc(doc(asUser('alice'), 'chats/g1'), {participants: []}));
    });

    it('denies swapping the whole group out in one write', async () => {
      await assertFails(
        updateDoc(doc(asUser('alice'), 'chats/g1'), {participants: ['alice', 'mallory']}),
      );
    });

    it('denies a non-member adding themself', async () => {
      await assertFails(
        updateDoc(doc(asUser('mallory'), 'chats/g1'), {
          participants: ['alice', 'bob', 'mallory'],
        }),
      );
    });

    // The client caps this too, but a client-side cap is a product guardrail,
    // not a security boundary — anyone can write to Firestore directly.
    it('enforces the 32-member cap on update', async () => {
      const tooMany = ['alice', 'bob', ...Array.from({length: 31}, (_, i) => `u${i}`)];
      expect(tooMany.length).toBeGreaterThan(32);
      await assertFails(updateDoc(doc(asUser('alice'), 'chats/g1'), {participants: tooMany}));
    });

    it('enforces the 32-member cap on create', async () => {
      const tooMany = ['alice', ...Array.from({length: 32}, (_, i) => `u${i}`)];
      await assertFails(setDoc(doc(asUser('alice'), 'chats/g2'), {participants: tooMany}));
    });

    it('allows a group exactly at the cap', async () => {
      const exactly32 = ['alice', ...Array.from({length: 31}, (_, i) => `u${i}`)];
      expect(exactly32.length).toBe(32);
      await assertSucceeds(setDoc(doc(asUser('alice'), 'chats/g3'), {participants: exactly32}));
    });
  });
});

describe('chats/{chatId}/messages/{messageId}', () => {
  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob']}));
  });

  it('a participant can send a message authored as themself', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('alice'), 'chats/c1/messages/msg1'), {
        text: 'hi',
        user: {_id: 'alice'},
      }),
    );
  });

  it('denies impersonating the other participant in a normal message — this is the forgery boundary', async () => {
    await assertFails(
      setDoc(doc(asUser('alice'), 'chats/c1/messages/msg1'), {
        text: 'fake message from bob',
        user: {_id: 'bob'},
      }),
    );
  });

  it('denies a non-participant from reading or writing at all', async () => {
    await seed(db =>
      setDoc(doc(db, 'chats/c1/messages/msg1'), {text: 'hi', user: {_id: 'alice'}}),
    );
    await assertFails(getDoc(doc(asUser('mallory'), 'chats/c1/messages/msg1')));
    await assertFails(
      setDoc(doc(asUser('mallory'), 'chats/c1/messages/msg2'), {text: 'x', user: {_id: 'mallory'}}),
    );
  });

  it('allows the narrow missed-call exception: recipient authors a system notice on the caller\'s behalf', async () => {
    // bob writes a message whose `user._id` is alice (the caller), but it is
    // flagged system + missed and uses the deterministic missed_<id> id —
    // exactly the shape the rule carves out.
    await assertSucceeds(
      setDoc(doc(asUser('bob'), 'chats/c1/messages/missed_call1'), {
        system: true,
        call: {type: 'voice', outcome: 'missed'},
        user: {_id: 'alice'},
      }),
    );
  });

  it('the missed-call exception does not generalize into a blanket impersonation bypass', async () => {
    const cases = [
      // wrong id prefix
      {id: 'msg_not_missed_prefixed', data: {system: true, call: {type: 'voice', outcome: 'missed'}, user: {_id: 'alice'}}},
      // not flagged system
      {id: 'missed_call2', data: {call: {type: 'voice', outcome: 'missed'}, user: {_id: 'alice'}}},
      // outcome isn't "missed"
      {id: 'missed_call3', data: {system: true, call: {type: 'voice', outcome: 'declined'}, user: {_id: 'alice'}}},
      // named "author" isn't even a real participant
      {id: 'missed_call4', data: {system: true, call: {type: 'voice', outcome: 'missed'}, user: {_id: 'mallory'}}},
    ];
    for (const {id, data} of cases) {
      await assertFails(setDoc(doc(asUser('bob'), `chats/c1/messages/${id}`), data));
    }
  });

  it('lets a participant react, denies a non-participant', async () => {
    await seed(db =>
      setDoc(doc(db, 'chats/c1/messages/msg1'), {text: 'hi', user: {_id: 'alice'}}),
    );
    await assertFails(deleteDoc(doc(asUser('mallory'), 'chats/c1/messages/msg1')));
    await assertSucceeds(updateDoc(doc(asUser('bob'), 'chats/c1/messages/msg1'), {reactions: {'👍': ['bob']}}));
  });

  describe('deletion is the author\'s alone', () => {
    beforeEach(async () => {
      await seed(db => setDoc(doc(db, 'chats/c1/messages/msg1'), {text: 'hi', user: {_id: 'alice'}}));
    });

    it('denies bob deleting a message authored by alice', async () => {
      // Irrecoverable for alice specifically: only the deleter can restore
      // from trash, so bob deleting her message removes it from her reach.
      await assertFails(deleteDoc(doc(asUser('bob'), 'chats/c1/messages/msg1')));
    });

    it('lets alice delete her own', async () => {
      await assertSucceeds(deleteDoc(doc(asUser('alice'), 'chats/c1/messages/msg1')));
    });

    it('still lets either side clear the system missed-call notice', async () => {
      // Mirrors the create carve-out: the recipient writes this one on the
      // caller's behalf, so they must be able to remove it too.
      await seed(db =>
        setDoc(doc(db, 'chats/c1/messages/missed_call1'), {
          system: true,
          call: {type: 'voice', outcome: 'missed'},
          user: {_id: 'alice'},
        }),
      );
      await assertSucceeds(deleteDoc(doc(asUser('bob'), 'chats/c1/messages/missed_call1')));
    });

    it('does not let the system carve-out generalize', async () => {
      // A normal message flagged system, or a system message without the
      // deterministic id, must not become deletable by a non-author.
      await seed(db =>
        setDoc(doc(db, 'chats/c1/messages/sys_but_not_missed'), {system: true, user: {_id: 'alice'}}),
      );
      await assertFails(deleteDoc(doc(asUser('bob'), 'chats/c1/messages/sys_but_not_missed')));
    });
  });

  describe('editing someone else\'s message — the same forgery boundary, after the fact', () => {
    const aliceSaid = {text: 'hi', user: {_id: 'alice'}};

    beforeEach(async () => {
      await seed(db => setDoc(doc(db, 'chats/c1/messages/msg1'), aliceSaid));
    });

    it('denies bob rewriting the text of a message authored by alice', async () => {
      // The create rule refuses to let bob publish as alice. Without this, he
      // could publish as himself and then edit — or, as here, edit hers.
      await assertFails(
        updateDoc(doc(asUser('bob'), 'chats/c1/messages/msg1'), {text: 'something alice never said'}),
      );
    });

    it('denies overwriting a sealed message with attacker-chosen plaintext', async () => {
      // The attack E2EE does not stop: a re-sealed forgery fails to decrypt
      // (it is opened with the *sender's* key), but the clients fall back to
      // the plaintext `text` field when no envelope is present, so a plaintext
      // overwrite renders as the victim's own words.
      await seed(db =>
        setDoc(doc(db, 'chats/c1/messages/sealed1'), {
          text: '',
          encrypted: {v: 1, recipients: {}},
          user: {_id: 'alice'},
        }),
      );
      await assertFails(
        updateDoc(doc(asUser('bob'), 'chats/c1/messages/sealed1'), {
          text: 'plaintext put in alice\'s mouth',
          encrypted: null,
        }),
      );
    });

    it('denies smuggling an edit alongside a legitimate reaction', async () => {
      await assertFails(
        updateDoc(doc(asUser('bob'), 'chats/c1/messages/msg1'), {
          reactions: {'👍': ['bob']},
          text: 'edited',
        }),
      );
    });

    it('denies reassigning authorship of an existing message', async () => {
      await assertFails(
        updateDoc(doc(asUser('bob'), 'chats/c1/messages/msg1'), {user: {_id: 'bob'}}),
      );
    });

    it('still lets alice edit her own message', async () => {
      await assertSucceeds(
        updateDoc(doc(asUser('alice'), 'chats/c1/messages/msg1'), {text: 'hi (edited)', editedAt: 1}),
      );
    });
  });

  describe('the recipient-driven carve-outs stay open', () => {
    it('lets the recipient reveal and then burn a burn-after-reading message', async () => {
      await seed(db =>
        setDoc(doc(db, 'chats/c1/messages/burn1'), {
          text: 'secret',
          user: {_id: 'alice'},
          burnAfterReading: {duration: 10},
        }),
      );
      // reveal (starts the countdown)
      await assertSucceeds(
        updateDoc(doc(asUser('bob'), 'chats/c1/messages/burn1'), {
          burnAfterReading: {duration: 10, burnStartedAt: 1},
        }),
      );
      // wipe, exactly as both clients' burnMessage() does
      await assertSucceeds(
        updateDoc(doc(asUser('bob'), 'chats/c1/messages/burn1'), {
          text: '',
          image: null,
          video: null,
          audio: null,
          audioDuration: null,
          file: null,
          burnAfterReading: {burned: true},
        }),
      );
    });

    it('does not let the burn carve-out blank an ordinary message', async () => {
      // The gate is that the message was *sent* as burn-after-reading. Without
      // it, "set burned:true and clear the text" would be a way to destroy
      // anyone's message.
      await seed(db =>
        setDoc(doc(db, 'chats/c1/messages/normal1'), {text: 'hi', user: {_id: 'alice'}}),
      );
      await assertFails(
        updateDoc(doc(asUser('bob'), 'chats/c1/messages/normal1'), {
          text: '',
          burnAfterReading: {burned: true},
        }),
      );
    });

    it('lets the recipient mark a view-once message viewed', async () => {
      await seed(db =>
        setDoc(doc(db, 'chats/c1/messages/vo1'), {
          image: 'https://example.invalid/x.jpg',
          user: {_id: 'alice'},
          viewOnce: true,
        }),
      );
      await assertSucceeds(
        updateDoc(doc(asUser('bob'), 'chats/c1/messages/vo1'), {
          viewOnceViewedBy: ['bob'],
          viewOnceOpenedAt: 1,
        }),
      );
    });

    it('does not let the view-once carve-out apply to a message that is not view-once', async () => {
      await seed(db =>
        setDoc(doc(db, 'chats/c1/messages/normal2'), {text: 'hi', user: {_id: 'alice'}}),
      );
      await assertFails(
        updateDoc(doc(asUser('bob'), 'chats/c1/messages/normal2'), {viewOnceExpired: true}),
      );
    });
  });
});

describe('chat subcollections gated only by isChatParticipant', () => {
  // calls, sharedLists and quoteWall share the identical `allow read, write:
  // if isChatParticipant(chatId);` rule — one parameterized check across all
  // of them rather than three near-identical blocks, and it still catches a
  // typo'd path in any one of them.
  //
  // expenses, whiteboards, playlist and countdowns were on this list until
  // their rules were removed on 2026-09-05. Nothing had written or read them
  // since the features went; the test was asserting that a participant could
  // still write into four collections the app no longer knows about.
  //
  // sharedLists and quoteWall followed them out with f83e2c4 and were left
  // here, which is why this suite has been failing ever since — and why nobody
  // noticed that `moments` still had open write rules. A red suite reports
  // nothing.
  //
  // scheduledMessages used to be on this list and no longer belongs: it
  // carries an author, so it is held to the same "author as yourself" rule as
  // a message and has its own block above. Leaving it here would have
  // asserted that any participant may write one, which is the forgery that
  // block exists to prevent.
  //
  // `calls` left for the same reason, and the list is now empty. A call
  // document carries `createdBy` and a `participants` pair, so it is held to
  // the same standard — see "a call belongs to the two people on it" below.
  // The suite stays for the removed-collection half, which is the part that
  // fails if a rule is re-added for a feature that no longer exists.

  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob']}));
  });

  /**
   * The removed ones, asserted rather than merely dropped from the list above.
   * Deleting a rule and deleting its test together proves nothing; this is the
   * half that says the collections are actually closed, and it fails if anyone
   * re-adds a block for a feature that no longer exists.
   */
  it.each(['countdowns', 'expenses', 'playlist', 'whiteboards'])(
    'denies %s, whose feature was removed',
    async sub => {
      await assertFails(setDoc(doc(asUser('alice'), `chats/c1/${sub}/item1`), {v: 1}));
      await assertFails(getDoc(doc(asUser('alice'), `chats/c1/${sub}/item1`)));
    },
  );

});

/**
 * A call belongs to the two people on it.
 *
 * The rule was `allow read, write: if isChatParticipant(chatId)` for the call
 * and its candidates — the widest one left in this file, and the only place
 * with no notion of an author. In a 32-member group every member could open a
 * call naming someone else as its caller, rewrite or delete a call two other
 * people were on, and inject ICE candidates attributed to either of them.
 *
 * The media was never at risk: that is DTLS-SRTP between the two devices. What
 * was forgeable is the *record*, which is what a missed-call notice is built
 * from, and what was destroyable is a call in progress.
 */
describe('calls belong to their two participants', () => {
  // A 3-person chat, so "chat participant" and "call participant" differ.
  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob', 'mallory']}));
  });

  const ringing = (from, to) => ({
    createdBy: from,
    participants: [from, to],
    status: 'ringing',
    type: 'voice',
  });

  it('lets the caller open a call and the callee answer it', async () => {
    // Pinned first: every denial below would pass vacuously if calling itself
    // were refused, which is how a too-tight rule hides.
    await assertSucceeds(setDoc(doc(asUser('alice'), 'chats/c1/calls/call1'), ringing('alice', 'bob')));
    await assertSucceeds(
      updateDoc(doc(asUser('bob'), 'chats/c1/calls/call1'), {status: 'active'}),
    );
    await assertSucceeds(getDoc(doc(asUser('mallory'), 'chats/c1/calls/call1')));
  });

  it('refuses a call naming somebody else as its caller', async () => {
    // The forgery that reaches the UI: a call record, and then the missed-call
    // system message the other rule lets a recipient write for it.
    await assertFails(
      setDoc(doc(asUser('mallory'), 'chats/c1/calls/call2'), ringing('alice', 'bob')),
    );
  });

  it('refuses a call the caller is not part of', async () => {
    await assertFails(
      setDoc(doc(asUser('mallory'), 'chats/c1/calls/call3'), {
        createdBy: 'mallory',
        participants: ['alice', 'bob'],
        status: 'ringing',
        type: 'voice',
      }),
    );
  });

  it('denies a third chat member rewriting or ending the call', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/calls/call1'), ringing('alice', 'bob')));
    await assertFails(updateDoc(doc(asUser('mallory'), 'chats/c1/calls/call1'), {status: 'ended'}));
    await assertFails(deleteDoc(doc(asUser('mallory'), 'chats/c1/calls/call1')));
  });

  it('denies reassigning the caller on an existing call', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/calls/call1'), ringing('alice', 'bob')));
    await assertFails(
      updateDoc(doc(asUser('bob'), 'chats/c1/calls/call1'), {createdBy: 'bob'}),
    );
  });

  it('lets either participant end their own call', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/calls/call1'), ringing('alice', 'bob')));
    await assertSucceeds(updateDoc(doc(asUser('bob'), 'chats/c1/calls/call1'), {status: 'ended'}));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'chats/c1/calls/call1')));
  });

  describe('candidates', () => {
    beforeEach(async () => {
      await seed(db => setDoc(doc(db, 'chats/c1/calls/call1'), ringing('alice', 'bob')));
    });

    it('lets a sender write a candidate attributed to themselves', async () => {
      await assertSucceeds(
        setDoc(doc(asUser('bob'), 'chats/c1/calls/call1/candidates/c1'), {
          from: 'bob',
          candidate: {candidate: 'x'},
        }),
      );
    });

    it('refuses a candidate attributed to somebody else', async () => {
      await assertFails(
        setDoc(doc(asUser('mallory'), 'chats/c1/calls/call1/candidates/c2'), {
          from: 'alice',
          candidate: {candidate: 'x'},
        }),
      );
    });

    it('refuses a candidate that says nothing about who sent it', async () => {
      // The old rule accepted `{sdp: 'x'}` from anyone in the chat.
      await assertFails(
        setDoc(doc(asUser('mallory'), 'chats/c1/calls/call1/candidates/c3'), {sdp: 'x'}),
      );
    });

    it('never lets a candidate be edited after the fact', async () => {
      await seed(db =>
        setDoc(doc(db, 'chats/c1/calls/call1/candidates/c4'), {from: 'alice', candidate: {}}),
      );
      await assertFails(
        updateDoc(doc(asUser('alice'), 'chats/c1/calls/call1/candidates/c4'), {candidate: {x: 1}}),
      );
    });

    it('lets any participant sweep spent candidates', async () => {
      // Deliberately wider than the writes: cleanup runs from whichever side
      // ends the call, and a narrower rule would strand them.
      await seed(db =>
        setDoc(doc(db, 'chats/c1/calls/call1/candidates/c5'), {from: 'alice', candidate: {}}),
      );
      await assertSucceeds(
        deleteDoc(doc(asUser('mallory'), 'chats/c1/calls/call1/candidates/c5')),
      );
    });

    it('denies a non-participant of the chat entirely', async () => {
      await assertFails(
        setDoc(doc(asUser('stranger'), 'chats/c1/calls/call1/candidates/c6'), {
          from: 'stranger',
          candidate: {},
        }),
      );
      await assertFails(getDoc(doc(asUser('stranger'), 'chats/c1/calls/call1/candidates/c5')));
    });
  });
});

describe('feedback/{feedbackId}', () => {
  const VALID = {userId: 'alice', message: 'nice app', platform: 'ios', createdAt: 1};

  it('accepts a well-formed submission from its own author', async () => {
    await assertSucceeds(addDoc(collection(asUser('alice'), 'feedback'), VALID));
  });

  it('refuses a document with any field it does not expect', async () => {
    // The rule this replaces was `allow create: if isSignedIn()`, which took
    // any document of any size with any fields. The client was sending the
    // account's derived login handle alongside the uid — an auth identity
    // written in plaintext into a collection nobody can delete from. hasOnly()
    // is what stops that from being a client-side promise.
    await assertFails(
      addDoc(collection(asUser('alice'), 'feedback'), {...VALID, email: 'a@b.invalid'}),
    );
    await assertFails(addDoc(collection(asUser('alice'), 'feedback'), {...VALID, extra: 1}));
  });

  it('refuses feedback attributed to someone else', async () => {
    await assertFails(addDoc(collection(asUser('alice'), 'feedback'), {...VALID, userId: 'bob'}));
  });

  it('caps the message, so this is not unbounded storage', async () => {
    await assertFails(
      addDoc(collection(asUser('alice'), 'feedback'), {...VALID, message: 'x'.repeat(4001)}),
    );
    await assertSucceeds(
      addDoc(collection(asUser('alice'), 'feedback'), {...VALID, message: 'x'.repeat(4000)}),
    );
  });

  it('refuses an empty message and a non-string one', async () => {
    await assertFails(addDoc(collection(asUser('alice'), 'feedback'), {...VALID, message: ''}));
    await assertFails(addDoc(collection(asUser('alice'), 'feedback'), {...VALID, message: 42}));
  });

  it('refuses an unauthenticated write', async () => {
    await assertFails(addDoc(collection(anon(), 'feedback'), VALID));
  });

  it('nobody can read feedback back — write-only, by omission of any read rule', async () => {
    await seed(db => setDoc(doc(db, 'feedback/f1'), {userId: 'alice', message: 'nice app'}));
    // Even the author who wrote it cannot read it back: there is no `allow
    // read` at all for this collection, so default-deny applies uniformly.
    await assertFails(getDoc(doc(asUser('alice'), 'feedback/f1')));
    await assertFails(getDocs(collection(asUser('alice'), 'feedback')));
  });
});

/*
 * The entitlements suite lived here — six tests around the Pro paywall,
 * removed with the collection itself in af4d5f6.
 *
 * Worth recording how it failed, because it is the same shape as the Moments
 * hole this commit closes. Exactly one of the six went red when the rules were
 * deleted: the one that asserted the owner *could* read their entitlement. The
 * other five asserted denials, and a collection with no rules at all denies
 * everything — so five tests kept passing while testing nothing, and the one
 * honest failure sat in a suite nobody was running.
 */

describe('chats/{chatId}/trash/{messageId} — recently deleted messages', () => {
  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob']}));
  });

  const trashed = (uid) => ({
    text: 'the deleted message',
    user: {_id: 'alice'},
    deletedBy: uid,
    deletedAt: Date.now(),
  });

  it('lets a participant move their own deletion into the trash', async () => {
    await assertSucceeds(setDoc(doc(asUser('alice'), 'chats/c1/trash/m1'), trashed('alice')));
  });

  it('denies creating a trash entry attributed to someone else', async () => {
    // Otherwise Bob could stash a message into Alice's trash and read it back
    // through her ownership rule.
    await assertFails(setDoc(doc(asUser('bob'), 'chats/c1/trash/m1'), trashed('alice')));
  });

  it('THE KEY ASSERTION: the other participant cannot read a deleted message', async () => {
    // This is what keeps "delete for everyone" honest. If Bob could read
    // Alice's trash, a recoverable delete would just be a UI illusion.
    await seed(db => setDoc(doc(db, 'chats/c1/trash/m1'), trashed('alice')));
    await assertFails(getDoc(doc(asUser('bob'), 'chats/c1/trash/m1')));
  });

  it('lets the deleter read their own trashed message back', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/trash/m1'), trashed('alice')));
    await assertSucceeds(getDoc(doc(asUser('alice'), 'chats/c1/trash/m1')));
  });

  it('lets the deleter remove it — recovering or purging', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/trash/m1'), trashed('alice')));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'chats/c1/trash/m1')));
  });

  it('denies the other participant purging it', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/trash/m1'), trashed('alice')));
    await assertFails(deleteDoc(doc(asUser('bob'), 'chats/c1/trash/m1')));
  });

  it('denies editing a trashed message, so what is recovered is what was deleted', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/trash/m1'), trashed('alice')));
    await assertFails(
      setDoc(doc(asUser('alice'), 'chats/c1/trash/m1'), {...trashed('alice'), text: 'tampered'}),
    );
  });

  it('denies a non-participant entirely', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/trash/m1'), trashed('alice')));
    await assertFails(getDoc(doc(asUser('mallory'), 'chats/c1/trash/m1')));
    await assertFails(setDoc(doc(asUser('mallory'), 'chats/c1/trash/m1'), trashed('mallory')));
  });

  it('denies unauthenticated access', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/trash/m1'), trashed('alice')));
    await assertFails(getDoc(doc(anon(), 'chats/c1/trash/m1')));
  });
});

describe('messageReports/{reportId} — the counterpart to author-only deletion', () => {
  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob']}));
  });

  const report = (over = {}) => ({
    reporterUid: 'bob',
    chatId: 'c1',
    messageId: 'msg1',
    authorUid: 'alice',
    reason: 'harassment',
    content: 'the message bob saw',
    createdAt: 1,
    ...over,
  });

  it('lets a participant file a report', async () => {
    await assertSucceeds(setDoc(doc(asUser('bob'), 'messageReports/r1'), report()));
  });

  it('denies filing a report under someone else\'s name', async () => {
    await assertFails(
      setDoc(doc(asUser('bob'), 'messageReports/r1'), report({reporterUid: 'alice'})),
    );
  });

  it('denies reporting from a chat the reporter is not in', async () => {
    // Otherwise the collection becomes a way to file reports about
    // conversations the reporter cannot even see.
    await assertFails(setDoc(doc(asUser('mallory'), 'messageReports/r1'), report({reporterUid: 'mallory'})));
  });

  it('is write-only: nobody can read, edit, or delete a report', async () => {
    await seed(db => setDoc(doc(db, 'messageReports/r1'), report()));
    // Readable would leak who has been reported; editable or deletable would
    // let a reported user erase the report about them.
    await assertFails(getDoc(doc(asUser('bob'), 'messageReports/r1')));
    await assertFails(getDoc(doc(asUser('alice'), 'messageReports/r1')));
    await assertFails(updateDoc(doc(asUser('alice'), 'messageReports/r1'), {reason: 'nothing'}));
    await assertFails(deleteDoc(doc(asUser('alice'), 'messageReports/r1')));
  });

  it('bounds the attached content so a report cannot be used as free storage', async () => {
    await assertFails(
      setDoc(doc(asUser('bob'), 'messageReports/r1'), report({content: 'x'.repeat(4001)})),
    );
    await assertFails(
      setDoc(doc(asUser('bob'), 'messageReports/r2'), report({reason: 'y'.repeat(41)})),
    );
  });

  it('accepts a report with no attached content', async () => {
    // Sending the decrypted copy is a real disclosure, so declining it must
    // still leave the report filable.
    const {content: _omitted, ...withoutContent} = report();
    await assertSucceeds(setDoc(doc(asUser('bob'), 'messageReports/r3'), withoutContent));
  });
});

describe('users/{userId}/oneTimePreKeys/{preKeyId} — forward-secrecy handshake', () => {
  const preKey = (over = {}) => ({publicKey: 'cHVi', claimed: false, createdAt: 1, ...over});

  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'users/alice/oneTimePreKeys/k1'), preKey()));
  });

  it('lets the owner publish their own batch', async () => {
    await assertSucceeds(setDoc(doc(asUser('alice'), 'users/alice/oneTimePreKeys/k2'), preKey()));
  });

  it('denies anyone else creating prekeys in your name', async () => {
    // Otherwise a peer could plant a prekey whose secret they hold and read
    // the first message of every conversation started against it.
    await assertFails(setDoc(doc(asUser('bob'), 'users/alice/oneTimePreKeys/k3'), preKey()));
  });

  it('lets a peer read and claim an unclaimed prekey', async () => {
    await assertSucceeds(getDoc(doc(asUser('bob'), 'users/alice/oneTimePreKeys/k1')));
    await assertSucceeds(
      updateDoc(doc(asUser('bob'), 'users/alice/oneTimePreKeys/k1'), {claimed: true, claimedAt: 2}),
    );
  });

  it('denies claiming one that is already claimed', async () => {
    // The property the whole collection exists for: two peers must never
    // receive the same one-time prekey.
    await seed(db => setDoc(doc(db, 'users/alice/oneTimePreKeys/k1'), preKey({claimed: true})));
    await assertFails(
      updateDoc(doc(asUser('bob'), 'users/alice/oneTimePreKeys/k1'), {claimed: true, claimedAt: 3}),
    );
  });

  it('denies un-claiming a key', async () => {
    await seed(db => setDoc(doc(db, 'users/alice/oneTimePreKeys/k1'), preKey({claimed: true})));
    await assertFails(
      updateDoc(doc(asUser('bob'), 'users/alice/oneTimePreKeys/k1'), {claimed: false}),
    );
  });

  it('denies a claimer changing the key material itself', async () => {
    // A claim that could also rewrite publicKey would let any peer substitute
    // a prekey they hold the secret for — the substitution the signature on
    // the signed prekey exists to stop, arriving by another door.
    await assertFails(
      updateDoc(doc(asUser('bob'), 'users/alice/oneTimePreKeys/k1'), {
        claimed: true,
        publicKey: 'YXR0YWNrZXI=',
      }),
    );
  });

  it('denies a non-owner deleting prekeys', async () => {
    await assertFails(deleteDoc(doc(asUser('bob'), 'users/alice/oneTimePreKeys/k1')));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'users/alice/oneTimePreKeys/k1')));
  });

  it('denies unauthenticated access entirely', async () => {
    await assertFails(getDoc(doc(anon(), 'users/alice/oneTimePreKeys/k1')));
    await assertFails(updateDoc(doc(anon(), 'users/alice/oneTimePreKeys/k1'), {claimed: true}));
  });
});

describe('chats/{chatId}/senderKeys/{id} — group forward-secrecy distributions', () => {
  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob', 'carol']}));
  });

  const dist = (from, to) => ({from, to, chainId: 'chain1', envelope: {alg: 'x'}, updatedAt: 1});

  it('lets a member publish a distribution addressed from themselves', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('alice'), 'chats/c1/senderKeys/alice__bob'), dist('alice', 'bob')),
    );
  });

  it('denies publishing one that claims to be from someone else', async () => {
    // Otherwise a member could plant a chain key of their own and have their
    // messages accepted as another member's.
    await assertFails(
      setDoc(doc(asUser('bob'), 'chats/c1/senderKeys/alice__carol'), dist('alice', 'carol')),
    );
  });

  it('lets only the addressee read a distribution', async () => {
    // A chain key opens every group message that sender goes on to write, so
    // a rule letting any participant read any distribution would hand one
    // member everyone else's keys.
    await seed(db => setDoc(doc(db, 'chats/c1/senderKeys/alice__bob'), dist('alice', 'bob')));
    await assertSucceeds(getDoc(doc(asUser('bob'), 'chats/c1/senderKeys/alice__bob')));
    await assertFails(getDoc(doc(asUser('carol'), 'chats/c1/senderKeys/alice__bob')));
  });

  it('lets the sender read back their own, to check what a member already holds', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/senderKeys/alice__bob'), dist('alice', 'bob')));
    await assertSucceeds(getDoc(doc(asUser('alice'), 'chats/c1/senderKeys/alice__bob')));
  });

  it('denies a non-participant entirely', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/senderKeys/alice__bob'), dist('alice', 'bob')));
    await assertFails(getDoc(doc(asUser('mallory'), 'chats/c1/senderKeys/alice__bob')));
    await assertFails(
      setDoc(doc(asUser('mallory'), 'chats/c1/senderKeys/mallory__bob'), dist('mallory', 'bob')),
    );
  });

  it('lets only the sender delete, which is what rotation does', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/senderKeys/alice__bob'), dist('alice', 'bob')));
    await assertFails(deleteDoc(doc(asUser('bob'), 'chats/c1/senderKeys/alice__bob')));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'chats/c1/senderKeys/alice__bob')));
  });

  it('denies a member overwriting a distribution addressed to them', async () => {
    // Rewriting the envelope they were sent would let a member swap in a
    // chain key they control and attribute messages to the sender.
    await seed(db => setDoc(doc(db, 'chats/c1/senderKeys/alice__bob'), dist('alice', 'bob')));
    await assertFails(
      setDoc(doc(asUser('bob'), 'chats/c1/senderKeys/alice__bob'), dist('alice', 'bob')),
    );
  });
});

describe('chats/{chatId}/scheduledMessages/{msgId}', () => {
  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'mallory']}));
  });

  it('denies scheduling a message authored as somebody else', async () => {
    // The forgery this rule exists for. processScheduledMessages copies a
    // scheduled document into chats/{id}/messages with the Admin SDK, which
    // does not consult rules — so scheduling was a way around the author
    // check the messages rule enforces so carefully.
    await assertFails(
      setDoc(doc(asUser('mallory'), 'chats/c1/scheduledMessages/forged'), {
        text: 'I quit.',
        user: {_id: 'alice', name: 'Alice'},
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
  });

  it('allows scheduling your own message', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('mallory'), 'chats/c1/scheduledMessages/mine'), {
        text: 'later',
        user: {_id: 'mallory'},
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
  });

  it('denies scheduling with no author at all', async () => {
    await assertFails(
      setDoc(doc(asUser('mallory'), 'chats/c1/scheduledMessages/anon'), {
        text: 'later',
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
  });

  it('denies a non-participant scheduling anything', async () => {
    await assertFails(
      setDoc(doc(asUser('eve'), 'chats/c1/scheduledMessages/x'), {
        text: 'hi',
        user: {_id: 'eve'},
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
  });

  it('denies rewriting another participant\'s pending message', async () => {
    // The same forgery with an extra step.
    await seed(db =>
      setDoc(doc(db, 'chats/c1/scheduledMessages/hers'), {
        text: 'see you at six',
        user: {_id: 'alice'},
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
    await assertFails(
      updateDoc(doc(asUser('mallory'), 'chats/c1/scheduledMessages/hers'), {text: 'I quit.'}),
    );
  });

  it('denies taking over another participant\'s pending message', async () => {
    // Rewriting it *as yourself*. The result is attributed correctly, so it is
    // not forgery — but it silently destroys a message somebody else queued,
    // and it is the case where checking only the incoming author is not
    // enough. The existing document has to be checked too.
    await seed(db =>
      setDoc(doc(db, 'chats/c1/scheduledMessages/hers'), {
        text: 'see you at six',
        user: {_id: 'alice'},
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
    await assertFails(
      updateDoc(doc(asUser('mallory'), 'chats/c1/scheduledMessages/hers'), {
        text: 'cancelled',
        user: {_id: 'mallory'},
      }),
    );
  });

  it('lets the author edit their own', async () => {
    await seed(db =>
      setDoc(doc(db, 'chats/c1/scheduledMessages/mine'), {
        text: 'later',
        user: {_id: 'mallory'},
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(asUser('mallory'), 'chats/c1/scheduledMessages/mine'), {text: 'much later'}),
    );
  });

  it('denies deleting another participant\'s pending message', async () => {
    await seed(db =>
      setDoc(doc(db, 'chats/c1/scheduledMessages/hers'), {
        text: 'see you at six',
        user: {_id: 'alice'},
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
    await assertFails(deleteDoc(doc(asUser('mallory'), 'chats/c1/scheduledMessages/hers')));
  });

  it('lets the author cancel their own', async () => {
    await seed(db =>
      setDoc(doc(db, 'chats/c1/scheduledMessages/mine'), {
        text: 'later',
        user: {_id: 'mallory'},
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
    await assertSucceeds(deleteDoc(doc(asUser('mallory'), 'chats/c1/scheduledMessages/mine')));
  });

  it('still lets any participant read them', async () => {
    await seed(db =>
      setDoc(doc(db, 'chats/c1/scheduledMessages/hers'), {
        text: 'later',
        user: {_id: 'alice'},
        scheduledFor: Date.now(),
        sent: false,
      }),
    );
    await assertSucceeds(getDoc(doc(asUser('mallory'), 'chats/c1/scheduledMessages/hers')));
  });
});

describe('view-once marking', () => {
  async function seedViewOnce(viewedBy) {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob', 'mallory']}));
    await seed(db =>
      setDoc(doc(db, 'chats/c1/messages/m1'), {
        text: '',
        image: 'https://example/x.jpg',
        viewOnce: true,
        viewOnceViewedBy: viewedBy,
        user: {_id: 'alice'},
      }),
    );
  }

  it('lets a viewer record their own view', async () => {
    await seedViewOnce([]);
    await assertSucceeds(
      updateDoc(doc(asUser('bob'), 'chats/c1/messages/m1'), {
        viewOnceViewedBy: ['bob'],
        viewOnceOpenedAt: Timestamp.now(),
      }),
    );
  });

  /**
   * The flag that says "the media is gone" belongs to the Cloud Function,
   * because only the Admin SDK can make it true — nulling image/video/audio is
   * not a write the rules above permit a client at all. A client that could
   * set it would be announcing a burn it had not performed, and the media
   * would stay downloadable at its URL.
   *
   * In a group it is worse than a false claim: both clients read
   * `viewOnceExpired` as expired-for-everyone, so the first member to open the
   * photo would spend every other member's single view.
   *
   * This is the hole the web client was walking through until it started
   * calling the function (web/src/services/chat.ts). The rule allowed the
   * write, so it succeeded, and view-once burned nothing.
   */
  it('denies a viewer setting viewOnceExpired, even alongside their own view', async () => {
    await seedViewOnce([]);
    await assertFails(
      updateDoc(doc(asUser('bob'), 'chats/c1/messages/m1'), {
        viewOnceViewedBy: ['bob'],
        viewOnceExpired: true,
      }),
    );
  });

  it('denies clearing viewOnceExpired to get a burned message back', async () => {
    await seedViewOnce(['bob', 'mallory']);
    await assertFails(
      updateDoc(doc(asUser('bob'), 'chats/c1/messages/m1'), {viewOnceExpired: false}),
    );
  });

  it('denies recording somebody else as having viewed', async () => {
    // Burns another participant's one view without them ever seeing it.
    await seedViewOnce([]);
    await assertFails(
      updateDoc(doc(asUser('mallory'), 'chats/c1/messages/m1'), {viewOnceViewedBy: ['bob']}),
    );
  });

  it('denies adding yourself and somebody else at once', async () => {
    await seedViewOnce([]);
    await assertFails(
      updateDoc(doc(asUser('mallory'), 'chats/c1/messages/m1'), {
        viewOnceViewedBy: ['mallory', 'bob'],
      }),
    );
  });

  it('denies expiring a message nobody has opened', async () => {
    await seedViewOnce([]);
    await assertFails(
      updateDoc(doc(asUser('mallory'), 'chats/c1/messages/m1'), {viewOnceExpired: true}),
    );
  });

  it('denies removing an existing viewer, which would hand back a second view', async () => {
    await seedViewOnce(['bob']);
    await assertFails(
      updateDoc(doc(asUser('mallory'), 'chats/c1/messages/m1'), {viewOnceViewedBy: ['mallory']}),
    );
  });

  it('preserves earlier viewers when adding yourself', async () => {
    await seedViewOnce(['bob']);
    await assertSucceeds(
      updateDoc(doc(asUser('mallory'), 'chats/c1/messages/m1'), {
        viewOnceViewedBy: ['bob', 'mallory'],
      }),
    );
  });

  /**
   * A view can be marked with `arrayUnion(uid)` rather than by writing the
   * whole array. The rule compares `request.resource.data.viewOnceViewedBy` as
   * a set, which only works because Firestore applies array transforms
   * *before* rules evaluate — so the rule sees the resulting array, not a
   * sentinel.
   *
   * That is not obvious from reading either side, which is why it is checked
   * against a real emulator rather than reasoned about. No client takes this
   * shape today: both go through the markViewOnceViewed Cloud Function, which
   * writes with the Admin SDK and is not subject to these rules at all. The
   * carve-out stays because it is the rule that lets a *client* record its own
   * view without the function, and it should keep behaving correctly whether
   * the array is written whole or unioned onto.
   */
  describe('an arrayUnion write', () => {
    it('is accepted, transform and all', async () => {
      await seedViewOnce([]);
      await assertSucceeds(
        setDoc(
          doc(asUser('mallory'), 'chats/c1/messages/m1'),
          {
            viewOnceViewedBy: arrayUnion('mallory'),
            viewOnceOpenedAt: Timestamp.now(),
          },
          {merge: true},
        ),
      );
    });

    it('cannot be pointed at somebody else through the transform', async () => {
      await seedViewOnce([]);
      await assertFails(
        setDoc(
          doc(asUser('mallory'), 'chats/c1/messages/m1'),
          {viewOnceViewedBy: arrayUnion('bob'), viewOnceOpenedAt: Timestamp.now()},
          {merge: true},
        ),
      );
    });

    it('keeps an earlier viewer when unioning onto a non-empty list', async () => {
      await seedViewOnce(['bob']);
      await assertSucceeds(
        setDoc(
          doc(asUser('mallory'), 'chats/c1/messages/m1'),
          {viewOnceViewedBy: arrayUnion('mallory')},
          {merge: true},
        ),
      );
    });
  });

  it('still refuses these fields on a message that is not view-once', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'mallory']}));
    await seed(db =>
      setDoc(doc(db, 'chats/c1/messages/m2'), {text: 'hi', user: {_id: 'alice'}}),
    );
    await assertFails(
      updateDoc(doc(asUser('mallory'), 'chats/c1/messages/m2'), {viewOnceViewedBy: ['mallory']}),
    );
  });
});

/**
 * The queries account.ts's purgeChat() runs to erase what a departing user owns
 * inside each chat, before `participants: arrayRemove(uid)` costs them access.
 *
 * These are worth an emulator test rather than a unit test because the thing
 * that can go wrong is not the rule's logic — it's Firestore's *query*
 * evaluation. A collection query is rejected outright unless the rules can
 * prove, from the query's constraints alone, that every document it could
 * return is readable. A `where` clause on the same field the read rule tests is
 * what supplies that proof. Get it wrong and the purge does not fail loudly at
 * review time; it throws at runtime, gets swallowed into report.errors, and the
 * data stays behind forever, because deleteAccount removes the auth user
 * moments later and nothing can reach it again.
 */
describe('purgeChat queries are legal under the rules', () => {
  beforeEach(async () => {
    await seed(async db => {
      await setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'mallory']});
      await setDoc(doc(db, 'chats/c1/scheduledMessages/s1'), {
        text: 'later', user: {_id: 'alice'}, scheduledFor: Date.now(), sent: false,
      });
      await setDoc(doc(db, 'chats/c1/scheduledMessages/s2'), {
        text: 'hers', user: {_id: 'mallory'}, scheduledFor: Date.now(), sent: false,
      });
      await setDoc(doc(db, 'chats/c1/trash/t1'), {deletedBy: 'alice', text: 'oops'});
      await setDoc(doc(db, 'chats/c1/trash/t2'), {deletedBy: 'mallory', text: 'hers'});
      await setDoc(doc(db, 'chats/c1/senderKeys/k1'), {from: 'alice', to: 'mallory', key: 'x'});
      await setDoc(doc(db, 'chats/c1/senderKeys/k2'), {from: 'mallory', to: 'alice', key: 'y'});
      await setDoc(doc(db, 'chats/c1/liveLocations/alice'), {encryptedPosition: {c: 'x'}});
    });
  });

  const mine = (path, field) =>
    query(collection(asUser('alice'), path), where(field, '==', 'alice'), limit(200));

  it('lets me query my own scheduled messages', async () => {
    const snap = await assertSucceeds(getDocs(mine('chats/c1/scheduledMessages', 'user._id')));
    expect(snap.docs.map(d => d.id)).toEqual(['s1']);
  });

  it('lets me query my own trash, which an unfiltered read is refused', async () => {
    const snap = await assertSucceeds(getDocs(mine('chats/c1/trash', 'deletedBy')));
    expect(snap.docs.map(d => d.id)).toEqual(['t1']);
    // The filter is load-bearing, not decoration: without it the rule cannot be
    // proved and the whole query is rejected.
    await assertFails(getDocs(collection(asUser('alice'), 'chats/c1/trash')));
  });

  it('lets me query the sender keys I wrote, despite the rule being an OR', async () => {
    // read is `to == uid || from == uid`. Filtering on one side of a disjunction
    // still proves the whole condition, but it is exactly the kind of thing that
    // is easier to assume than to verify.
    const snap = await assertSucceeds(getDocs(mine('chats/c1/senderKeys', 'from')));
    expect(snap.docs.map(d => d.id)).toEqual(['k1']);
    await assertFails(getDocs(collection(asUser('alice'), 'chats/c1/senderKeys')));
  });

  it('lets me delete my own live-location document and not somebody else\'s', async () => {
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'chats/c1/liveLocations/alice')));
    await seed(db => setDoc(doc(db, 'chats/c1/liveLocations/mallory'), {encryptedPosition: {c: 'y'}}));
    await assertFails(deleteDoc(doc(asUser('alice'), 'chats/c1/liveLocations/mallory')));
  });

  it('refuses all of it once the uid is out of participants', async () => {
    // Why the ordering in purgeChat is not negotiable: this is the state the
    // user is in one line later, and it is permanent.
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['mallory']}));
    await assertFails(getDocs(mine('chats/c1/trash', 'deletedBy')));
    await assertFails(deleteDoc(doc(asUser('alice'), 'chats/c1/liveLocations/alice')));
  });
});

/**
 * users/{uid}/oneTimePreKeys survives account deletion unless the purge names
 * it: `allow read: if isSignedIn()` keeps it visible to everyone, while delete
 * needs `request.auth.uid == userId` — a uid that, once the auth user is gone,
 * can never sign in again.
 */
describe('users/{uid}/oneTimePreKeys deletion window', () => {
  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'users/alice/oneTimePreKeys/p1'), {
      publicKey: 'AAAA', claimed: true, claimedAt: Timestamp.now(),
    }));
  });

  it('is deletable only by its owner, and only while they can still sign in', async () => {
    await assertFails(deleteDoc(doc(asUser('mallory'), 'users/alice/oneTimePreKeys/p1')));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'users/alice/oneTimePreKeys/p1')));
  });

  it('stays readable by any signed-in user, which is what makes leftovers matter', async () => {
    const snap = await assertSucceeds(getDoc(doc(asUser('mallory'), 'users/alice/oneTimePreKeys/p1')));
    expect(snap.data().claimedAt).toBeDefined();
  });

  it('survives deletion of the profile document', async () => {
    // Firestore does not cascade: removing users/alice leaves its
    // subcollections in place, which is the whole reason the purge has to
    // enumerate them.
    await seed(db => setDoc(doc(db, 'users/alice'), {uid: 'alice'}));
    await seed(db => deleteDoc(doc(db, 'users/alice')));
    const snap = await assertSucceeds(getDoc(doc(asUser('mallory'), 'users/alice/oneTimePreKeys/p1')));
    expect(snap.exists()).toBe(true);
  });
});


/**
 * The sweep leaveAndClearOwnContent() runs before a user leaves a chat.
 *
 * "Delete chat" used to sweep the whole messages collection and then delete the
 * chat document, while the dialog promised to remove the history "for all
 * participants". The rules had already made that impossible — a message may be
 * deleted only by its author — so the sweep hit the other person's first
 * message and the whole operation failed with permission-denied. What is left
 * is this: take your own content with you, then go.
 *
 * The ordering is the part worth pinning down. Every rule involved is gated on
 * still being a participant, so leaving first does not merely skip the cleanup,
 * it makes the cleanup impossible afterwards — the content stays in a
 * conversation the user believes they erased themselves from.
 */
describe('leaving a chat and taking your own content with you', () => {
  beforeEach(async () => {
    await seed(async db => {
      await setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob']});
      await setDoc(doc(db, 'chats/c1/messages/a1'), {text: 'mine', user: {_id: 'alice'}});
      await setDoc(doc(db, 'chats/c1/messages/a2'), {text: 'mine too', user: {_id: 'alice'}});
      await setDoc(doc(db, 'chats/c1/messages/b1'), {text: 'his', user: {_id: 'bob'}});
      await setDoc(doc(db, 'chats/c1/scheduledMessages/s1'), {
        text: 'later', user: {_id: 'alice'}, scheduledFor: Date.now(), sent: false,
      });
    });
  });

  const myMessages = () =>
    query(
      collection(asUser('alice'), 'chats/c1/messages'),
      where('user._id', '==', 'alice'),
      limit(300),
    );

  it('selects only my own messages, and deletes every one of them', async () => {
    const snap = await assertSucceeds(getDocs(myMessages()));
    expect(snap.docs.map(d => d.id).sort()).toEqual(['a1', 'a2']);
    for (const d of snap.docs) {
      await assertSucceeds(deleteDoc(doc(asUser('alice'), `chats/c1/messages/${d.id}`)));
    }
  });

  it("leaves the other participant's message where it is", async () => {
    // The old implementation's failure, kept as an assertion: this is the
    // document the unfiltered sweep died on.
    await assertFails(deleteDoc(doc(asUser('alice'), 'chats/c1/messages/b1')));
  });

  it('lets me cancel what I had scheduled, so it cannot fire after I leave', async () => {
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'chats/c1/scheduledMessages/s1')));
  });

  it('THE ORDERING: once I have left, I can no longer delete any of it', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser('alice'), 'chats/c1'), {participants: arrayRemove('alice')}),
    );
    await assertFails(deleteDoc(doc(asUser('alice'), 'chats/c1/messages/a1')));
    await assertFails(deleteDoc(doc(asUser('alice'), 'chats/c1/scheduledMessages/s1')));
    // Not even readable any more, so nothing could enumerate what was missed.
    await assertFails(getDocs(myMessages()));
  });
});

describe('invites/{token} — the capability that replaced email lookup', () => {
  const FUTURE = () => Date.now() + 60 * 60 * 1000;
  const live = (over = {}) => ({
    inviterUid: 'alice',
    inviterKey: 'AAAAkey',
    expiresAt: FUTURE(),
    acceptedBy: null,
    ...over,
  });

  /**
   * The whole access model. `get` is allowed because knowing the 32-byte token
   * *is* the authorisation; `list` must not be, because a rule that permitted
   * it would let any signed-in user read every pending invite — a directory
   * again, which is the thing this collection exists to remove.
   */
  it('lets someone who knows the token read it', async () => {
    await seed(db => setDoc(doc(db, 'invites/tok1'), live()));
    await assertSucceeds(getDoc(doc(asUser('bob'), 'invites/tok1')));
  });

  it('refuses to let the collection be listed', async () => {
    await seed(db => setDoc(doc(db, 'invites/tok1'), live()));
    await assertFails(getDocs(query(collection(asUser('bob'), 'invites'))));
  });

  it('denies an unauthenticated reader even with the token', async () => {
    await seed(db => setDoc(doc(db, 'invites/tok1'), live()));
    await assertFails(getDoc(doc(anon(), 'invites/tok1')));
  });

  it('lets a user mint an invite for themselves', async () => {
    await assertSucceeds(setDoc(doc(asUser('alice'), 'invites/mine'), live()));
  });

  it('denies minting one in someone else\'s name', async () => {
    await assertFails(
      setDoc(doc(asUser('mallory'), 'invites/forged'), live({inviterUid: 'alice'})),
    );
  });

  // A name here would put a plaintext profile field back on the server, which
  // is what removing the email directory was for.
  it('denies an invite carrying fields beyond the fixed set', async () => {
    await assertFails(
      setDoc(doc(asUser('alice'), 'invites/extra'), live({displayName: 'Alice'})),
    );
  });

  it('denies an invite that never expires', async () => {
    await assertFails(
      setDoc(doc(asUser('alice'), 'invites/forever'), live({expiresAt: Date.now() + 400 * 24 * 3600 * 1000})),
    );
    await assertFails(setDoc(doc(asUser('alice'), 'invites/nan'), live({expiresAt: 'soon'})));
  });

  it('denies an invite born already accepted', async () => {
    await assertFails(
      setDoc(doc(asUser('alice'), 'invites/pre'), live({acceptedBy: 'bob'})),
    );
  });

  describe('accepting', () => {
    it('lets the holder claim it once', async () => {
      await seed(db => setDoc(doc(db, 'invites/tok2'), live()));
      await assertSucceeds(updateDoc(doc(asUser('bob'), 'invites/tok2'), {acceptedBy: 'bob'}));
    });

    /**
     * Single use is enforced here rather than in the client, because the client
     * is the party holding a link it may have found rather than been given.
     */
    it('denies a second claim', async () => {
      await seed(db => setDoc(doc(db, 'invites/used'), live({acceptedBy: 'bob'})));
      await assertFails(updateDoc(doc(asUser('carol'), 'invites/used'), {acceptedBy: 'carol'}));
    });

    it('denies claiming an expired invite', async () => {
      await seed(db =>
        setDoc(doc(db, 'invites/old'), live({expiresAt: Date.now() - 1000})),
      );
      await assertFails(updateDoc(doc(asUser('bob'), 'invites/old'), {acceptedBy: 'bob'}));
    });

    it('denies claiming it on behalf of someone else', async () => {
      await seed(db => setDoc(doc(db, 'invites/tok3'), live()));
      await assertFails(updateDoc(doc(asUser('mallory'), 'invites/tok3'), {acceptedBy: 'bob'}));
    });

    /**
     * The substitution this closes. Without pinning the key, whoever claims an
     * invite could rewrite the public key it points at — and the inviter would
     * open a chat believing they were sealed to their own device.
     */
    it('denies rewriting the key or the inviter while claiming', async () => {
      await seed(db => setDoc(doc(db, 'invites/tok4'), live()));
      await assertFails(
        updateDoc(doc(asUser('bob'), 'invites/tok4'), {acceptedBy: 'bob', inviterKey: 'ZZZZ'}),
      );
      await assertFails(
        updateDoc(doc(asUser('bob'), 'invites/tok4'), {acceptedBy: 'bob', inviterUid: 'mallory'}),
      );
      await assertFails(
        updateDoc(doc(asUser('bob'), 'invites/tok4'), {
          acceptedBy: 'bob',
          expiresAt: Date.now() + 400 * 24 * 3600 * 1000,
        }),
      );
    });
  });

  it('lets the inviter withdraw their own link, and nobody else', async () => {
    await seed(db => setDoc(doc(db, 'invites/tok5'), live()));
    await assertFails(deleteDoc(doc(asUser('bob'), 'invites/tok5')));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'invites/tok5')));
  });
});
