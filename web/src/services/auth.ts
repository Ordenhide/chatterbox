import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import {doc, serverTimestamp, setDoc} from 'firebase/firestore';
import {auth, db} from '../firebase';

export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  return cred.user;
}

export async function signUp(email: string, password: string, displayName?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  if (displayName) {
    await updateProfile(cred.user, {displayName});
  }
  // Write a users/{uid} doc matching the mobile app's schema
  // (upsertUserProfile) so the account is discoverable by email and visible
  // to the mobile client.
  await setDoc(
    doc(db, 'users', cred.user.uid),
    {
      uid: cred.user.uid,
      email: normalizedEmail,
      displayName: displayName || null,
      photoURL: null,
      profileVisibility: 'public',
      updatedAt: serverTimestamp(),
    },
    {merge: true},
  );
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
