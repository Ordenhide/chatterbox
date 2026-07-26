import {useEffect, useState} from 'react';

/** True on narrow viewports (phones / small tablets). Updates on resize. */
export function useIsMobile(breakpoint = 820): boolean {
  const queryStr = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(queryStr).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(queryStr);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [queryStr]);

  return isMobile;
}
