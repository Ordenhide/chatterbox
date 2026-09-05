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
        // No email and no photo. A Google or phone sign-in hands both over and
        // neither is written down — see upsertUserProfile in the mobile
        // client's services/firebaseChat.ts for why.
        displayName: u.displayName || null,
        profileVisibility: 'public',
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
  // (upsertUserProfile). No email and no photo: the rules reject both, and the
  // address stays where a credential belongs — in Firebase Auth.
  await setDoc(
    doc(db, 'users', cred.user.uid),
    {
      uid: cred.user.uid,
      displayName: displayName || null,
      profileVisibility: 'public',
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
  await claimSession(cred.user.uid);
  return cred.user;
}

export function signOut() {
  return fbSignOut(auth);
}

export async function updateDisplayName(displayName: string) {
  if (!auth.currentUser) return;
  await updateProfile(auth.currentUser, {displayName});
  await setDoc(
    doc(db, 'users', auth.currentUser.uid),
    {displayName, updatedAt: serverTimestamp()},
    {merge: true},
  );
}

export async function setProfileVisibility(visibility: 'public' | 'friends' | 'private') {
  if (!auth.currentUser) return;
  await setDoc(
    doc(db, 'users', auth.currentUser.uid),
    {profileVisibility: visibility, updatedAt: serverTimestamp()},
    {merge: true},
  );
}
