import {getFunctions, httpsCallable} from '@react-native-firebase/functions';
import {assertAiConsent} from './aiConsent';

const functions = getFunctions();

export interface ChatSummaryMessage {
  sender: string;
  text: string;
}

/**
 * `messages` is the already-decrypted plaintext the caller has for display
 * (message text is normally end-to-end encrypted, so the server has no way
 * to read it itself). Sending it here is a deliberate, user-initiated
 * exception to that — the same pattern transcription/translation use —
 * triggered only when the user taps "Catch Up".
 *
 * `question` is optional: omitted, this returns a general summary; given,
 * it answers that question using only the supplied conversation.
 */
export async function getChatSummary(
  chatId: string,
  messages: ChatSummaryMessage[],
  question?: string,
): Promise<string> {
  // Decrypted content is about to leave this device — see services/aiConsent.ts.
  await assertAiConsent();
  const callable = httpsCallable(functions, 'summarizeChat');
  const result = await callable({chatId, messages, question});
  return (result.data as {summary: string}).summary;
}
