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
  {code: 'fil', lang: 'fil', dir: 'ltr', native: 'Filipino'},
  {code: 'ms', lang: 'ms', dir: 'ltr', native: 'Bahasa Melayu'},
  {code: 'my', lang: 'my', dir: 'ltr', native: 'မြန်မာဘာသာ'},
  {code: 'km', lang: 'km', dir: 'ltr', native: 'ខ្មែរ'},
  {code: 'lo', lang: 'lo', dir: 'ltr', native: 'ລາວ'},
  {code: 'ta', lang: 'ta', dir: 'ltr', native: 'தமிழ்'},
  {code: 'te', lang: 'te', dir: 'ltr', native: 'తెలుగు'},
  {code: 'mr', lang: 'mr', dir: 'ltr', native: 'मराठी'},
  {code: 'pa', lang: 'pa', dir: 'ltr', native: 'ਪੰਜਾਬੀ'},
  {code: 'ne', lang: 'ne', dir: 'ltr', native: 'नेपाली'},
  {code: 'si', lang: 'si', dir: 'ltr', native: 'සිංහල'},
  {code: 'sw', lang: 'sw', dir: 'ltr', native: 'Kiswahili'},
  {code: 'ha', lang: 'ha', dir: 'ltr', native: 'Hausa'},
  {code: 'am', lang: 'am', dir: 'ltr', native: 'አማርኛ'},
  {code: 'nl', lang: 'nl', dir: 'ltr', native: 'Nederlands'},
  {code: 'el', lang: 'el', dir: 'ltr', native: 'Ελληνικά'},
  {code: 'sv', lang: 'sv', dir: 'ltr', native: 'Svenska'},
  {code: 'da', lang: 'da', dir: 'ltr', native: 'Dansk'},
  {code: 'no', lang: 'no', dir: 'ltr', native: 'Norsk'},
  {code: 'cs', lang: 'cs', dir: 'ltr', native: 'Čeština'},
  {code: 'ro', lang: 'ro', dir: 'ltr', native: 'Română'},
  {code: 'hu', lang: 'hu', dir: 'ltr', native: 'Magyar'},
  {code: 'kk', lang: 'kk', dir: 'ltr', native: 'Қазақша'},
  {code: 'uz', lang: 'uz', dir: 'ltr', native: 'Oʻzbekcha'},
  {code: 'ka', lang: 'ka', dir: 'ltr', native: 'ქართული'},
  {code: 'hy', lang: 'hy', dir: 'ltr', native: 'Հայերեն'},
  {code: 'bo', lang: 'bo', dir: 'ltr', native: 'བོད་ཡིག'},
  {code: 'be', lang: 'be', dir: 'ltr', native: 'Беларуская'},
  {code: 'ti', lang: 'ti', dir: 'ltr', native: 'ትግርኛ'},
  {code: 'mn', lang: 'mn', dir: 'ltr', native: 'Монгол'},
];

export const SITE_LANGUAGE_CODES = SITE_LANGUAGES.map(l => l.code);

export const languageMeta = code => {
  const found = SITE_LANGUAGES.find(l => l.code === code);
  if (!found) throw new Error(`unknown language ${code} — add it to scripts/site-copy/languages.mjs`);
  return found;
};
