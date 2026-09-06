import {getFunctions, httpsCallable} from './firebase/functions';
import type {LanguageCode} from '../i18n';
import {assertAiConsent} from './aiConsent';
import type {ArtifactCrypto} from './e2eeArtifacts';

const functions = getFunctions();

// Google Speech-to-Text v2 language codes, mapped from this app's own
// LanguageCode set (src/i18n/index.ts's LANGUAGES) — the two don't match
// 1:1 (e.g. this app's "zh-Hans"/"zh-Hant" vs. STT's "cmn-Hans-CN"), so a
// raw pass-through would silently mistranscribe or error for most non-English
// users instead of just defaulting to English.
const SPEECH_LANGUAGE_CODES: Record<LanguageCode, string> = {
  en: 'en-US',
  zh: 'cmn-Hans-CN', // resources.zh aliases zh-Hans (src/i18n/index.ts)
  'zh-Hans': 'cmn-Hans-CN',
  'zh-Hant': 'cmn-Hant-TW',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ja: 'ja-JP',
  ko: 'ko-KR',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ar: 'ar-SA',
  hi: 'hi-IN',
  it: 'it-IT',
  tr: 'tr-TR',
  vi: 'vi-VN',
};

/** Maps the app's current UI language to a Speech-to-Text language code, falling back to English. */
export function toSpeechLanguageCode(appLanguage: string): string {
  return SPEECH_LANGUAGE_CODES[appLanguage as LanguageCode] || 'en-US';
}

/**
 * `audio` is the already-decrypted plaintext clip (a data: URI) the caller
 * holds for playback — voice messages are normally end-to-end encrypted, so
 * the server has no way to read this itself. Sending it here is a deliberate,
 * per-message, user-initiated exception to that, not a change to how
 * messages are stored or synced.
 *
 * The transcript comes back from the callable and is *not* stored by it. A
 * transcript is the message, and the Cloud Function has no keys, so anything
 * it wrote would have been a plaintext copy of a message whose text is
 * ciphertext two fields away. Pass the result through buildTranscriptionPatch
 * and write it from here instead.
 */
export async function transcribeVoiceMessage(
  chatId: string,
  messageId: string | number,
  audio: string,
  appLanguage?: string,
  sampleRateHertz?: number,
  audioChannelCount?: number,
): Promise<string> {
  // Decrypted content is about to leave this device — see services/aiConsent.ts.
  await assertAiConsent();
  const callable = httpsCallable(functions, 'transcribeVoiceMessage');
  const language = appLanguage ? toSpeechLanguageCode(appLanguage) : undefined;
  const result = await callable({
    chatId,
    messageId: String(messageId),
    audio,
    language,
    sampleRateHertz,
    audioChannelCount,
  });
  return (result.data as {transcription: string}).transcription;
}

/**
 * The patch that stores a transcript, sealed to the chat.
 *
 * Mirrors linkPreview.ts's buildLinkPreviewPatch, including the fallback: a
 * chat with no peer key yet has nothing to encrypt to, and a transcript the
 * server can read is the state this feature was in for its whole life — worse
 * than sealed, no worse than before, and visible in the same place the rest of
 * the app reports an unsealed chat.
 */
export function buildTranscriptionPatch(
  transcription: string,
  crypto: ArtifactCrypto,
): Record<string, unknown> {
  const sealed = crypto.seal(transcription);
  if (sealed) return {encryptedTranscription: sealed};
  return {transcription};
}
