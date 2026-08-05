import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {reportError} from './telemetry';

/**
 * Wraps a Firestore snapshot handler so a failing listener can't crash the app.
 *
 * ## The problem this exists for
 *
 * @react-native-firebase invokes the *success* callback with `(null, error)`
 * when a listener fails, not just the separate onError callback — see
 * `handleError` in FirestoreDocumentReference.js:
 *
 *     function handleError(error) {
 *       callback(null, error);   // <- success callback, with a null snapshot
 *       onError(error);
 *     }
 *
 * So any handler written as `snap => snap.data()` throws
 * "Cannot read property 'data' of null" the instant its document stops being
 * readable. Deleting a chat does exactly that to every listener still attached
 * to it, which surfaced as an uncaught error mid-delete.
 *
 * Passing an onError callback is **not** sufficient on its own: handleError
 * calls the success callback first, so the crash happens before onError runs.
 * The guard has to be on the success path.
 *
 * ## Why a wrapper rather than a null check at each site
 *
 * There were eleven of these, and the next listener someone adds would have the
 * same hole. Wrapping makes the safe form the short form.
 *
 * A listener whose document has become unreadable goes quiet rather than
 * reporting to the UI: for a deleted chat that is the correct end state, and
 * the screen is already being torn down. The error is still sent to telemetry
 * so a genuine permissions regression doesn't hide here.
 *
 * Deliberately mobile-only: the web client uses the Firebase JS SDK, whose
 * onSnapshot never passes a null snapshot to the success callback (errors go
 * solely to its own error callback), so web has no equivalent hole.
 */
/**
 * Losing read access is how a listener *ends* when the chat it watches is
 * deleted or left — the rules' isChatParticipant() reads a chat document that
 * no longer exists. Reporting that would send a burst of non-errors to
 * Crashlytics from every attached listener on each delete, which is exactly
 * the noise that hides real failures.
 */
function isAccessRevoked(error: unknown): boolean {
  const code = (error as {code?: string} | null)?.code ?? '';
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}

function guard<S>(context: string, handler: (snap: S) => void) {
  return (snap: S | null, error?: unknown) => {
    if (error) {
      if (!isAccessRevoked(error)) reportError(error, context);
      return;
    }
    // No error but no snapshot: not a documented state, but cheaper to survive
    // than to crash on.
    if (!snap) return;
    handler(snap);
  };
}

/**
 * Guard for a single-document listener.
 *
 * Split into doc/query variants rather than one generic helper because the
 * snapshot type cannot be inferred at the call site: `onSnapshot`'s callback
 * parameter provides no contextual type to infer from, so a generic collapsed
 * to `unknown` and every `snap.data()` failed to typecheck. Naming the type
 * here keeps the handlers fully checked.
 */
export function guardDocSnapshot(
  context: string,
  handler: (snap: FirebaseFirestoreTypes.DocumentSnapshot) => void,
) {
  return guard<FirebaseFirestoreTypes.DocumentSnapshot>(context, handler);
}

/** Guard for a collection/query listener. */
export function guardQuerySnapshot(
  context: string,
  handler: (snap: FirebaseFirestoreTypes.QuerySnapshot) => void,
) {
  return guard<FirebaseFirestoreTypes.QuerySnapshot>(context, handler);
}
