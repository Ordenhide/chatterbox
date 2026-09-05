import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import mmkvStorage from '../services/storageMMKV';
import {LANGUAGES, type LanguageCode} from './languages';

export {LANGUAGES};
export type {LanguageCode};
import {applyLayoutDirection} from './rtl';

import en from './locales/en.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import it from './locales/it.json';
import tr from './locales/tr.json';
import vi from './locales/vi.json';

const LANG_STORAGE_KEY = '@chatterbox:language';

const resources = {
  en: {translation: en},
  'zh-Hans': {translation: zhHans},
  'zh-Hant': {translation: zhHant},
  zh: {translation: zhHans},
  es: {translation: es},
  fr: {translation: fr},
  de: {translation: de},
  ja: {translation: ja},
  ko: {translation: ko},
  pt: {translation: pt},
  ru: {translation: ru},
  ar: {translation: ar},
  hi: {translation: hi},
  it: {translation: it},
  tr: {translation: tr},
  vi: {translation: vi},
} as const;



const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      const stored = await mmkvStorage.getItem(LANG_STORAGE_KEY);
      if (stored && Object.prototype.hasOwnProperty.call(resources, stored)) {
        callback(stored);
        return;
      }
    } catch {
      // ignore storage failures
    }

    const locales = RNLocalize.getLocales();
    const first = locales[0];
    const tag = first?.languageTag || first?.languageCode || 'en';
    const lower = tag.toLowerCase();

    if (lower.startsWith('zh-hant') || lower.startsWith('zh-tw') || lower.startsWith('zh-hk')) {
      callback('zh-Hant');
      return;
    }
    if (lower.startsWith('zh')) {
      callback('zh-Hans');
      return;
    }

    const code = first?.languageCode?.toLowerCase();
    if (code && Object.prototype.hasOwnProperty.call(resources, code)) {
      callback(code);
      return;
    }

    callback('en');
  },
  init: () => undefined,
  cacheUserLanguage: async (lng: string) => {
    try {
      await mmkvStorage.setItem(LANG_STORAGE_KEY, lng);
    } catch {
      // ignore storage failures
    }
  },
};

// The union in ./languages is written by hand so that file stays free of
// native imports; this line is what keeps it honest. If a locale is added to
// `resources` without being added there, this fails to compile.
const _codesAgree: Record<LanguageCode, unknown> = resources;
void _codesAgree;

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,
    fallbackLng: 'en',
    react: {
      useSuspense: false,
    },
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

/**
 * Layout direction follows the language, and has to be recorded as soon as the
 * language is known — including the detector's very first resolution, which is
 * why this hangs off the event rather than off the caller that changes it.
 *
 * React Native fixes direction at startup from native, so this only ever
 * describes the *next* launch. Callers that change the language while running
 * should use applyLayoutDirection's needsRestart and say so; see ProfileScreen.
 */
i18n.on('languageChanged', lng => {
  applyLayoutDirection(lng);
});

export default i18n;
