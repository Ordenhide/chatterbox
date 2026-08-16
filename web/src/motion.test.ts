import {describe, expect, it} from 'vitest';
import {
  GLOW_DRIFT_LIMIT,
  PARALLAX_BACKDROP,
  PARALLAX_GLOW,
  REVEAL_ENTER_RATIO,
  parallaxOffset,
  revealProgress,
} from './motion';

const VIEWPORT = 800;

describe('revealProgress', () => {
  it('is 0 as the card reaches the bottom edge and 1 once it passes the settle point', () => {
    expect(revealProgress(VIEWPORT, VIEWPORT)).toBe(0);
    expect(revealProgress(VIEWPORT * REVEAL_ENTER_RATIO, VIEWPORT)).toBeCloseTo(1);
  });

  it('moves continuously through the window rather than snapping', () => {
    const span = VIEWPORT * (1 - REVEAL_ENTER_RATIO);
    const halfway = revealProgress(VIEWPORT - span / 2, VIEWPORT);
    expect(halfway).toBeCloseTo(0.5);
  });

  // Content already on screen when you arrive should be there, not perform.
  it('clamps to fully revealed above the settle point, including off the top', () => {
    expect(revealProgress(0, VIEWPORT)).toBe(1);
    expect(revealProgress(-5000, VIEWPORT)).toBe(1);
  });

  it('clamps to hidden below the viewport rather than going negative', () => {
    expect(revealProgress(VIEWPORT * 3, VIEWPORT)).toBe(0);
  });

  // Measured before layout, or in a jsdom/SSR pass with no viewport: show the
  // content rather than leaving it invisible with no scroll able to reveal it.
  it('falls back to revealed when the viewport is unmeasurable', () => {
    expect(revealProgress(100, 0)).toBe(1);
    expect(revealProgress(100, Number.NaN)).toBe(1);
    expect(revealProgress(Number.NaN, VIEWPORT)).toBe(1);
  });
});

describe('parallaxOffset', () => {
  it('moves layers up as the page scrolls down, but slower than the content', () => {
    const offset = parallaxOffset(1000, PARALLAX_BACKDROP);
    expect(offset).toBe(-300);
    expect(Math.abs(offset)).toBeLessThan(1000);
  });

  // The gap between the two rates is the entire illusion of depth; if they
  // matched, the backdrop would just be scrolling.
  it('drifts the glows more slowly than the grid', () => {
    expect(Math.abs(parallaxOffset(1000, PARALLAX_GLOW))).toBeLessThan(
      Math.abs(parallaxOffset(1000, PARALLAX_BACKDROP)),
    );
  });

  it('holds a limited layer once it hits its ceiling, so the glows never wander off', () => {
    const atLimit = parallaxOffset(GLOW_DRIFT_LIMIT, PARALLAX_GLOW, GLOW_DRIFT_LIMIT);
    expect(parallaxOffset(GLOW_DRIFT_LIMIT * 10, PARALLAX_GLOW, GLOW_DRIFT_LIMIT)).toBe(atLimit);
  });

  it('lets an unlimited layer keep going, since the grid tiles forever', () => {
    expect(parallaxOffset(50_000, PARALLAX_BACKDROP)).toBe(-50_000 * PARALLAX_BACKDROP);
  });

  it('stays put at or above the top, including on overscroll', () => {
    expect(parallaxOffset(0, PARALLAX_BACKDROP)).toBe(0);
    expect(parallaxOffset(-200, PARALLAX_BACKDROP)).toBe(0);
  });
});
