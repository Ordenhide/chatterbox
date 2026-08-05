import {useCallback} from 'react';
import confetti from 'canvas-confetti';

/**
 * A confetti burst of the emoji you just reacted with, fired from the point
 * you tapped.
 *
 * The first version of this hand-rolled six CSS-animated spans, which was
 * technically a burst and visually a shrug. canvas-confetti draws to its own
 * canvas with real physics — gravity, drift, spin, decay — so a reaction
 * actually lands as an event.
 *
 * `shapeFromText` rasterises the emoji once per call and reuses it across all
 * particles in that burst, so the cost is one draw, not one per particle.
 */

/** Coordinates are normalised 0–1 across the viewport, which is what the library expects. */
function origin(x: number, y: number) {
  return {
    x: Math.min(Math.max(x / window.innerWidth, 0), 1),
    y: Math.min(Math.max(y / window.innerHeight, 0), 1),
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function useReactionBurst() {
  const burst = useCallback((emoji: string, x: number, y: number) => {
    // The library animates on its own canvas, outside the CSS cascade, so the
    // blanket reduced-motion rule in styles.css cannot reach it — it has to be
    // checked here or this becomes the one effect that ignores the setting.
    if (prefersReducedMotion()) return;

    const shape = confetti.shapeFromText({text: emoji, scalar: 2.4});
    const at = origin(x, y);

    // Two waves: a tight fast burst, then a slower, wider one a beat later, so
    // it reads as an explosion settling rather than a single puff.
    confetti({
      origin: at,
      shapes: [shape],
      scalar: 2.4,
      particleCount: 18,
      spread: 60,
      startVelocity: 32,
      decay: 0.92,
      gravity: 0.7,
      ticks: 140,
      disableForReducedMotion: true,
    });
    window.setTimeout(() => {
      confetti({
        origin: at,
        shapes: [shape],
        scalar: 1.7,
        particleCount: 14,
        spread: 110,
        startVelocity: 22,
        decay: 0.9,
        gravity: 0.85,
        ticks: 120,
        disableForReducedMotion: true,
      });
    }, 90);
  }, []);

  return {burst};
}

/**
 * Full-screen celebration, for moments bigger than a single reaction (a first
 * message in a new chat). Uses the chat's accent so it still belongs to the
 * palette rather than arriving as generic party colours.
 */
export function celebrate(accent: string) {
  if (prefersReducedMotion()) return;
  const colors = [accent, '#ffffff'];
  const shoot = (particleRatio: number, opts: confetti.Options) =>
    confetti({
      origin: {y: 0.7},
      colors,
      particleCount: Math.floor(160 * particleRatio),
      disableForReducedMotion: true,
      ...opts,
    });

  shoot(0.25, {spread: 26, startVelocity: 55});
  shoot(0.2, {spread: 60});
  shoot(0.35, {spread: 100, decay: 0.91, scalar: 0.8});
  shoot(0.1, {spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2});
  shoot(0.1, {spread: 120, startVelocity: 45});
}
