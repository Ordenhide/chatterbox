/**
 * Who may remove a comment on a moment: the person who wrote it, or the owner
 * of the post it sits on. Mirrors the delete rule in firestore.rules.
 *
 * Until this shipped, deleteMomentComment had no caller at all — the rules
 * permitted a comment's author to delete it and nothing ever asked, so in the
 * product a comment (anyone's, on anyone's post) could not be removed by
 * anybody. The moment author's half is the one that matters: a comment left on
 * your own post by someone you have since blocked can only be cleared by you,
 * because writing the moment's commentCount needs read access they no longer
 * have.
 *
 * Its own module rather than a function in moments.ts so both the UI and a test
 * can reach it without dragging in Firestore, Storage and an image resizer —
 * and so the web client can hold a byte-identical copy.
 */
export function canDeleteMomentComment(
  comment: {authorId: string},
  momentAuthorId: string,
  myUid: string,
): boolean {
  if (!myUid) return false;
  return comment.authorId === myUid || momentAuthorId === myUid;
}
