/**
 * Shared motion vocabulary for the web client.
 *
 * The twin of src/utils/motion.ts in the mobile app — same numbers, same
 * names, so a card reveals through the same distance and settles at the same
 * point in the viewport on both. The CSS half of the vocabulary (the spring
 * and ease-out curves, the keyframes) lives in styles.css; this file holds the
 * values JavaScript needs to compute per frame, plus the pure helpers that do
 * the computing.
 *
 * Those helpers are here rather than inside the components for the reason the
 * mobile file gives: the parts with real arithmetic should be testable without
 * mounting anything or faking a scroll.
 */

/** How far a card travels and how much it scales on its way in. */
export const REVEAL_TRAVEL = 24;
export const REVEAL_SCALE = 0.96;

/**
 * Where in the viewport a card finishes revealing, as a fraction of viewport
 * height from the top. Matches REVEAL_ENTER_RATIO on mobile.
 */
export const REVEAL_ENTER_RATIO = 0.72;

/**
 * How revealed a card whose top edge sits at `top` should be, 0–1.
 *
 * 0 when that edge is at the bottom of the viewport, 1 once it has risen to
 * REVEAL_ENTER_RATIO. Anything already above that point — everything on screen
 * when you arrive — clamps to 1 and never animates.
 *
 * Expressed against the viewport rather than a scroll offset because that is
 * what getBoundingClientRect hands back, and it stays correct no matter which
 * element is doing the scrolling.
 */
export function revealProgress(top: number, viewportHeight: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return 1;
  const span = viewportHeight * (1 - REVEAL_ENTER_RATIO);
  if (span <= 0) return 1;
  const progress = (viewportHeight - top) / span;
  return Math.min(1, Math.max(0, progress));
}

/**
 * Parallax rates, as a fraction of scroll distance. The grid tracks scroll
 * closely; the glows lag further behind, and the gap between them is the depth.
 */
export const PARALLAX_BACKDROP = 0.3;
export const PARALLAX_GLOW = 0.15;

/** How far the glows may drift before they hold, so they never leave their corners. */
export const GLOW_DRIFT_LIMIT = 1200;

/**
 * How far a parallax layer has moved for a given scroll position, in px.
 *
 * Negative: layers move up as you scroll down, just slower than the content.
 * `limit` caps the travel for layers that are not periodic — the grid is a
 * repeating gradient and tiles forever, so it passes Infinity, while the glows
 * are single shapes that would wander off and so pass GLOW_DRIFT_LIMIT.
 */
export function parallaxOffset(scrollTop: number, rate: number, limit = Infinity): number {
  if (!Number.isFinite(scrollTop) || scrollTop <= 0) return 0;
  return -Math.min(scrollTop, limit) * rate;
}
