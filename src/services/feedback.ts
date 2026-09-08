import {Platform} from 'react-native';
import {addDoc, collection, getFirestore, serverTimestamp} from './firebase/firestore';

const db = getFirestore();

/** Matches the cap in firestore.rules, so the two cannot drift apart. */
export const MAX_FEEDBACK_LENGTH = 4000;

/**
 * Free-text feedback, addressed by uid and nothing else.
 *
 * `email` used to travel with it. Under phrase-based accounts that is the
 * derived login handle (services/anonymousIdentity.ts) — half the credential,
 * and the half stored in plaintext — so writing it here linked a uid to its
 * auth identity in a collection the user can never delete: there is no read,
 * update or delete rule, and account deletion does not sweep it.
 *
 * It bought nothing. `userId` already identifies the account for a reply, and
 * no reply could reach a `.invalid` domain anyway.
 */
export async function submitFeedback(params: {userId: string; message: string}) {
  const {userId, message} = params;
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error('Feedback is empty');
  }
  // Capped to match the rule, so an over-long message fails here with a
  // sentence rather than as permission-denied.
  if (trimmed.length > MAX_FEEDBACK_LENGTH) {
    throw new Error('Feedback is too long');
  }
  await addDoc(collection(db, 'feedback'), {
    userId,
    message: trimmed,
    platform: Platform.OS,
    createdAt: serverTimestamp(),
  });
}

