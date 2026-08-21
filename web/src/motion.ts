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

/* ------------------------------------------------------------------------ *
 * Seal & Resolve
 *
 * New on the web client — the mobile app's signature effect (see the Seal &
 * Resolve note in src/utils/motion.ts on that side) had no web counterpart.
 * Ported here rather than reinvented, same constants and same algorithm, so a
 * message resolving on one client and the same message resolving on the
 * other are the same animation, not two effects that happen to look similar.
 * ------------------------------------------------------------------------ */

export const CIPHER_GLYPHS = 'ABCDEF0123456789/+=%$#@&*<>{}[]^~';

export const SCRAMBLE_MIN_MS = 360;
export const SCRAMBLE_MAX_MS = 1200;
export const SCRAMBLE_MS_PER_CHAR = 18;

/** How long a message takes to resolve: proportional to length, clamped so a
 * two-word reply doesn't feel broken and a paragraph doesn't outlast reading it. */
export function scrambleDuration(length: number): number {
  if (!Number.isFinite(length) || length <= 0) return SCRAMBLE_MIN_MS;
  return Math.min(SCRAMBLE_MAX_MS, SCRAMBLE_MIN_MS + length * SCRAMBLE_MS_PER_CHAR);
}

/**
 * How many characters shimmer at the resolving edge at once — the cost cap
 * that keeps a long message's per-frame work bounded, and reads as a wave of
 * legibility travelling through the text rather than the whole block twitching.
 */
export const SCRAMBLE_WINDOW = 48;

/**
 * One frame of the scramble: `text` with the first `progress` share resolved
 * and the rest still ciphertext. Whitespace is never scrambled, so line breaks
 * hold still and the element doesn't reflow mid-animation.
 */
export function scrambleFrame(text: string, progress: number, random: () => number = Math.random): string {
  if (typeof text !== 'string' || text.length === 0) return '';
  if (!Number.isFinite(progress)) return text;
  if (progress >= 1) return text;

  const clamped = Math.max(0, progress);
  const resolved = Math.floor(clamped * text.length);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (i < resolved || /\s/.test(char)) {
      out += char;
    } else if (i < resolved + SCRAMBLE_WINDOW) {
      out += CIPHER_GLYPHS[Math.floor(random() * CIPHER_GLYPHS.length) % CIPHER_GLYPHS.length];
    } else {
      // Beyond the shimmer window the glyph is a function of its index, so it
      // stays put instead of flickering — reads as sealed rather than noise.
      out += CIPHER_GLYPHS[i % CIPHER_GLYPHS.length];
    }
  }
  return out;
}

/* ------------------------------------------------------------------------ *
 * Cold open
 *
 * The launch sequence — twin of ColdOpen.tsx on mobile, same three phases and
 * same durations, so the two clients introduce the product identically. See
 * that file for why it's three phases rather than one tween.
 * ------------------------------------------------------------------------ */

export const COLD_OPEN_SEAL_MS = 620;
export const COLD_OPEN_RESOLVE_MS = 900;
export const COLD_OPEN_SETTLE_MS = 420;
export const COLD_OPEN_TOTAL_MS = COLD_OPEN_SEAL_MS + COLD_OPEN_RESOLVE_MS + COLD_OPEN_SETTLE_MS;

export type ColdOpenPhase = 'seal' | 'resolve' | 'settle' | 'done';

export interface ColdOpenFrame {
  phase: ColdOpenPhase;
  /** 0→1 *within the current phase*, not across the whole sequence. */
  progress: number;
}

/** Which phase the cold open is in at `elapsed` ms, and how far through it. */
export function coldOpenFrame(elapsed: number): ColdOpenFrame {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return {phase: 'seal', progress: 0};
  if (elapsed < COLD_OPEN_SEAL_MS) {
    return {phase: 'seal', progress: elapsed / COLD_OPEN_SEAL_MS};
  }
  const afterSeal = elapsed - COLD_OPEN_SEAL_MS;
  if (afterSeal < COLD_OPEN_RESOLVE_MS) {
    return {phase: 'resolve', progress: afterSeal / COLD_OPEN_RESOLVE_MS};
  }
  const afterResolve = afterSeal - COLD_OPEN_RESOLVE_MS;
  if (afterResolve < COLD_OPEN_SETTLE_MS) {
    return {phase: 'settle', progress: afterResolve / COLD_OPEN_SETTLE_MS};
  }
  return {phase: 'done', progress: 1};
}

/* ------------------------------------------------------------------------ *
 * Entrance cascade
 *
 * Twin of cascadeDelay on mobile. Distinct from the row-by-row reveal above:
 * this is for a handful of elements on a screen you've just arrived at, with
 * nothing competing for attention, so the step is long enough to read as
 * choreography.
 * ------------------------------------------------------------------------ */

export const CASCADE_STEP_MS = 85;
export const CASCADE_MAX_STEPS = 6;

export function cascadeDelay(index: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.floor(index), CASCADE_MAX_STEPS) * CASCADE_STEP_MS;
}
