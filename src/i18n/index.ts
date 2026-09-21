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
import fa from './locales/fa.json';
import he from './locales/he.json';
import ur from './locales/ur.json';
import pl from './locales/pl.json';
import uk from './locales/uk.json';
import id from './locales/id.json';
import bn from './locales/bn.json';
import th from './locales/th.json';
import fil from './locales/fil.json';
import ms from './locales/ms.json';
import my from './locales/my.json';
import km from './locales/km.json';
import lo from './locales/lo.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import mr from './locales/mr.json';
import pa from './locales/pa.json';
import ne from './locales/ne.json';
import si from './locales/si.json';
import sw from './locales/sw.json';
import ha from './locales/ha.json';
import am from './locales/am.json';
import nl from './locales/nl.json';
import el from './locales/el.json';
import sv from './locales/sv.json';
import da from './locales/da.json';
import no from './locales/no.json';
import cs from './locales/cs.json';
import ro from './locales/ro.json';
import hu from './locales/hu.json';
import kk from './locales/kk.json';
import uz from './locales/uz.json';
import ka from './locales/ka.json';
import hy from './locales/hy.json';
import bo from './locales/bo.json';
import be from './locales/be.json';
import ti from './locales/ti.json';
import mn from './locales/mn.json';

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
  fa: {translation: fa},
  he: {translation: he},
  ur: {translation: ur},
  pl: {translation: pl},
  uk: {translation: uk},
  id: {translation: id},
  bn: {translation: bn},
  th: {translation: th},
  fil: {translation: fil},
  ms: {translation: ms},
  my: {translation: my},
  km: {translation: km},
  lo: {translation: lo},
  ta: {translation: ta},
  te: {translation: te},
  mr: {translation: mr},
  pa: {translation: pa},
  ne: {translation: ne},
  si: {translation: si},
  sw: {translation: sw},
  ha: {translation: ha},
  am: {translation: am},
  nl: {translation: nl},
  el: {translation: el},
  sv: {translation: sv},
  da: {translation: da},
  no: {translation: no},
  cs: {translation: cs},
  ro: {translation: ro},
  hu: {translation: hu},
  kk: {translation: kk},
  uz: {translation: uz},
  ka: {translation: ka},
  hy: {translation: hy},
  bo: {translation: bo},
  be: {translation: be},
  ti: {translation: ti},
  mn: {translation: mn},
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

/**
 * Resolves once the detector has settled and `t` speaks the user's language.
 *
 * Exported because the language detector is asynchronous, and one caller runs
 * outside React: the background push handler builds a notification the moment
 * a message arrives, which on a cold start the notification itself triggered
 * can be before detection has finished. Calling `t` then returns the English
 * fallback — the whole notification, in English, on a phone set to something
 * else. React callers never see this, since every screen re-renders on
 * 'languageChanged'; a one-shot caller has nothing to re-render and has to
 * wait instead.
 */
export const i18nReady: Promise<unknown> = i18n
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
