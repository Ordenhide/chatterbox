/**
 * Storage security rules, tested against a real emulator running the actual
 * storage.rules file. This file exists specifically because of an incident
 * earlier in this project's history: storage.rules referenced
 * firestore.get(/databases/$(database)/documents/...) — `$(database)` is a
 * path variable that is only bound in *Firestore* rules, not Storage rules,
 * so the whole hasActiveSession()/isChatParticipant() functions threw on
 * every evaluation and every upload was silently denied for 6 months against
 * a bug the repo had already fixed locally but never redeployed. The tests
 * below that exercise a legitimate participant's upload succeeding are the
 * ones that would have caught that regression immediately, the moment it was
 * introduced, instead of via a user-reported error months later.
 */
const {assertFails, assertSucceeds} = require('@firebase/rules-unit-testing');
const {doc, setDoc, Timestamp} = require('firebase/firestore');
const {deleteObject, getBytes, ref, uploadBytes} = require('firebase/storage');
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
  await testEnv.clearStorage();
});

async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async context => fn(context));
}

/** authTimeSecs, if given, becomes the token's auth_time claim — the thing
 * hasCurrentSessionForUid() actually checks. Omit it to get whatever default
 * the library uses (effectively "just authenticated"). */
function asUser(uid, authTimeSecs) {
  const ctx = testEnv.authenticatedContext(uid, authTimeSecs != null ? {auth_time: authTimeSecs} : undefined);
  return ctx.storage();
}

function anon() {
  return testEnv.unauthenticatedContext().storage();
}

const BYTES = new Uint8Array([1, 2, 3]);
const NOW_MS = Date.now();

/**
 * Seeds users/{uid}. `sessionClaimedAtMs` mirrors what the claimSession
 * Cloud Function writes; omitting it (the default) reproduces an account
 * that has never claimed a session, which hasCurrentSessionForUid() must
 * treat as unenforced (fail-open — see storage.rules' comment on why:
 * deploying this check must not retroactively lock out every
 * already-signed-in session).
 */
async function seedUser(uid, {sessionClaimedAtMs} = {}) {
  await seed(context =>
    setDoc(doc(context.firestore(), `users/${uid}`), {
      activeSessionId: 'sess1',
      ...(sessionClaimedAtMs != null ? {sessionClaimedAt: Timestamp.fromMillis(sessionClaimedAtMs)} : {}),
    }),
  );
}

async function seedChat(chatId, participants) {
  await seed(context => setDoc(doc(context.firestore(), `chats/${chatId}`), {participants}));
}

describe('moments/{userId}/{allPaths=**}', () => {
  it('owner whose auth_time matches their claim can upload and read their own moment media', async () => {
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    const alice = asUser('alice', Math.floor(NOW_MS / 1000));
    await assertSucceeds(uploadBytes(ref(alice, 'moments/alice/photo1.jpg'), BYTES));
    await assertSucceeds(getBytes(ref(alice, 'moments/alice/photo1.jpg')));
  });

  it('a different current-session user can read but not write someone else\'s moment media', async () => {
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    await seedUser('bob', {sessionClaimedAtMs: NOW_MS});
    await seed(context => uploadBytes(ref(context.storage(), 'moments/alice/photo1.jpg'), BYTES));
    const bob = asUser('bob', Math.floor(NOW_MS / 1000));
    await assertSucceeds(getBytes(ref(bob, 'moments/alice/photo1.jpg')));
    await assertFails(uploadBytes(ref(bob, 'moments/alice/photo2.jpg'), BYTES));
  });

  it('denies unauthenticated access entirely', async () => {
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    await assertFails(uploadBytes(ref(anon(), 'moments/alice/photo1.jpg'), BYTES));
  });
});

describe('chats/{chatId}/{allPaths=**}', () => {
  it('a participant with a current session can upload chat media — the exact case the $(database) bug broke', async () => {
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    await seedChat('c1', ['alice', 'bob']);
    await assertSucceeds(uploadBytes(ref(asUser('alice', Math.floor(NOW_MS / 1000)), 'chats/c1/voice1.m4a'), BYTES));
  });

  it('a participant with a current session can read chat media', async () => {
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    await seedUser('bob', {sessionClaimedAtMs: NOW_MS});
    await seedChat('c1', ['alice', 'bob']);
    await seed(context => uploadBytes(ref(context.storage(), 'chats/c1/voice1.m4a'), BYTES));
    await assertSucceeds(getBytes(ref(asUser('bob', Math.floor(NOW_MS / 1000)), 'chats/c1/voice1.m4a')));
  });

  it('denies a non-participant even with a current session', async () => {
    await seedUser('mallory', {sessionClaimedAtMs: NOW_MS});
    await seedChat('c1', ['alice', 'bob']);
    await assertFails(uploadBytes(ref(asUser('mallory', Math.floor(NOW_MS / 1000)), 'chats/c1/voice1.m4a'), BYTES));
  });

  it('denies access to a chat that does not exist', async () => {
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    await assertFails(
      uploadBytes(ref(asUser('alice', Math.floor(NOW_MS / 1000)), 'chats/does-not-exist/voice1.m4a'), BYTES),
    );
  });

  it('denies unauthenticated access entirely', async () => {
    await seedChat('c1', ['alice', 'bob']);
    await assertFails(uploadBytes(ref(anon(), 'chats/c1/voice1.m4a'), BYTES));
  });
});

describe('session currency (hasCurrentSessionForUid)', () => {
  it('a displaced device — auth_time well before the latest claim — is denied', async () => {
    // The actual scenario this whole mechanism exists for: alice signed in
    // an hour ago (auth_time = an hour ago) on device A; device B has since
    // claimed the session (sessionClaimedAt = now). A's token is otherwise
    // completely valid — unexpired, correctly signed — but must still be
    // denied here, because a real device in this situation would have
    // silently refreshed that same stale auth_time forward in the background
    // without the user doing anything, and the old naive
    // token.sessionId == activeSessionId check would have let that through.
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    const anHourAgo = Math.floor((NOW_MS - 60 * 60 * 1000) / 1000);
    await assertFails(uploadBytes(ref(asUser('alice', anHourAgo), 'moments/alice/photo1.jpg'), BYTES));
  });

  it('an account that has never claimed a session (no sessionClaimedAt) is not enforced — fail-open by design', async () => {
    // Deploying this check must not retroactively lock out every account
    // that was already signed in before it existed. Enforcement only starts
    // from an account's first claimSession call onward.
    await seedUser('alice'); // no sessionClaimedAtMs
    const longAgo = Math.floor((NOW_MS - 30 * 24 * 60 * 60 * 1000) / 1000);
    await assertSucceeds(uploadBytes(ref(asUser('alice', longAgo), 'moments/alice/photo1.jpg'), BYTES));
  });

  it('auth_time just inside the grace window (network delay between sign-in and claimSession) is allowed', async () => {
    const claimedAt = NOW_MS;
    const authTime = Math.floor((NOW_MS - 90 * 1000) / 1000); // 90s before the claim
    await seedUser('alice', {sessionClaimedAtMs: claimedAt});
    await assertSucceeds(uploadBytes(ref(asUser('alice', authTime), 'moments/alice/photo1.jpg'), BYTES));
  });

  it('auth_time well outside the grace window is denied even though it is "close"', async () => {
    const claimedAt = NOW_MS;
    const authTime = Math.floor((NOW_MS - 10 * 60 * 1000) / 1000); // 10 minutes before the claim
    await seedUser('alice', {sessionClaimedAtMs: claimedAt});
    await assertFails(uploadBytes(ref(asUser('alice', authTime), 'moments/alice/photo1.jpg'), BYTES));
  });

  it('a fresh re-authentication after being displaced is allowed again', async () => {
    // The path back for a legitimately-displaced device: sign in for real
    // (which bumps auth_time), which is exactly what re-triggers claimSession
    // client-side too — this device just becomes the new current session.
    const firstClaim = NOW_MS - 60 * 60 * 1000;
    await seedUser('alice', {sessionClaimedAtMs: firstClaim});
    const staleAuthTime = Math.floor((firstClaim - 60 * 60 * 1000) / 1000);
    await assertFails(uploadBytes(ref(asUser('alice', staleAuthTime), 'moments/alice/photo1.jpg'), BYTES));

    // alice re-authenticates and reclaims.
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    const freshAuthTime = Math.floor(NOW_MS / 1000);
    await assertSucceeds(uploadBytes(ref(asUser('alice', freshAuthTime), 'moments/alice/photo1.jpg'), BYTES));
  });
});

describe('upload ceilings', () => {
  const authTime = () => Math.floor(NOW_MS / 1000);

  async function participant() {
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    await seedChat('c1', ['alice', 'bob']);
    return asUser('alice', authTime());
  }

  it('accepts a normally-sized upload', async () => {
    const alice = await participant();
    await assertSucceeds(
      uploadBytes(ref(alice, 'chats/c1/photo.jpg'), new Uint8Array(64 * 1024), {
        contentType: 'image/jpeg',
      }),
    );
  });

  it('rejects an upload past the ceiling', async () => {
    // Nothing capped size before this, so one participant could push
    // arbitrarily large objects into the bucket. Exercised against the
    // moments ceiling (25 MB) rather than the chat one (200 MB) purely so the
    // test moves a buffer the emulator can handle quickly — it is the same
    // withinSize() check on both paths.
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    const alice = asUser('alice', authTime());
    const overCap = new Uint8Array(25 * 1024 * 1024 + 1024);
    await assertFails(
      uploadBytes(ref(alice, 'moments/alice/huge.jpg'), overCap, {contentType: 'image/jpeg'}),
    );
  });

  it('rejects content types a browser would execute', async () => {
    const alice = await participant();
    for (const contentType of [
      'text/html',
      'text/html; charset=utf-8',
      'image/svg+xml',
      'application/xhtml+xml',
      'text/javascript',
      'application/javascript',
    ]) {
      await assertFails(
        uploadBytes(ref(alice, `chats/c1/x-${contentType.replace(/\W/g, '')}`), BYTES, {contentType}),
      );
    }
  });

  it('still accepts the ordinary media and document types the app sends', async () => {
    // A denylist, not an allowlist: sending arbitrary documents is a feature,
    // so an unusual type must not be what breaks file sharing.
    const alice = await participant();
    for (const contentType of [
      'image/jpeg',
      'image/png',
      'image/heic',
      'video/mp4',
      'video/quicktime',
      'audio/mp4',
      'audio/mpeg',
      'application/pdf',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ]) {
      await assertSucceeds(
        uploadBytes(ref(alice, `chats/c1/ok-${contentType.replace(/\W/g, '')}`), BYTES, {contentType}),
      );
    }
  });

  it('allows an upload with no declared content type', async () => {
    const alice = await participant();
    await assertSucceeds(uploadBytes(ref(alice, 'chats/c1/untyped'), BYTES));
  });

  it('still allows deleting, where request.resource is null', async () => {
    // Every ceiling check reads request.resource, which does not exist on a
    // delete. Without the null guard this would deny all deletion — including
    // the Storage cleanup burnMessage and account deletion depend on.
    const alice = await participant();
    await assertSucceeds(uploadBytes(ref(alice, 'chats/c1/gone.jpg'), BYTES, {contentType: 'image/jpeg'}));
    await assertSucceeds(deleteObject(ref(alice, 'chats/c1/gone.jpg')));
  });

  it('applies the ceiling to moments as well', async () => {
    await seedUser('alice', {sessionClaimedAtMs: NOW_MS});
    const alice = asUser('alice', authTime());
    await assertFails(
      uploadBytes(ref(alice, 'moments/alice/evil.svg'), BYTES, {contentType: 'image/svg+xml'}),
    );
    await assertSucceeds(
      uploadBytes(ref(alice, 'moments/alice/ok.jpg'), BYTES, {contentType: 'image/jpeg'}),
    );
  });
});
