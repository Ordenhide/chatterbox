/**
 * The name written onto an outgoing message document.
 *
 * `user.displayName || user.email` was the fallback at every one of the ten
 * send paths, and the display name is optional at sign-up — so an account
 * created without one put its owner's email address on every message it ever
 * sent, in the clear, in a document readable by everyone in the chat and by
 * the server.
 *
 * firestore.rules already refuses `email` on a profile document, and says at
 * length why: a real-world identifier readable by anyone who knows your uid is
 * worth more to an attacker than anything else on the record. The message
 * document had no such guard, so the address went round the front.
 *
 * There is no fallback to any real-world identifier here. A user who chose no
 * name does not have one, and the correct thing to show is that.
 */
export function senderName(user: {displayName?: string | null} | null | undefined): string {
  return user?.displayName?.trim() || 'User';
}
