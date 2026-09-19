import {getFunctions, httpsCallable} from './firebase/functions';
import type {LanguageCode} from '../i18n';
import {assertAiConsent} from './aiConsent';

const functions = getFunctions();

// Google Cloud Translate v2 language codes, mapped from this app's own
// LanguageCode set — Translate uses plain ISO 639-1 codes (not BCP-47 the
// way Speech-to-Text does), and distinguishes Chinese variants as
// "zh-CN"/"zh-TW" rather than this app's "zh-Hans"/"zh-Hant".
//
// Partial, not Record: a language missing here has no Cloud Translate support
// as of this writing (verified against Google's own docs) — see the omitted
// entry below. toTranslateLanguageCode() falls back to English rather than
// silently mistranslating.
const TRANSLATE_LANGUAGE_CODES: Partial<Record<LanguageCode, string>> = {
  en: 'en',
  zh: 'zh-CN', // resources.zh aliases zh-Hans (src/i18n/index.ts)
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  es: 'es',
  fr: 'fr',
  de: 'de',
  ja: 'ja',
  ko: 'ko',
  pt: 'pt',
  ru: 'ru',
  ar: 'ar',
  hi: 'hi',
  it: 'it',
  tr: 'tr',
  vi: 'vi',
  fa: 'fa',
  he: 'iw', // Cloud Translate still uses the old ISO code for Hebrew.
  ur: 'ur',
  pl: 'pl',
  uk: 'uk',
  id: 'id',
  bn: 'bn',
  th: 'th',
  fil: 'fil',
  ms: 'ms',
  my: 'my',
  km: 'km',
  lo: 'lo',
  ta: 'ta',
  te: 'te',
  mr: 'mr',
  pa: 'pa',
  ne: 'ne',
  si: 'si',
  sw: 'sw',
  ha: 'ha',
  am: 'am',
  nl: 'nl',
  el: 'el',
  sv: 'sv',
  da: 'da',
  no: 'no',
  cs: 'cs',
  ro: 'ro',
  hu: 'hu',
  kk: 'kk',
  uz: 'uz',
  ka: 'ka',
  hy: 'hy',
  be: 'be',
  ti: 'ti',
  mn: 'mn',
  // bo (Tibetan): no Cloud Translate support as of this writing — verified
  // against Google's own docs, not assumed. See transcription.ts for the
  // matching Speech-to-Text gap (Tibetan has neither; Tigrinya has this one
  // but not Speech-to-Text).
};

/** Maps the app's current UI language to a Cloud Translate language code, falling back to English. */
export function toTranslateLanguageCode(appLanguage: string): string {
  return TRANSLATE_LANGUAGE_CODES[appLanguage as LanguageCode] || 'en';
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
  messageId: string | number,
  text: string,
  appLanguage: string,
): Promise<string> {
  // Decrypted content is about to leave this device — see services/aiConsent.ts.
  await assertAiConsent();
  const callable = httpsCallable(functions, 'translateMessage');
  const targetLanguage = toTranslateLanguageCode(appLanguage);
  const result = await callable({chatId, messageId: String(messageId), text, targetLanguage});
  return (result.data as {translation: string}).translation;
}
