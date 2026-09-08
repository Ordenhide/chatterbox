import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {initializeApp, deleteApp} from 'firebase/app';
import {connectAuthEmulator, getAuth, signOut} from 'firebase/auth';
import {connectFirestoreEmulator, doc, getDoc, getFirestore} from 'firebase/firestore';
import {getFunctions} from 'firebase/functions';

/**
 * The one thing the rest of the suite cannot tell you: whether an account can
 * actually be created and signed back into.
 *
 * Everything else about this rewrite is verified against mocks. The Firestore
 * seam is a Map, the auth SDK is a stub, and `anonymousIdentity` is pure. All
 * of that proves the pieces behave — none of it proves that Firebase accepts a
 * credential derived at a `.invalid` domain, that the rules permit the writes
 * sign-in makes, or that the same twenty-four words come back to the same
 * account. Those are the failures that would only appear on a real user's
 * first launch, and they are total: nobody could sign up at all.
 *
 * So this runs the *real* service functions — createAccount, signInWithPhrase,
 * the key adoption underneath them — against the real Auth and Firestore
 * emulators, with the actual firestore.rules loaded. Only the module that
 * hands out the SDK instances is replaced, so the code under test is the code
 * that ships.
 *
 * It is excluded from `vitest run` because it needs those emulators. Run it
 * with `npm run test:auth` from the repository root.
 *
 * It is still not production. What it cannot answer is whether Google's
 * Identity Platform agrees with its own emulator about a `.invalid` address;
 * the first real sign-up remains the test for that.
 */
// jsdom here does not hand out localStorage — the rest of this suite stubs it
// the same way (see appLock.test.ts). e2eeKeys stores the device key through
// it, so the stub has to exist before that module is imported.
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

const PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-chatterbox-auth-test';

const app = initializeApp({apiKey: 'fake-api-key', projectId: PROJECT}, 'integration');
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
connectFirestoreEmulator(db, '127.0.0.1', 8080);

// The only substitution. Every service reaches the SDK through this module,
// so replacing it points the real code at the emulators without touching it.
vi.mock('../firebase', () => ({app, auth, db, functions}));

const {createAccount, signInWithPhrase, signOut: appSignOut, UnrecognizedPhraseError} =
  await import('./auth');
const {newAccountSeed, seedToPhrase, credentialsFromSeed, seedFromPhrase} =
  await import('./anonymousIdentity');
const {getDeviceKeypairIfEnrolled, _resetKeypairCache} = await import('./e2eeKeys');
const {bytesToBase64, bytesToHex} = await import('./crypto');

async function freshPhrase(): Promise<string> {
  return seedToPhrase(newAccountSeed());
}

beforeAll(async () => {
  // Fail loudly rather than time out one assertion at a time.
  const res = await fetch('http://127.0.0.1:9099/').catch(() => null);
  if (!res) throw new Error('auth emulator not reachable — run `npm run test:auth` from the repo root');
});

beforeEach(async () => {
  await signOut(auth).catch(() => undefined);
  localStorage.clear();
  _resetKeypairCache();
});

describe('creating an account from a phrase', () => {
  it('is accepted by Firebase at a .invalid domain', async () => {
    // The assumption the whole rewrite rests on. If Identity Platform rejected
    // the address, nobody could sign up, and no unit test would have said so.
    const phrase = await freshPhrase();
    const user = await createAccount(phrase);
    expect(user.uid).toBeTruthy();
    expect(user.email).toMatch(/^[0-9a-f]{32}@anon\.chatterbox\.invalid$/);
  });

  it('publishes the key the phrase encodes, through the real rules', async () => {
    // adoptSeedAsDeviceKey writes users/{uid}/publicKeys/e2ee. That write is
    // governed by firestore.rules, which the emulator has loaded — so this
    // also proves sign-in is not one rules change away from failing.
    const phrase = await freshPhrase();
    const user = await createAccount(phrase);

    const local = await getDeviceKeypairIfEnrolled(user.uid);
    expect(local).not.toBeNull();

    const snap = await getDoc(doc(db, 'users', user.uid, 'publicKeys', 'e2ee'));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.publicKey).toBe(bytesToBase64(local!.publicKey));
  });

  it('writes a profile document carrying no identifier', async () => {
    const phrase = await freshPhrase();
    const user = await createAccount(phrase);
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.data() ?? {};
    expect(data.uid).toBe(user.uid);
    // The rules refuse these outright; asserted here as well because this is
    // the path that actually runs on a real sign-up.
    for (const field of ['email', 'displayName', 'photoURL', 'deviceInfo']) {
      expect(data[field]).toBeUndefined();
    }
  });

  it('survives being run twice on the same phrase', async () => {
    // The documented recovery for every failure in this path is "try again",
    // which only works because the second attempt finds the account already
    // created and signs in instead.
    const phrase = await freshPhrase();
    const first = await createAccount(phrase);
    await appSignOut();
    _resetKeypairCache();
    const second = await createAccount(phrase);
    expect(second.uid).toBe(first.uid);
  });
});

describe('signing back in', () => {
  it('returns the same account, on a device that has forgotten everything', async () => {
    // The reinstall case, and the one users will actually hit.
    const phrase = await freshPhrase();
    const created = await createAccount(phrase);
    const expected = bytesToHex((await getDeviceKeypairIfEnrolled(created.uid))!.secretKey);

    await appSignOut();
    localStorage.clear();
    _resetKeypairCache();

    const returned = await signInWithPhrase(phrase);
    expect(returned.uid).toBe(created.uid);

    // Same account is not enough: the key has to come back too, or the user is
    // signed in and cannot read a thing.
    const restored = await getDeviceKeypairIfEnrolled(returned.uid);
    expect(bytesToHex(restored!.secretKey)).toBe(expected);
  });

  it('refuses a phrase that is not one of ours before touching the network', async () => {
    await expect(signInWithPhrase('not a recovery phrase at all')).rejects.toBeInstanceOf(
      UnrecognizedPhraseError,
    );
  });

  it('refuses a well-formed phrase that names no account', async () => {
    // Valid BIP39, never registered. Firebase answers with a credential error,
    // which the UI maps to "no account opens with those words".
    const stranger = await freshPhrase();
    await expect(signInWithPhrase(stranger)).rejects.toSatisfy(
      (e: {code?: string}) => typeof e.code === 'string' && e.code.startsWith('auth/'),
    );
  });

  it("does not open one account with another account's phrase", async () => {
    const [a, b] = [await freshPhrase(), await freshPhrase()];
    const first = await createAccount(a);
    await appSignOut();
    _resetKeypairCache();
    const second = await createAccount(b);
    expect(second.uid).not.toBe(first.uid);

    // And the derivation keeps them apart at the credential level too.
    const {address: addressA} = credentialsFromSeed(seedFromPhrase(a)!);
    const {address: addressB} = credentialsFromSeed(seedFromPhrase(b)!);
    expect(addressA).not.toBe(addressB);
  });
});

describe('teardown', () => {
  it('closes the app it opened', async () => {
    await signOut(auth).catch(() => undefined);
    await deleteApp(app).catch(() => undefined);
    expect(true).toBe(true);
  });
});
