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
//
// Partial, not Record: Speech-to-Text's language list is narrower than the
// app's, and a language missing here is a documented gap, not an oversight —
// see the two omitted below. toSpeechLanguageCode() already falls back to
// English for a missing entry, which is the honest behaviour: transcribing
// Tibetan speech as if it were English would be worse than saying so.
const SPEECH_LANGUAGE_CODES: Partial<Record<LanguageCode, string>> = {
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
  fa: 'fa-IR',
  he: 'iw-IL', // Speech-to-Text still uses the old ISO code for Hebrew.
  ur: 'ur-PK',
  pl: 'pl-PL',
  uk: 'uk-UA',
  id: 'id-ID',
  bn: 'bn-IN',
  th: 'th-TH',
  fil: 'fil-PH',
  ms: 'ms-MY',
  my: 'my-MM',
  km: 'km-KH',
  lo: 'lo-LA',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  pa: 'pa-Guru-IN',
  ne: 'ne-NP',
  si: 'si-LK',
  sw: 'sw-KE',
  ha: 'ha-NG',
  am: 'am-ET',
  nl: 'nl-NL',
  el: 'el-GR',
  sv: 'sv-SE',
  da: 'da-DK',
  no: 'nb-NO',
  cs: 'cs-CZ',
  ro: 'ro-RO',
  hu: 'hu-HU',
  kk: 'kk-KZ',
  uz: 'uz-UZ',
  ka: 'ka-GE',
  hy: 'hy-AM',
  be: 'be-BY',
  mn: 'mn-MN',
  // ti (Tigrinya) and bo (Tibetan): no Speech-to-Text support as of this
  // writing — verified against Google's own supported-languages page, not
  // guessed. See translation.ts for the same two languages' Cloud Translate
  // status, which differs (Tigrinya has translate support; Tibetan has neither).
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
