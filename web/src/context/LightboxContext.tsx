import {Suspense, createContext, lazy, useCallback, useContext, useEffect, useState} from 'react';

/**
 * Holds which photo is open. Deliberately free of any animation library: this
 * provider is mounted in main.tsx, the eagerly-loaded entry chunk, so anything
 * imported here ships to everyone who opens the login screen. The animated
 * overlay lives behind the lazy() below for exactly that reason — see
 * components/LightboxOverlay.
 */
const LightboxOverlay = lazy(() => import('../components/LightboxOverlay'));

interface LightboxCtx {
  /**
   * `layoutId` opts this image into the shared-element expansion: pass the same
   * id to the thumbnail's <motion.img> and the photo will grow out of it rather
   * than fading in over it. Callers that omit it still get the plain fade, so
   * adopting this is per-call and nothing breaks by not doing it.
   */
  open: (url: string, layoutId?: string) => void;
}

const Ctx = createContext<LightboxCtx>({open: () => {}});

export function LightboxProvider({children}: {children: React.ReactNode}) {
  const [shown, setShown] = useState<{url: string; layoutId?: string} | null>(null);
  const open = useCallback((url: string, layoutId?: string) => setShown({url, layoutId}), []);
  const close = useCallback(() => setShown(null), []);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, close]);

  return (
    <Ctx.Provider value={{open}}>
      {children}
      {/* Mounted only once a photo has been opened, so the overlay chunk is
          fetched on first use rather than at startup. No fallback: there is
          nothing meaningful to show for the few ms before it resolves, and a
          spinner would flash on every open after the first. */}
      {shown && (
        <Suspense fallback={null}>
          <LightboxOverlay url={shown.url} layoutId={shown.layoutId} onClose={close} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}

export const useLightbox = () => useContext(Ctx);
