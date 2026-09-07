import {beforeEach, describe, expect, it, vi} from 'vitest';

/**
 * In-memory localStorage. This environment does not provide one, and relying on
 * the ambient implementation would make the persistence assertions untrustworthy
 * anyway — the session id's stability is the thing under test.
 */
const memoryStorage = (() => {
  let data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = String(v);
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    clear: () => {
      data = {};
    },
  };
})();
vi.stubGlobal('localStorage', memoryStorage);

/**
 * A stand-in for the users/{uid} document, so these tests exercise the
 * single-session decision logic rather than Firestore.
 */
const store: {activeSessionId?: string} = {};
const setDocSpy = vi.fn();
let snapshotHandler: ((snap: {data: () => typeof store}) => void) | null = null;
let snapshotErrorHandler: ((err: {code?: string}) => void) | null = null;
/** null = don't throw; otherwise the error code the server read rejects with. */
let getDocErrorCode: string | null = null;
/** Counts server reads, to prove the cache is bypassed for this decision. */
const getDocFromServerSpy = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({path: path.join('/')}),
  serverTimestamp: () => 'TS',
  // session.ts deliberately uses getDocFromServer, never getDoc: the app runs
  // Firestore with a persistent IndexedDB cache, and a cached activeSessionId
  // must never decide whether to sign someone out. Mocking only this name
  // means a regression back to getDoc fails loudly here rather than silently
  // reading stale data.
  getDocFromServer: async () => {
    getDocFromServerSpy();
    if (getDocErrorCode) {
      const err = new Error(getDocErrorCode) as Error & {code: string};
      err.code = getDocErrorCode;
      throw err;
    }
    return {exists: () => true, data: () => ({...store})};
  },
  setDoc: (ref: unknown, data: Record<string, unknown>, opts: unknown) => {
    setDocSpy(ref, data, opts);
    if (typeof data.activeSessionId === 'string') store.activeSessionId = data.activeSessionId;
    return Promise.resolve();
  },
  onSnapshot: (
    _ref: unknown,
    onNext: (snap: {data: () => typeof store}) => void,
    onError: (err: {code?: string}) => void,
  ) => {
    snapshotHandler = onNext;
    snapshotErrorHandler = onError;
    return () => {
      snapshotHandler = null;
      snapshotErrorHandler = null;
    };
  },
}));
vi.mock('../firebase', () => ({db: {}, auth: {currentUser: null}, functions: {}}));

/**
 * claimSession() calls the same Cloud Function the mobile app uses before
 * ever touching Firestore directly (see session.ts's doc comment) — this
 * stands in for it. Defaults to succeeding, and — mirroring what the real
 * function does server-side via the Admin SDK — updates `store` itself, so
 * the existing "did the claim take" assertions below still mean the same
 * thing whether they observe the function path or the setDoc fallback path.
 */
let claimSessionFnShouldThrow = false;
/** When set, the mocked function waits on this before settling — used to hold
 * a claim open and reproduce the sign-in race deterministically. */
let claimSessionFnGate: Promise<void> | null = null;
const claimSessionFnSpy = vi.fn(async (payload: {sessionId: string}) => {
  if (claimSessionFnGate) await claimSessionFnGate;
  if (claimSessionFnShouldThrow) throw new Error('function unreachable');
  store.activeSessionId = payload.sessionId;
  return {data: {ok: true, sessionId: payload.sessionId}};
});
vi.mock('firebase/functions', () => ({
  httpsCallable: (_functions: unknown, name: string) => {
    if (name !== 'claimSession') throw new Error(`unexpected function: ${name}`);
    return claimSessionFnSpy;
  },
}));

import {
  _resetClaimState,
  claimSession,
  getSessionId,
  listenForSessionTakeover,
  verifyOrAdoptSession,
} from './session';

beforeEach(() => {
  localStorage.clear();
  delete store.activeSessionId;
  setDocSpy.mockClear();
  snapshotHandler = null;
  snapshotErrorHandler = null;
  getDocErrorCode = null;
  getDocFromServerSpy.mockClear();
  claimSessionFnShouldThrow = false;
  claimSessionFnGate = null;
  claimSessionFnSpy.mockClear();
  _resetClaimState();
});

describe('getSessionId', () => {
  it('is stable across calls, so tabs of one browser share a session', () => {
    expect(getSessionId()).toBe(getSessionId());
  });

  it('persists so a reload is recognised as the same session', () => {
    const first = getSessionId();
    expect(localStorage.getItem('cb_web_session')).toBe(first);
  });
});

describe('claimSession', () => {
  it('takes ownership even when another session already holds it', async () => {
    // The whole point: a fresh sign-in displaces the previous device.
    store.activeSessionId = 'someone-elses-device';
    const mine = await claimSession('uid1');
    expect(store.activeSessionId).toBe(mine);
    expect(mine).not.toBe('someone-elses-device');
  });

  it('calls the same claimSession Cloud Function the mobile app uses, not a direct Firestore write', async () => {
    await claimSession('uid1');
    expect(claimSessionFnSpy).toHaveBeenCalledTimes(1);
    expect(claimSessionFnSpy.mock.calls[0][0]).toEqual({sessionId: getSessionId()});
    expect(setDocSpy).not.toHaveBeenCalled();
  });

  it('sends the session id and nothing describing this device', async () => {
    // It used to send a deviceInfo object carrying 120 characters of user
    // agent, which claimSession wrote onto `users/{uid}` — a document any
    // signed-in user who knows the uid can read. Asserted as an exact payload
    // rather than a shape, because the failure mode is a field being *added*
    // back, which toMatchObject would not notice.
    await claimSession('uid1');
    const payload = claimSessionFnSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['sessionId']);
    expect(JSON.stringify(payload)).not.toContain('Mozilla');
  });

  it('falls back to a direct write if the function is unreachable, so sign-in still succeeds', async () => {
    claimSessionFnShouldThrow = true;
    const mine = await claimSession('uid1');
    expect(mine).toBe(getSessionId());
    expect(setDocSpy).toHaveBeenCalledTimes(1);
    const [ref, data] = setDocSpy.mock.calls[0];
    expect((ref as {path: string}).path).toBe('users/uid1');
    expect(data).toMatchObject({activeSessionId: getSessionId()});
    expect(store.activeSessionId).toBe(getSessionId());
  });

  it('stops calling the function once it has proven unreachable, instead of paying the timeout every sign-in', async () => {
    claimSessionFnShouldThrow = true;
    await claimSession('uid1');
    expect(claimSessionFnSpy).toHaveBeenCalledTimes(1);

    await claimSession('uid1');
    expect(claimSessionFnSpy).toHaveBeenCalledTimes(1); // not retried
    expect(setDocSpy).toHaveBeenCalledTimes(2); // but the claim still happened
    expect(store.activeSessionId).toBe(getSessionId());
  });
});

describe('the sign-in race (regression: a fresh login reported itself as displaced)', () => {
  // Firebase fires onAuthStateChanged as soon as signInWithEmailAndPassword
  // resolves — before the claimSession() that follows it in auth.ts has
  // written anything. App.tsx reacts by calling verifyOrAdoptSession, which
  // would read activeSessionId while it still names the *previous* device
  // and report this brand-new sign-in as displaced, bouncing the user
  // straight back to the login screen with "signed in on another device".
  //
  // Harmless while claiming was a fast direct write; a real, every-time
  // failure once the claim started waiting on a Cloud Function.

  it('verifyOrAdoptSession waits for an in-flight claim instead of reading the previous owner', async () => {
    store.activeSessionId = 'previous-device';

    // Hold the claim open, exactly like a Cloud Function that takes seconds.
    let releaseClaim!: () => void;
    claimSessionFnGate = new Promise<void>(resolve => {
      releaseClaim = resolve;
    });

    const claiming = claimSession('uid1');
    // App.tsx's effect fires here, while the claim is still in flight.
    const verifying = verifyOrAdoptSession('uid1');

    releaseClaim();
    await claiming;

    // Must NOT report displacement: this device just claimed the session.
    expect(await verifying).toBe(true);
    expect(store.activeSessionId).toBe(getSessionId());
  });

  it('the takeover listener ignores the previous owner while our own claim is still in flight', async () => {
    store.activeSessionId = 'previous-device';
    const onTakeover = vi.fn();

    let releaseClaim!: () => void;
    claimSessionFnGate = new Promise<void>(resolve => {
      releaseClaim = resolve;
    });

    const claiming = claimSession('uid1');
    listenForSessionTakeover('uid1', onTakeover);

    // A snapshot arrives mid-claim still showing the old device.
    snapshotHandler!({data: () => ({activeSessionId: 'previous-device'})});
    expect(onTakeover).not.toHaveBeenCalled();

    releaseClaim();
    await claiming;
  });

  it('still detects a genuine takeover once the claim has settled', async () => {
    // The guard must not swallow real displacement after sign-in completes.
    await claimSession('uid1');
    const onTakeover = vi.fn();
    listenForSessionTakeover('uid1', onTakeover);
    snapshotHandler!({data: () => ({activeSessionId: 'a-genuinely-newer-device'})});
    expect(onTakeover).toHaveBeenCalledTimes(1);
  });
});

describe('verifyOrAdoptSession', () => {
  it('reports loss of the session when another device owns it', async () => {
    store.activeSessionId = 'other-device';
    expect(await verifyOrAdoptSession('uid1')).toBe(false);
  });

  it('does NOT steal the session back from the device that took it', async () => {
    // A reload must not silently re-claim, or two devices would fight forever.
    store.activeSessionId = 'other-device';
    await verifyOrAdoptSession('uid1');
    expect(store.activeSessionId).toBe('other-device');
  });

  it('adopts an unclaimed account', async () => {
    expect(await verifyOrAdoptSession('uid1')).toBe(true);
    expect(store.activeSessionId).toBe(getSessionId());
  });

  it('keeps the session when it is already ours', async () => {
    store.activeSessionId = getSessionId();
    expect(await verifyOrAdoptSession('uid1')).toBe(true);
  });

  it('reads the authoritative server copy, never the persistent cache', async () => {
    // firebase.ts enables persistentLocalCache, so a plain getDoc could be
    // served instantly from IndexedDB with a pre-sign-in activeSessionId —
    // stale data deciding whether to sign someone out.
    await verifyOrAdoptSession('uid1');
    expect(getDocFromServerSpy).toHaveBeenCalledTimes(1);
  });

  it('does not sign the user out because a read failed', async () => {
    // Being offline is not evidence of a takeover.
    getDocErrorCode = 'unavailable';
    expect(await verifyOrAdoptSession('uid1')).toBe(true);
  });

  it('does not sign the user out on permission-denied either, while the enforcing rules are undeployed', async () => {
    // firestore.rules is written to deny this read for a stale session, which
    // would make this meaningful — but it is not deployed. Until it is, a
    // permission error means something unexpected (e.g. a token that has not
    // propagated on a fresh sign-in), and failing closed on it locks users
    // out of a working app for no security benefit.
    getDocErrorCode = 'permission-denied';
    expect(await verifyOrAdoptSession('uid1')).toBe(true);
  });
});

describe('listenForSessionTakeover', () => {
  it('fires when another device claims the account', () => {
    const onTakeover = vi.fn();
    listenForSessionTakeover('uid1', onTakeover);
    snapshotHandler!({data: () => ({activeSessionId: 'other-device'})});
    expect(onTakeover).toHaveBeenCalledTimes(1);
  });

  it('ignores our own claim', () => {
    const onTakeover = vi.fn();
    listenForSessionTakeover('uid1', onTakeover);
    snapshotHandler!({data: () => ({activeSessionId: getSessionId()})});
    expect(onTakeover).not.toHaveBeenCalled();
  });

  it('ignores a missing or cleared session field', () => {
    const onTakeover = vi.fn();
    listenForSessionTakeover('uid1', onTakeover);
    snapshotHandler!({data: () => ({})});
    expect(onTakeover).not.toHaveBeenCalled();
  });

  it('stops firing once unsubscribed', () => {
    const onTakeover = vi.fn();
    const unsubscribe = listenForSessionTakeover('uid1', onTakeover);
    unsubscribe();
    expect(snapshotHandler).toBeNull();
  });

  it('does not treat any listener error as a takeover — including permission-denied', () => {
    // A listener error is not proof of displacement: on a fresh sign-in it
    // can simply mean the auth token has not reached Firestore yet, and the
    // rules that would make permission-denied meaningful are not deployed.
    // Signing out here would boot a user out of a working session.
    const onTakeover = vi.fn();
    listenForSessionTakeover('uid1', onTakeover);
    snapshotErrorHandler!({code: 'permission-denied'});
    snapshotErrorHandler!({code: 'unavailable'});
    expect(onTakeover).not.toHaveBeenCalled();
  });
});
