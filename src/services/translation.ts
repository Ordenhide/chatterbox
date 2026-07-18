import {getFunctions, httpsCallable} from '@react-native-firebase/functions';

const functions = getFunctions();

export async function translateMessage(
  chatId: string,
  messageId: string | number,
  targetLanguage: string,
): Promise<string> {
  const callable = httpsCallable(functions, 'translateMessage');
  const result = await callable({chatId, messageId: String(messageId), targetLanguage});
  return (result.data as {translation: string}).translation;
}
