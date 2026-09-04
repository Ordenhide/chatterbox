import {createContext, useContext, useEffect, useMemo, useState} from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeCtx {
  theme: ThemeMode;
  toggle: () => void;
  setTheme: (t: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx>({theme: 'dark', toggle: () => {}, setTheme: () => {}});

const KEY = 'cb_web_theme';

function initialTheme(): ThemeMode {
  const stored = localStorage.getItem(KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // Fall back to the OS preference; the app's native look is dark.
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Keep the browser UI (mobile address bar) in sync.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#e9ede9' : '#000000');
  }, [theme]);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      setTheme: t => {
        localStorage.setItem(KEY, t);
        setThemeState(t);
      },
      toggle: () =>
        setThemeState(prev => {
          const next = prev === 'dark' ? 'light' : 'dark';
          localStorage.setItem(KEY, next);
          return next;
        }),
    }),
    [theme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
