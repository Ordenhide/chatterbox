import {motion, useMotionValue, useReducedMotion, useTransform} from 'framer-motion';
import {useEffect, useRef} from 'react';
import type React from 'react';
import {REVEAL_SCALE, REVEAL_TRAVEL, revealProgress} from '../motion';

/**
 * Reveals its child as a function of scroll *position* — the web twin of the
 * mobile app's components/RevealOnScroll.
 *
 * Not `whileInView`: that fires once when an element crosses a threshold, so
 * the reveal plays on a timer that happens to start near a scroll. This maps
 * the card's actual place in the viewport onto its progress, so holding it
 * half-visible holds it half-revealed and scrolling back up un-reveals it.
 *
 * The scroll listener is registered on `window` in the capture phase. Scroll
 * events do not bubble, but they do capture, so one listener catches scrolling
 * from any nested container — which this app has (each screen scrolls inside
 * its own `.scroll` div, not the window) and would otherwise have to be
 * threaded down as a ref.
 *
 * Measurement is coalesced into an animation frame so a burst of scroll events
 * produces one getBoundingClientRect per painted frame rather than per event,
 * and the result is written to a motion value, which framer applies straight to
 * the DOM without re-rendering React.
 */
export default function RevealOnScroll({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // Defaults to fully revealed: if anything goes wrong, content is visible.
  const progress = useMotionValue(1);

  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      progress.set(revealProgress(el.getBoundingClientRect().top, window.innerHeight));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, {capture: true, passive: true});
    window.addEventListener('resize', schedule, {passive: true});
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, {capture: true});
      window.removeEventListener('resize', schedule);
    };
  }, [progress, reduced]);

  const opacity = useTransform(progress, [0, 1], [0, 1]);
  const y = useTransform(progress, [0, 1], [REVEAL_TRAVEL, 0]);
  const scale = useTransform(progress, [0, 1], [REVEAL_SCALE, 1]);

  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{...style, opacity, y, scale}}>
      {children}
    </motion.div>
  );
}
