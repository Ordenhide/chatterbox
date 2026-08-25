/**
 * Every subcollection under `users/{uid}`.
 *
 * Deleting a Firestore document does **not** delete its subcollections — they
 * stay exactly where they are, orphaned but fully live. So account deletion has
 * to name each one, and "delete the profile doc" is not a backstop for a name
 * left off the list.
 *
 * `oneTimePreKeys` was missing, and it is the worst one to miss. Its delete rule
 * is `request.auth.uid == userId`, and deleteAccount removes the auth user the
 * moment the purge returns — so that uid can never sign in again and the
 * documents become permanently unreachable by any client, while `allow read: if
 * isSignedIn()` keeps them readable by everyone. Each carries `createdAt`, and a
 * claimed one carries `claimedAt`: a durable public record of when conversations
 * with a now-deleted person were started. The rules for that collection
 * deliberately refuse to store `claimedBy` for exactly this reason; leaving the
 * documents behind gave back a weaker version of the same metadata.
 *
 * Shared by the purge and the export so the two lists cannot drift apart: a new
 * subcollection added to one path and forgotten in the other is the shape of
 * this whole class of bug.
 */
export const USER_SUBCOLLECTIONS = [
  'bookmarks',
  'reminders',
  'private',
  'publicKeys',
  'oneTimePreKeys',
] as const;

export type UserSubcollection = (typeof USER_SUBCOLLECTIONS)[number];
