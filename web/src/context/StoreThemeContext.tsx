import {createContext, useContext, useEffect, useState} from 'react';
import {listenStoreTheme} from '../services/storeTheme';
import {isDarkColor, type StoreTheme} from '../services/themeCatalog';
import {useTheme} from './ThemeContext';

const Ctx = createContext<StoreTheme | undefined>(undefined);

/**
 * How much of the theme's wallpaper is blended into the app canvas.
 *
 * The wallpaper is *not* used as a flat background here, because it carries
 * no relationship to the user's dark/light choice: every free theme's
 * wallpaper is light and every Pro one is dark, so painting it directly puts
 * light ink on a light tint (or dark on dark) and the text vanishes. Blending
 * keeps the hue clearly readable as "this theme is applied" while the mode's
 * own canvas keeps deciding luminance — and therefore contrast.
 *
 * The chat thread still paints the wallpaper at full strength: ChatPane flips
 * its ink via isDarkWallpaper, so it can afford what the app shell cannot.
 */
const WALLPAPER_TINT = '22%';

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
      '--cb-wallpaper',
    ];
    const clear = () => vars.forEach(v => root.removeProperty(v));

    if (!storeTheme) {
      clear();
      return clear;
    }

    const {accent, wallpaper} = storeTheme;
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
    // Ink on top of the accent fill, chosen from the accent's own brightness
    // rather than the mode: a bright amber button needs dark text in either.
    root.setProperty('--cb-text-on-primary', isDarkColor(accent) ? '#ffffff' : '#0b1220');
    if (wallpaper) {
      root.setProperty(
        '--cb-wallpaper',
        `color-mix(in srgb, ${wallpaper} ${WALLPAPER_TINT}, var(--cb-canvas))`,
      );
    } else {
      root.removeProperty('--cb-wallpaper');
    }
    return clear;
  }, [storeTheme, mode]);

  return <Ctx.Provider value={storeTheme}>{children}</Ctx.Provider>;
}

/** The account's applied Store theme, or undefined if none is set. */
export const useAccountTheme = () => useContext(Ctx);
