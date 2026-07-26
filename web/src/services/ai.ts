import {getFunctions, httpsCallable} from 'firebase/functions';
import {getApp} from 'firebase/app';

// The mobile Cloud Functions were deployed without an explicit region, so they
// live in the default us-central1. These are the same callables the app uses.
const functions = getFunctions(getApp());

export async function summarizeChat(chatId: string, messageCount = 50): Promise<string> {
  const fn = httpsCallable<{chatId: string; messageCount: number}, {summary: string}>(
    functions,
    'summarizeChat',
  );
  const res = await fn({chatId, messageCount});
  return res.data.summary;
}

export async function translateMessage(
  chatId: string,
  messageId: string,
  targetLanguage: string,
): Promise<string> {
  const fn = httpsCallable<
    {chatId: string; messageId: string; targetLanguage: string},
    {translation: string}
  >(functions, 'translateMessage');
  const res = await fn({chatId, messageId, targetLanguage});
  return res.data.translation;
}

/**
 * Transcribes a voice message via the transcribeVoiceMessage function. The
 * function writes `transcription` onto the message doc (so it also arrives via
 * the listener) and returns it. Requires the function to be deployed.
 */
export async function transcribeVoiceMessage(chatId: string, messageId: string): Promise<string> {
  const fn = httpsCallable<{chatId: string; messageId: string}, {transcription: string}>(
    functions,
    'transcribeVoiceMessage',
  );
  const res = await fn({chatId, messageId});
  return res.data.transcription;
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const fn = httpsCallable<{url: string}, {preview: LinkPreview}>(functions, 'fetchLinkPreview');
  const res = await fn({url});
  return res.data.preview;
}
