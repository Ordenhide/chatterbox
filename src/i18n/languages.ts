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
export type LanguageCode = 'en' | 'zh-Hans' | 'zh-Hant' | 'zh' | 'es' | 'fr' | 'de' | 'ja' | 'ko' | 'pt' | 'ru' | 'ar' | 'hi' | 'it' | 'tr' | 'vi';

/**
 * The languages actually offered in the picker.
 *
 * Not every locale file shipped — i18n/index.ts still loads all fifteen,
 * and a device already set to one keeps it. This is the *offer*, and it is
 * shorter than the file list on purpose: thirteen of those translations are
 * 53.6% complete and have not moved since they were made. i18next falls back
 * to English for the rest, so nothing breaks, but nearly half of what a German
 * user reads would be English — including the sign-in screen, most of Profile,
 * and the line that says a message is going out unencrypted.
 *
 * Offering a language is a claim that the app speaks it. Two do.
 *
 * Re-adding one is a line here, and a test enforces the bar rather than
 * trusting this comment: see __tests__/languageCompleteness.test.ts, which
 * fails if anything offered drops below OFFERED_MIN_COMPLETENESS. Finish a
 * translation and it lets the language back in.
 */
export const LANGUAGES: {code: LanguageCode; label: string; nativeLabel: string}[] = [
  {code: 'en', label: 'English', nativeLabel: 'English'},
  {code: 'zh-Hans', label: 'Chinese (Simplified)', nativeLabel: '简体中文'},
];
