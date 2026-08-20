import {useEffect} from 'react';
import {GLOW_DRIFT_LIMIT, PARALLAX_BACKDROP, PARALLAX_GLOW, parallaxOffset} from '../motion';
// Deliberately not framer-motion's useReducedMotion: this hook is mounted from
// App.tsx, which is in the eagerly-loaded entry chunk — see the note in
// usePrefersReducedMotion.
import {usePrefersReducedMotion} from './usePrefersReducedMotion';

/**
 * Drifts the app backdrop against the scrolling screen.
 *
 * The backdrop is `body::before` (see styles.css) — a pseudo-element, so
 * nothing can hold a ref to it and no library can animate it directly. It
 * reads two CSS custom properties instead, and this hook is what writes them.
 * That indirection is also what keeps the work off React's render path: the
 * values go straight onto the root element's style, so a scroll never causes a
 * component to re-render.
 *
 * Mount once, at the app root.
 *
 * Only screen-level scrollers drive it: the listener is on `window` in the
 * capture phase so it sees scrolling anywhere in the tree, then ignores
 * anything that is not a `.scroll` container. Without that filter a scrolling
 * dropdown or emoji picker would swing the whole backdrop, which reads as a
 * glitch rather than as depth.
 */
export function useBackdropParallax(): void {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const root = document.documentElement;
    const clear = () => {
      root.style.removeProperty('--cb-parallax-grid');
      root.style.removeProperty('--cb-parallax-glow');
    };

    if (reduced) {
      clear();
      return;
    }

    let frame = 0;
    let pending = 0;

    const apply = () => {
      frame = 0;
      root.style.setProperty(
        '--cb-parallax-grid',
        `${parallaxOffset(pending, PARALLAX_BACKDROP)}px`,
      );
      root.style.setProperty(
        '--cb-parallax-glow',
        `${parallaxOffset(pending, PARALLAX_GLOW, GLOW_DRIFT_LIMIT)}px`,
      );
    };

    const onScroll = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Element) || !target.classList.contains('scroll')) return;
      pending = target.scrollTop;
      // Coalesced to one write per painted frame rather than one per event.
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('scroll', onScroll, {capture: true, passive: true});
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll, {capture: true});
      clear();
    };
  }, [reduced]);
}
