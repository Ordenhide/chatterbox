/**
 * The language list, kept apart from i18n/index.ts.
 *
 * Pure data, and separated so it can be read without booting i18next — which
 * reaches react-native-localize and MMKV through native modules, so a test
 * that only wants to know which languages are offered would otherwise have to
 * mock three things to ask one question.
 */
/**
 * Every locale i18next has resources for — which is more than the picker
 * offers. Spelled out rather than derived from that resources object, because
 * deriving it would drag the whole i18n module back in and this file exists to
 * not do that. i18n/index.ts asserts the two agree.
 */
export type LanguageCode = 'en' | 'zh-Hans' | 'zh-Hant' | 'zh' | 'es' | 'fr' | 'de' | 'ja' | 'ko' | 'pt' | 'ru' | 'ar' | 'hi' | 'it' | 'tr' | 'vi' | 'fa' | 'he' | 'ur' | 'pl' | 'uk' | 'id' | 'bn' | 'th';

/**
 * The languages actually offered in the picker.
 *
 * All locale files are complete, and all are offered.
 *
 * They were not always. Thirteen of the original fifteen sat at 42% for long
 * enough that the gap covered the sign-in screen, most of Profile, and the
 * line that tells a user their message is going out unencrypted — and
 * because i18next silently falls back to English, nothing ever broke loudly
 * enough to be noticed.
 *
 * Offering a language is a claim that the app speaks it, and that claim now
 * includes the privacy policy: i18n/privacyPolicy.ts is keyed by
 * OfferedLanguage below, so a language cannot be listed here without one.
 *
 * Re-adding one is a line here, and a test enforces the bar rather than
 * trusting this comment: see __tests__/languageCompleteness.test.ts, which
 * fails if anything offered drops below OFFERED_MIN_COMPLETENESS. Finish a
 * translation and it lets the language back in.
 */
export const LANGUAGES = [
  {code: 'en', label: 'English', nativeLabel: 'English'},
  {code: 'zh-Hans', label: 'Chinese (Simplified)', nativeLabel: '简体中文'},
  {code: 'zh-Hant', label: 'Chinese (Traditional)', nativeLabel: '繁體中文'},
  {code: 'es', label: 'Spanish', nativeLabel: 'Español'},
  {code: 'fr', label: 'French', nativeLabel: 'Français'},
  {code: 'de', label: 'German', nativeLabel: 'Deutsch'},
  {code: 'it', label: 'Italian', nativeLabel: 'Italiano'},
  {code: 'pt', label: 'Portuguese', nativeLabel: 'Português'},
  {code: 'ru', label: 'Russian', nativeLabel: 'Русский'},
  {code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe'},
  {code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt'},
  {code: 'ja', label: 'Japanese', nativeLabel: '日本語'},
  {code: 'ko', label: 'Korean', nativeLabel: '한국어'},
  {code: 'ar', label: 'Arabic', nativeLabel: 'العربية'},
  {code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी'},
  {code: 'fa', label: 'Persian', nativeLabel: 'فارسی'},
  {code: 'he', label: 'Hebrew', nativeLabel: 'עברית'},
  {code: 'ur', label: 'Urdu', nativeLabel: 'اردو'},
  {code: 'pl', label: 'Polish', nativeLabel: 'Polski'},
  {code: 'uk', label: 'Ukrainian', nativeLabel: 'Українська'},
  {code: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia'},
  {code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা'},
  {code: 'th', label: 'Thai', nativeLabel: 'ไทย'},
] as const satisfies readonly {code: LanguageCode; label: string; nativeLabel: string}[];

/**
 * Just the languages in the picker, as a type.
 *
 * Anything that has to exist in every offered language keys off this rather
 * than off LanguageCode — the privacy policy, notably. Adding a language to
 * the list above without writing its policy is then a compile error instead of
 * a user quietly being shown English legal text.
 */
export type OfferedLanguage = (typeof LANGUAGES)[number]['code'];
