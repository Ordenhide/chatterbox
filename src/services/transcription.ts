import {getFunctions, httpsCallable} from '@react-native-firebase/functions';

const functions = getFunctions();

export async function transcribeVoiceMessage(
  chatId: string,
  messageId: string | number,
): Promise<string> {
  const callable = httpsCallable(functions, 'transcribeVoiceMessage');
  const result = await callable({chatId, messageId: String(messageId)});
  return (result.data as {transcription: string}).transcription;
}
