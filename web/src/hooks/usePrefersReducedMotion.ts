import {useEffect, useState} from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Tracks the OS "reduce motion" setting.
 *
 * framer-motion ships its own useReducedMotion, and the components inside the
 * authenticated app use it. This exists for the code that runs *before* sign-in:
 * App.tsx is in the eagerly-loaded entry chunk, and importing anything from
 * framer-motion there pulls the whole library out of the lazy MainApp chunk and
 * into the initial download — ~40kB gzipped charged to everyone who opens the
 * login screen, to answer a question one media query already answers.
 *
 * Keeps listening rather than reading once: someone can enable the setting
 * while the app is open, and an animation that ignored that would be exactly
 * the one they turned it on to stop.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
