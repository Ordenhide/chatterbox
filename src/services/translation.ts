import {getFunctions, httpsCallable} from './firebase/functions';
import type {LanguageCode} from '../i18n';
import {assertAiConsent} from './aiConsent';

const functions = getFunctions();

// Google Cloud Translate v2 language codes, mapped from this app's own
// LanguageCode set — Translate uses plain ISO 639-1 codes (not BCP-47 the
// way Speech-to-Text does), and distinguishes Chinese variants as
// "zh-CN"/"zh-TW" rather than this app's "zh-Hans"/"zh-Hant".
const TRANSLATE_LANGUAGE_CODES: Record<LanguageCode, string> = {
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
