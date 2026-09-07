/**
 * The name a Cloud Function may put on a notification or a message document.
 *
 * Server-side twin of src/utils/senderName.ts, which closed the same hole on
 * the client: `profile.displayName || profile.email` was the fallback, and a
 * display name is optional, so an account without one had its owner's email
 * address written into push notification titles and onto message documents.
 *
 * The functions make it worse than the client did in two ways. They run on the
 * Admin SDK, so firestore.rules — which refuses `email` on a profile document,
 * and explains at length that a real-world identifier readable by anyone who
 * knows your uid is worth more to an attacker than the rest of the record put
 * together — does not apply to them. And a push notification is delivered by
 * Google and rendered on a lock screen, so an address in the title is shown to
 * whoever is looking at the phone.
 *
 * There is no fallback to any real-world identifier here. A profile no longer
 * carries a display name either (the rules refuse that too — a name reaches
 * the other side of a conversation sealed, see services/introductions.ts), so
 * in practice this returns the placeholder. It still reads the field rather
 * than hardcoding the result, because documents written before that rule may
 * still have one, and showing a name its owner chose is the point.
 */
function profileName(profile, fallback) {
  const name = profile && typeof profile.displayName === 'string' ? profile.displayName.trim() : '';
  return name || fallback;
}

module.exports = {profileName};
