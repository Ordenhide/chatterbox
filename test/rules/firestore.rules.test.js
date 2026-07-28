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

  it('lets a participant update/delete, denies a non-participant', async () => {
    await seed(db =>
      setDoc(doc(db, 'chats/c1/messages/msg1'), {text: 'hi', user: {_id: 'alice'}}),
    );
    await assertFails(deleteDoc(doc(asUser('mallory'), 'chats/c1/messages/msg1')));
    await assertSucceeds(updateDoc(doc(asUser('bob'), 'chats/c1/messages/msg1'), {reactions: {'👍': ['bob']}}));
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
