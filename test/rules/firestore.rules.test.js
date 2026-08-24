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
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
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
  it('lets any signed-in user read any profile (required for email lookup — see rules comment)', async () => {
    await seed(db => setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'}));
    await assertSucceeds(getDoc(doc(asUser('bob'), 'users/alice')));
  });

  it('denies reads to unauthenticated clients', async () => {
    await seed(db => setDoc(doc(db, 'users/alice'), {email: 'alice@example.com'}));
    await assertFails(getDoc(doc(anon(), 'users/alice')));
  });

  it('lets a user write their own profile', async () => {
    await assertSucceeds(setDoc(doc(asUser('alice'), 'users/alice'), {displayName: 'Alice'}));
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
      setDoc(doc(asUser('alice'), 'friendRequests/req1'), {
        fromId: 'alice',
        toId: 'bob',
        status: 'pending',
      }),
    );
  });

  it('denies creating a request forging someone else as the sender', async () => {
    await assertFails(
      setDoc(doc(asUser('mallory'), 'friendRequests/req1'), {
        fromId: 'alice',
        toId: 'bob',
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
  it('creates only at the canonical pairId, and only naming yourself among userIds', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('alice'), 'friends/alice_bob'), {
        userIds: ['alice', 'bob'],
        status: 'accepted',
      }),
    );
  });

  it('denies creating a friendship between two other users', async () => {
    await assertFails(
      setDoc(doc(asUser('mallory'), 'friends/alice_bob'), {
        userIds: ['alice', 'bob'],
        status: 'accepted',
      }),
    );
  });

  it('denies creating at the wrong (non-canonical) document id', async () => {
    // pairId() sorts lexicographically — "bob_alice" is not the canonical id
    // for {alice, bob}, so this must fail even though alice is a participant.
    await assertFails(
      setDoc(doc(asUser('alice'), 'friends/bob_alice'), {
        userIds: ['alice', 'bob'],
        status: 'accepted',
      }),
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
  it('lets a user create a moment authored as themself, denies authoring as someone else', async () => {
    await assertSucceeds(
      addDoc(collection(asUser('alice'), 'moments'), {authorId: 'alice', visibility: 'public'}),
    );
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

  it('a non-author viewer may bump like/comment counters but not edit content', async () => {
    await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public', likeCount: 0}));
    const bob = asUser('bob');
    await assertSucceeds(updateDoc(doc(bob, 'moments/m1'), {likeCount: 1}));
    await assertFails(updateDoc(doc(bob, 'moments/m1'), {text: 'edited by bob'}));
  });

  it('only the author can delete', async () => {
    await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'}));
    await assertFails(deleteDoc(doc(asUser('bob'), 'moments/m1')));
    await assertSucceeds(deleteDoc(doc(asUser('alice'), 'moments/m1')));
  });

  describe('likes and comments', () => {
    it('lets a user like as themself only', async () => {
      await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'}));
      await assertSucceeds(setDoc(doc(asUser('bob'), 'moments/m1/likes/bob'), {}));
      await assertFails(setDoc(doc(asUser('mallory'), 'moments/m1/likes/bob'), {}));
    });

    it('lets a user comment authored as themself only', async () => {
      await seed(db => setDoc(doc(db, 'moments/m1'), {authorId: 'alice', visibility: 'public'}));
      await assertSucceeds(
        addDoc(collection(asUser('bob'), 'moments/m1/comments'), {authorId: 'bob', text: 'hi'}),
      );
      await expect(
        addDoc(collection(asUser('mallory'), 'moments/m1/comments'), {authorId: 'bob', text: 'hi'}),
      ).rejects.toBeDefined();
    });
  });
});

describe('chats/{chatId}', () => {
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
          viewOnceExpired: true,
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
  // calls, scheduledMessages, sharedLists, expenses, whiteboards, quoteWall,
  // playlist, countdowns all share the identical
  // `allow read, write: if isChatParticipant(chatId);` rule — one
  // parameterized check across all of them rather than eight near-identical
  // blocks, and it still catches a typo'd path in any one of them.
  const subcollections = [
    'calls', 'scheduledMessages', 'sharedLists', 'expenses',
    'whiteboards', 'quoteWall', 'playlist', 'countdowns',
  ];

  beforeEach(async () => {
    await seed(db => setDoc(doc(db, 'chats/c1'), {participants: ['alice', 'bob']}));
  });

  it.each(subcollections)('participant can read/write chats/c1/%s, non-participant cannot', async sub => {
    const alice = asUser('alice');
    const mallory = asUser('mallory');
    await assertSucceeds(setDoc(doc(alice, `chats/c1/${sub}/item1`), {v: 1}));
    await assertSucceeds(getDoc(doc(alice, `chats/c1/${sub}/item1`)));
    await assertFails(setDoc(doc(mallory, `chats/c1/${sub}/item2`), {v: 1}));
    await assertFails(getDoc(doc(mallory, `chats/c1/${sub}/item1`)));
  });

  it('calls/{callId}/candidates inherits the same participant gate', async () => {
    await seed(db => setDoc(doc(db, 'chats/c1/calls/call1'), {status: 'ringing'}));
    await assertSucceeds(
      setDoc(doc(asUser('bob'), 'chats/c1/calls/call1/candidates/cand1'), {sdp: 'x'}),
    );
    await assertFails(
      setDoc(doc(asUser('mallory'), 'chats/c1/calls/call1/candidates/cand2'), {sdp: 'x'}),
    );
  });
});

describe('feedback/{feedbackId}', () => {
  it('any signed-in user can create feedback', async () => {
    await assertSucceeds(addDoc(collection(asUser('alice'), 'feedback'), {text: 'nice app'}));
  });

  it('nobody can read feedback back — write-only, by omission of any read rule', async () => {
    await seed(db => setDoc(doc(db, 'feedback/f1'), {text: 'nice app', authorId: 'alice'}));
    // Even the author who wrote it cannot read it back: there is no `allow
    // read` at all for this collection, so default-deny applies uniformly.
    await assertFails(getDoc(doc(asUser('alice'), 'feedback/f1')));
    await assertFails(getDocs(collection(asUser('alice'), 'feedback')));
  });
});

describe('entitlements/{userId}', () => {
  // This is the paywall. Everything else about Pro (UI locks, catalog flags)
  // is presentation; the only thing actually stopping a user from taking the
  // paid features for free is that they cannot write this document.
  const PAID = {status: 'active', currentPeriodEnd: 4102444800000, priceId: 'price_x'};

  it('lets the owner read their own entitlement', async () => {
    await seed(db => setDoc(doc(db, 'entitlements/alice'), PAID));
    await assertSucceeds(getDoc(doc(asUser('alice'), 'entitlements/alice')));
  });

  it('denies reading someone else\'s entitlement', async () => {
    await seed(db => setDoc(doc(db, 'entitlements/alice'), PAID));
    await assertFails(getDoc(doc(asUser('mallory'), 'entitlements/alice')));
  });

  it('denies an unauthenticated read', async () => {
    await seed(db => setDoc(doc(db, 'entitlements/alice'), PAID));
    await assertFails(getDoc(doc(anon(), 'entitlements/alice')));
  });

  it('denies the OWNER granting themselves Pro — the core paywall assertion', async () => {
    // The attack this rule exists to stop: a signed-in user opens the
    // console and writes their own entitlement. Note this is exactly what
    // /users/{uid} and /users/{uid}/private/* WOULD have allowed, which is
    // why the entitlement lives in its own top-level collection instead.
    await assertFails(setDoc(doc(asUser('alice'), 'entitlements/alice'), PAID));
  });

  it('denies the owner upgrading an existing entitlement (update, not just create)', async () => {
    await seed(db =>
      setDoc(doc(db, 'entitlements/alice'), {status: 'canceled', currentPeriodEnd: 0}),
    );
    // Extending your own expiry is the same exploit as creating one outright.
    await assertFails(
      updateDoc(doc(asUser('alice'), 'entitlements/alice'), {
        status: 'active',
        currentPeriodEnd: 4102444800000,
      }),
    );
  });

  it('denies the owner deleting their entitlement, and denies third-party writes', async () => {
    await seed(db => setDoc(doc(db, 'entitlements/alice'), PAID));
    await assertFails(deleteDoc(doc(asUser('alice'), 'entitlements/alice')));
    await assertFails(setDoc(doc(asUser('mallory'), 'entitlements/alice'), PAID));
  });
});

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
