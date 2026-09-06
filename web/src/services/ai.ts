import {getFunctions, httpsCallable} from 'firebase/functions';
import {assertAiConsent} from './aiConsent';
import {getApp} from 'firebase/app';
import type {Lang} from '../i18n';
import type {ArtifactCrypto} from './e2eeArtifacts';

// The mobile Cloud Functions were deployed without an explicit region, so they
// live in the default us-central1. These are the same callables the app uses.
const functions = getFunctions(getApp());

// Google Speech-to-Text v2 language codes, mapped from this app's own Lang
// type — "zh" alone isn't a valid STT language code (it wants the more
// specific "cmn-Hans-CN" for Mandarin), so this can't be passed through raw.
const SPEECH_LANGUAGE_CODES: Record<Lang, string> = {
  en: 'en-US',
  zh: 'cmn-Hans-CN',
};

/** Maps the app's current UI language to a Speech-to-Text language code, falling back to English. */
export function toSpeechLanguageCode(appLanguage: string): string {
  return SPEECH_LANGUAGE_CODES[appLanguage as Lang] || 'en-US';
}

// Google Cloud Translate v2 language codes, mapped from this app's own Lang
// type — Translate uses plain ISO 639-1 codes (not BCP-47 the way
// Speech-to-Text does), and distinguishes Chinese as "zh-CN"/"zh-TW"
// specifically rather than a bare "zh".
const TRANSLATE_LANGUAGE_CODES: Record<Lang, string> = {
  en: 'en',
  zh: 'zh-CN',
};

/** Maps the app's current UI language to a Cloud Translate language code, falling back to English. */
export function toTranslateLanguageCode(appLanguage: string): string {
  return TRANSLATE_LANGUAGE_CODES[appLanguage as Lang] || 'en';
}

export interface ChatSummaryMessage {
  sender: string;
  text: string;
}

/**
 * `messages` is the already-decrypted plaintext the caller has for display
 * (message text is normally end-to-end encrypted, so the server has no way
 * to read it itself). Sending it here is a deliberate, user-initiated
 * exception to that — the same pattern transcription/translation use —
 * triggered only when the user asks to summarize/search a chat.
 *
 * `question` is optional: omitted, this returns a general summary; given,
 * it answers that question using only the supplied conversation.
 */
export async function summarizeChat(
  chatId: string,
  messages: ChatSummaryMessage[],
  question?: string,
): Promise<string> {
  // Decrypted content is about to leave this device — see services/aiConsent.ts.
  assertAiConsent();
  const fn = httpsCallable<
    {chatId: string; messages: ChatSummaryMessage[]; question?: string},
    {summary: string}
  >(functions, 'summarizeChat');
  const res = await fn({chatId, messages, question});
  return res.data.summary;
}

/**
 * `text` is the already-decrypted plaintext of the message (the caller
 * already has it, for display) — message text is normally end-to-end
 * encrypted, so the server has no way to read this itself. Sending it here
 * is a deliberate, per-message, user-initiated exception to that, not a
 * change to how messages are stored or synced.
 */
export async function translateMessage(
  chatId: string,
  messageId: string,
  text: string,
  appLanguage: string,
): Promise<string> {
  // Decrypted content is about to leave this device — see services/aiConsent.ts.
  assertAiConsent();
  const fn = httpsCallable<
    {chatId: string; messageId: string; text: string; targetLanguage: string},
    {translation: string}
  >(functions, 'translateMessage');
  const targetLanguage = toTranslateLanguageCode(appLanguage);
  const res = await fn({chatId, messageId, text, targetLanguage});
  return res.data.translation;
}

/**
 * Transcribes a voice message via the transcribeVoiceMessage function, which
 * returns the transcript and deliberately does not store it: a transcript is
 * the message, and a function running with the Admin SDK has no key to seal
 * one with, so anything it wrote sat in the clear beside the ciphertext it
 * came from. Pass the result through buildTranscriptionPatch and write it from
 * the caller. Requires the function to be deployed.
 *
 * `audio` is the already-decrypted plaintext clip (a data: URI) the caller
 * holds for playback — voice messages are normally end-to-end encrypted, so
 * the server has no way to read this itself. Sending it here is a deliberate,
 * per-message, user-initiated exception to that, not a change to how
 * messages are stored or synced.
 */
export async function transcribeVoiceMessage(
  chatId: string,
  messageId: string,
  audio: string,
  appLanguage?: string,
  sampleRateHertz?: number,
  audioChannelCount?: number,
): Promise<string> {
  // Decrypted content is about to leave this device — see services/aiConsent.ts.
  assertAiConsent();
  const fn = httpsCallable<
    {
      chatId: string;
      messageId: string;
      audio: string;
      language?: string;
      sampleRateHertz?: number;
      audioChannelCount?: number;
    },
    {transcription: string}
  >(functions, 'transcribeVoiceMessage');
  const language = appLanguage ? toSpeechLanguageCode(appLanguage) : undefined;
  const res = await fn({chatId, messageId, audio, language, sampleRateHertz, audioChannelCount});
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

/**
 * The patch that stores a transcript, sealed to the chat.
 *
 * Mirrors src/services/transcription.ts on mobile and buildLinkPreviewPatch
 * here, fallback included: a chat with no peer key has nothing to encrypt to,
 * and a server-readable transcript is where this feature sat for its whole
 * life — no worse than before, and the same degradation shared lists and link
 * previews already accept.
 */
export function buildTranscriptionPatch(
  transcription: string,
  crypto: ArtifactCrypto,
): Record<string, unknown> {
  const sealed = crypto.seal(transcription);
  if (sealed) return {encryptedTranscription: sealed};
  return {transcription};
}
