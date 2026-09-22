import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import {doc, serverTimestamp, setDoc} from 'firebase/firestore';
import {auth, db} from '../firebase';
import {credentialsFromSeed, seedFromPhrase} from './anonymousIdentity';
import {adoptSeedAsDeviceKey, markRecoveryPhraseRevealed} from './e2eeKeys';
import {clearMediaCache} from './mediaVault';
import {claimSession} from './session';

/**
 * Thrown when a typed phrase is not a Chatterbox recovery phrase at all —
 * wrong words, wrong order, wrong length. Distinct from a phrase that decodes
 * correctly but names no account, which comes back from Firebase as a
 * credential error, because the two mean different things to the person
 * typing: one is a transcription mistake, the other is the wrong account.
 */
export class UnrecognizedPhraseError extends Error {
  constructor() {
    super('unrecognized recovery phrase');
    this.name = 'UnrecognizedPhraseError';
  }
}

/**
 * Everything a phrase sign-in and a phrase sign-up do identically: adopt the
 * key the phrase encodes, then claim the session.
 *
 * Adoption is awaited and its failure propagates, because for these accounts
 * opening the account and being able to read it are the same act — the seed
 * *is* the account (services/anonymousIdentity.ts). Signing in without the key
 * would leave a browser that looks connected and silently cannot decrypt, and
 * would leave the account advertising nothing for peers to encrypt to. The
 * caller's recovery is to try again, which works because the same phrase
 * always reaches the same account.
 */
async function completePhraseSignIn(cred: UserCredential, seed: Uint8Array) {
  await adoptSeedAsDeviceKey(cred.user.uid, seed);
  await claimSession(cred.user.uid);
  return cred.user;
}

/**
 * Creates the account a freshly generated phrase names.
 *
 * The caller must have shown the phrase and had the user confirm they kept it
 * first. There is no reset email and no support address; an account created
 * before its phrase was written down is already lost.
 *
 * `email-already-in-use` is not an error here. A fresh seed is 256 bits, so it
 * is never a real collision — it means an earlier attempt created the auth
 * account and then failed further along. Signing in instead is what makes the
 * whole path retryable.
 */
export async function createAccount(phrase: string, displayName?: string) {
  const seed = seedFromPhrase(phrase);
  if (!seed) throw new UnrecognizedPhraseError();
  const {address, secret} = credentialsFromSeed(seed);

  let cred: UserCredential;
  try {
    cred = await createUserWithEmailAndPassword(auth, address, secret);
  } catch (error) {
    if ((error as {code?: string})?.code !== 'auth/email-already-in-use') throw error;
    cred = await signInWithEmailAndPassword(auth, address, secret);
  }

  if (displayName) {
    await updateProfile(cred.user, {displayName});
  }
  await completePhraseSignIn(cred, seed);
  // The phrase has just been shown; without this the app opens on a prompt to
  // go and reveal the words the user is still holding.
  markRecoveryPhraseRevealed(cred.user.uid);
  await setDoc(
    doc(db, 'users', cred.user.uid),
    {
      uid: cred.user.uid,
      // No email, no photo, no name — and now no email to leave out either:
      // Firebase Auth holds a random handle under a domain that cannot
      // receive mail. See the mobile client's upsertUserProfile.
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
  return cred.user;
}

/** Opens the account a phrase names, restoring its key in the same step. */
export async function signInWithPhrase(phrase: string) {
  const seed = seedFromPhrase(phrase);
  if (!seed) throw new UnrecognizedPhraseError();
  const {address, secret} = credentialsFromSeed(seed);
  const cred = await signInWithEmailAndPassword(auth, address, secret);
  return completePhraseSignIn(cred, seed);
}

/**
 * Signs out, and drops what was decrypted for the account on the way.
 *
 * The media cache holds plaintext attachment bytes as blob: URLs, which stay
 * valid — and reachable from anything still holding one — for the lifetime of
 * the document. Signing out of this app does not reload the page: App.tsx
 * swaps the tree for the login screen and the document survives, so without
 * this the previous account's decrypted photos were still resolvable in the
 * tab the next person signs in on.
 *
 * clearMediaCache's own docstring said "Called on sign-out" and nothing
 * called it. Mobile does the equivalent in AuthContext's two sign-out paths,
 * plus clearBodies for its persisted message store, which this client has no
 * counterpart to — nothing here survives the tab.
 *
 * Every sign-out goes through this function, including the involuntary one
 * when another device claims the account (App.tsx), because that is the case
 * where leaving readable plaintext behind would be worst.
 */
export async function signOut() {
  try {
    await fbSignOut(auth);
  } finally {
    // In a finally: a failed sign-out is not a reason to keep the plaintext,
    // and revoking object URLs cannot itself fail in a way worth surfacing.
    clearMediaCache();
  }
}

/**
 * Renames the account in Firebase Auth, and nowhere else.
 *
 * It used to mirror the name into `users/{uid}` as well. The rules refuse that
 * now — a display name readable by everyone who knows your uid was the last of
 * the three public identity fields, and it moved to a ciphertext on the chat
 * (services/introductions.ts). Writing it here would fail with
 * permission-denied and lose the rename entirely.
 *
 * The honest limitation: an introduction is sealed once, when an invite is
 * accepted, so renaming yourself does not reach conversations that already
 * exist. The other side keeps whatever they were told, or whatever they chose
 * to call you — which is the name they are actually using either way.
 */
export async function updateDisplayName(displayName: string) {
  if (!auth.currentUser) return;
  await updateProfile(auth.currentUser, {displayName});
}
