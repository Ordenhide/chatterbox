/**
 * The languages the website ships in, and the two facts every generated page
 * needs about each: which way it reads, and what it calls itself.
 *
 * Both generators read this list. They used to each carry their own copy, and
 * two lists of fifteen languages in two files is one list plus a drift
 * waiting to happen — the kind where the privacy page offers a language the
 * landing page does not, and the switcher dead-ends.
 *
 * The order is the order the switchers show, which is the app's own picker
 * order (src/i18n/languages.ts), not alphabetical.
 */
export const SITE_LANGUAGES = [
  {code: 'en', lang: 'en', dir: 'ltr', native: 'English'},
  {code: 'zh-Hans', lang: 'zh-Hans', dir: 'ltr', native: '简体中文'},
  {code: 'zh-Hant', lang: 'zh-Hant', dir: 'ltr', native: '繁體中文'},
  {code: 'es', lang: 'es', dir: 'ltr', native: 'Español'},
  {code: 'fr', lang: 'fr', dir: 'ltr', native: 'Français'},
  {code: 'de', lang: 'de', dir: 'ltr', native: 'Deutsch'},
  {code: 'it', lang: 'it', dir: 'ltr', native: 'Italiano'},
  {code: 'pt', lang: 'pt', dir: 'ltr', native: 'Português'},
  {code: 'ru', lang: 'ru', dir: 'ltr', native: 'Русский'},
  {code: 'tr', lang: 'tr', dir: 'ltr', native: 'Türkçe'},
  {code: 'vi', lang: 'vi', dir: 'ltr', native: 'Tiếng Việt'},
  {code: 'ja', lang: 'ja', dir: 'ltr', native: '日本語'},
  {code: 'ko', lang: 'ko', dir: 'ltr', native: '한국어'},
  {code: 'ar', lang: 'ar', dir: 'rtl', native: 'العربية'},
  {code: 'hi', lang: 'hi', dir: 'ltr', native: 'हिन्दी'},
  {code: 'fa', lang: 'fa', dir: 'rtl', native: 'فارسی'},
  {code: 'he', lang: 'he', dir: 'rtl', native: 'עברית'},
  {code: 'ur', lang: 'ur', dir: 'rtl', native: 'اردو'},
  {code: 'pl', lang: 'pl', dir: 'ltr', native: 'Polski'},
  {code: 'uk', lang: 'uk', dir: 'ltr', native: 'Українська'},
  {code: 'id', lang: 'id', dir: 'ltr', native: 'Bahasa Indonesia'},
  {code: 'bn', lang: 'bn', dir: 'ltr', native: 'বাংলা'},
  {code: 'th', lang: 'th', dir: 'ltr', native: 'ไทย'},
];

export const SITE_LANGUAGE_CODES = SITE_LANGUAGES.map(l => l.code);

export const languageMeta = code => {
  const found = SITE_LANGUAGES.find(l => l.code === code);
  if (!found) throw new Error(`unknown language ${code} — add it to scripts/site-copy/languages.mjs`);
  return found;
};
