/**
 * Per-chat message expiry, and nothing else any more.
 *
 * A dead man's switch, a remote wipe and a trusted-contact list lived here
 * too — eleven exported functions, none of which anything imported. There was
 * no screen to arm the switch, nothing to trigger the wipe, and no way to name
 * a trusted contact, so `deadManSwitch.enabled` was a field no client could
 * ever set. A scheduled Cloud Function queried for it every twenty-four hours
 * and was therefore guaranteed to find nothing, on a paid invocation, forever.
 *
 * requestRemoteWipe would also have written `remoteWipe` onto the public
 * profile document, which every contact can read — a flag announcing that you
 * had triggered one, to the people it would most matter to.
 *
 * Half-shipped is the one state that costs money and protects nobody. If the
 * feature comes back it comes back with a screen; the code is in the history.
 */
import {doc, getFirestore, setDoc} from './firebase/firestore';

const db = getFirestore();

/**
 * Sets the chat's disappearing-messages policy in hours (0 = off).
 *
 * Enabling one also stamps `messageExpirySince`, which is what confines the
 * timer to messages sent from here on. This used to write `messageExpiry`
 * alone, and processExpiredMessages (functions/index.js) swept on age alone to
 * match — so choosing "1 hour" deleted every message older than an hour,
 * which is to say the conversation. The screen offering the choice has never
 * said anything of the kind.
 *
 * Milliseconds rather than a serverTimestamp, because the field is read by
 * the scheduled function and by the web client's own sweep, and both compare
 * it against a number. Twin of web/src/services/chat.ts's setChatExpiryPolicy.
 */
export async function setChatExpiryPolicy(
  chatId: string,
  hours: number,
): Promise<void> {
  const patch: {messageExpiry: number; messageExpirySince?: number} = {
    messageExpiry: hours,
  };
  if (hours > 0) patch.messageExpirySince = Date.now();
  await setDoc(doc(db, 'chats', chatId), patch, {merge: true});
}

export function getExpiryOptions(): Array<{label: string; hours: number}> {
  return [
    {label: 'Off', hours: 0},
    {label: '1 Hour', hours: 1},
    {label: '24 Hours', hours: 24},
    {label: '7 Days', hours: 168},
    {label: '30 Days', hours: 720},
  ];
}
