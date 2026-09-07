import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type ConfirmationResult,
  type RecaptchaVerifier,
  type UserCredential,
} from 'firebase/auth';
import {doc, serverTimestamp, setDoc} from 'firebase/firestore';
import {auth, db} from '../firebase';
import {credentialsFromSeed, seedFromPhrase} from './anonymousIdentity';
import {adoptSeedAsDeviceKey, markRecoveryPhraseRevealed} from './e2eeKeys';
import {claimSession} from './session';

export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  // Signing in here displaces any session elsewhere: the previous device sees
  // activeSessionId change and signs itself out. Awaited so the app never
  // renders before this browser owns the session.
  await claimSession(cred.user.uid);
  return cred.user;
}

// Shared by signInWithGoogle and confirmPhoneCode below: both are single-step
// credential exchanges that can either sign in an existing account or
// silently create a new one, unlike email/password where sign-in and sign-up
// are separate user-driven actions. Mirrors completeCredentialSignIn in the
// mobile client's AuthContext.
async function completeCredentialSignIn(cred: UserCredential) {
  if (getAdditionalUserInfo(cred)?.isNewUser) {
    const u = cred.user;
    await setDoc(
      doc(db, 'users', u.uid),
      {
        uid: u.uid,
        // No email, no photo, no name. A Google or phone sign-in hands all
        // three over and none is written down — see upsertUserProfile in the
        // mobile client's services/firebaseChat.ts for why, and
        // services/introductions.ts for where the name goes instead.
        updatedAt: serverTimestamp(),
      },
      {merge: true},
    );
  }
  await claimSession(cred.user.uid);
  return cred.user;
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  return completeCredentialSignIn(cred);
}

// Step 1 of phone sign-in: sends the SMS code and hands back the confirmation
// object. The calling screen holds onto it across the user-driven pause until
// they type the code in, then passes it to confirmPhoneCode below — this
// can't be a single call the way Google sign-in is, since there's no way to
// synchronously wait for an SMS. `verifier` is a RecaptchaVerifier the caller
// owns (it's tied to a DOM container, so the component that rendered that
// container has to be the one that creates and eventually clears it).
export async function sendPhoneCode(
  phoneNumber: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function confirmPhoneCode(confirmation: ConfirmationResult, code: string) {
  const cred = await confirmation.confirm(code);
  return completeCredentialSignIn(cred);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function signUp(email: string, password: string, displayName?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  if (displayName) {
    await updateProfile(cred.user, {displayName});
  }
  // Write a users/{uid} doc matching the mobile app's schema
  // (upsertUserProfile). No email, no photo, no name: the rules reject all
  // three, and they stay where credentials belong — in Firebase Auth.
  await setDoc(
    doc(db, 'users', cred.user.uid),
    {
      uid: cred.user.uid,
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
  await claimSession(cred.user.uid);
  return cred.user;
}

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

export function signOut() {
  return fbSignOut(auth);
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
