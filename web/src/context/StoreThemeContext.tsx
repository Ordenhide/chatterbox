import {createContext, useContext, useEffect, useState} from 'react';
import {listenStoreTheme} from '../services/storeTheme';
import {inkOn, type StoreTheme} from '../services/themeCatalog';
import {useTheme} from './ThemeContext';

const Ctx = createContext<StoreTheme | undefined>(undefined);

/**
 * A store theme moves the accent and nothing else.
 *
 * It used to also blend a `wallpaper` hue into the app canvas — at 22%, and
 * only that weak because the wallpaper carried no relationship to the user's
 * dark/light choice: every free theme's was light and every Pro one dark, so
 * painting it at full strength put light ink on a light tint and the text
 * vanished. Having to dilute a value to 22% to stop it breaking contrast was
 * the sign it should not have been deciding the background at all. The canvas
 * now comes from the dark/light theme alone.
 */

export function StoreThemeProvider({uid, children}: {uid: string; children: React.ReactNode}) {
  const [storeTheme, setStoreTheme] = useState<StoreTheme | undefined>(undefined);
  const {theme: mode} = useTheme();

  useEffect(() => {
    setStoreTheme(undefined); // reset first — this provider is reused across accounts
    return listenStoreTheme(uid, setStoreTheme);
  }, [uid]);

  useEffect(() => {
    const root = document.documentElement.style;
    const vars = [
      '--cb-primary',
      '--cb-primary-soft',
      '--cb-primary-light',
      '--cb-text-on-primary',
    ];
    const clear = () => vars.forEach(v => root.removeProperty(v));

    if (!storeTheme) {
      clear();
      return clear;
    }

    const {accent} = storeTheme;
    root.setProperty('--cb-primary', accent);
    root.setProperty('--cb-primary-light', `color-mix(in srgb, ${accent} 14%, transparent)`);
    // `--cb-primary-soft` is used as *text*, so it can't be the raw accent —
    // the stylesheet already darkens its built-in cyan in light mode for
    // exactly this reason. Push the accent away from the background instead.
    root.setProperty(
      '--cb-primary-soft',
      mode === 'light'
        ? `color-mix(in srgb, ${accent} 82%, #000000)`
        : `color-mix(in srgb, ${accent} 74%, #ffffff)`,
    );
    // Ink on top of the accent fill, measured against the accent itself
    // rather than taken from the mode: a bright amber button needs dark text
    // in either. See inkOn — it compares both candidates' contrast instead of
    // thresholding brightness, which got Classic (#6366F1) wrong at 4.47:1.
    root.setProperty('--cb-text-on-primary', inkOn(accent));
    return clear;
  }, [storeTheme, mode]);

  return <Ctx.Provider value={storeTheme}>{children}</Ctx.Provider>;
}

/** The account's applied Store theme, or undefined if none is set. */
export const useAccountTheme = () => useContext(Ctx);
