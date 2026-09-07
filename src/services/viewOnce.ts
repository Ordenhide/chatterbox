/**
 * Recording that a view-once message has been opened.
 *
 * This client did not do it. It rendered the "View once photo" placeholder,
 * opened the image when tapped, and wrote nothing — so `viewOnceViewedBy`
 * never gained the viewer, the placeholder came back on the next render, and
 * the media could be opened again indefinitely. The feature looked like it
 * worked and did nothing at all, which for a privacy control is worse than
 * not offering it.
 *
 * The Cloud Function it should have been calling already existed
 * (functions/index.js, markViewOnceViewed) and is the right place for this to
 * live rather than a direct write: it runs with the Admin SDK, so it is what
 * can actually null the media out of the document once everyone has seen it —
 * a client cannot be trusted to do that on its own behalf, and a client that
 * simply declines to call anything is exactly the case this cannot defend
 * against anyway.
 *
 * ## What view-once can and cannot promise
 *
 * It records and burns. It cannot stop a screenshot, a second device pointed
 * at the screen, or a modified client that reads the URL and never reports
 * the view. Nothing client-side ever can. What it does do is make the honest
 * path honest, and remove the media server-side once its audience has seen it.
 */
import {getFunctions, httpsCallable} from './firebase/functions';
import {reportError} from './errorLog';

export type MarkViewedResult = {ok: boolean; allViewed?: boolean};

/**
 * Records the signed-in user as having viewed a message, and lets the server
 * expire it once every other participant has.
 *
 * Never throws. A failure here must not stop the user seeing the media they
 * just tapped — the alternative is a photo that refuses to open because a
 * bookkeeping call failed, which users read as the app being broken. The
 * consequence of a lost call is that the message stays viewable, which is the
 * behaviour this replaces rather than a regression from it.
 */
export async function markViewOnceViewed(
  chatId: string,
  messageId: string | number,
): Promise<MarkViewedResult | null> {
  try {
    const call = httpsCallable(getFunctions(), 'markViewOnceViewed');
    const result = await call({chatId, messageId: String(messageId)});
    return (result?.data as MarkViewedResult) ?? {ok: true};
  } catch (error) {
    // 'already-exists' is the ordinary case of a re-render racing the first
    // call, not a problem worth reporting.
    if ((error as {code?: string})?.code?.includes('already-exists')) return null;
    reportError(error, 'view_once_mark_failed');
    return null;
  }
}
