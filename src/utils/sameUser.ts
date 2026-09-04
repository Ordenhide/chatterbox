import type {User} from '../types';

/**
 * Whether two profiles describe the same user with the same details.
 *
 * Exists so AuthContext can keep the previous object when Firebase hands it a
 * field-for-field identical one. `onAuthStateChanged` fires again on token
 * refresh and on any user reload, and building a fresh object each time gives
 * every consumer a new identity to react to — the chat screen keys four
 * effects off `user`, including the one that opens the message listener,
 * seeds the body cache and runs the decrypt pass.
 *
 * Compares fields rather than serialising: `User` is four scalars, and a
 * JSON.stringify comparison would additionally depend on key order.
 */
export function sameUser(a: User | null, b: User | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.uid === b.uid &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.photoURL === b.photoURL
  );
}
