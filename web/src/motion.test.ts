import {describe, expect, it} from 'vitest';
import {
  CASCADE_MAX_STEPS,
  CASCADE_STEP_MS,
  COLD_OPEN_RESOLVE_MS,
  COLD_OPEN_SEAL_MS,
  COLD_OPEN_SETTLE_MS,
  COLD_OPEN_TOTAL_MS,
  GLOW_DRIFT_LIMIT,
  PARALLAX_BACKDROP,
  PARALLAX_GLOW,
  REVEAL_ENTER_RATIO,
  SCRAMBLE_MAX_MS,
  SCRAMBLE_MIN_MS,
  SCRAMBLE_WINDOW,
  cascadeDelay,
  coldOpenFrame,
  parallaxOffset,
  revealProgress,
  scrambleDuration,
  scrambleFrame,
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

describe('scrambleDuration', () => {
  it('takes longer for longer messages', () => {
    expect(scrambleDuration(40)).toBeGreaterThan(scrambleDuration(4));
  });

  it('never resolves faster than the floor or slower than the ceiling', () => {
    expect(scrambleDuration(1)).toBeGreaterThanOrEqual(SCRAMBLE_MIN_MS);
    expect(scrambleDuration(100000)).toBe(SCRAMBLE_MAX_MS);
    expect(scrambleDuration(0)).toBe(SCRAMBLE_MIN_MS);
    expect(scrambleDuration(NaN)).toBe(SCRAMBLE_MIN_MS);
  });
});

describe('scrambleFrame', () => {
  const TEXT = 'Meet me at the pier at six';
  const fixed = (n: number) => () => n;

  it('resolves nothing at progress 0 and everything at 1', () => {
    expect(scrambleFrame(TEXT, 0, fixed(0))).not.toBe(TEXT);
    expect(scrambleFrame(TEXT, 1)).toBe(TEXT);
  });

  it('never scrambles whitespace, so line breaks hold still', () => {
    const frame = scrambleFrame(TEXT, 0, fixed(0));
    for (let i = 0; i < TEXT.length; i++) {
      if (/\s/.test(TEXT[i])) expect(frame[i]).toBe(TEXT[i]);
    }
  });

  it('resolves left to right as progress advances', () => {
    const frame = scrambleFrame(TEXT, 0.5, fixed(0));
    const resolvedCount = Math.floor(0.5 * TEXT.length);
    expect(frame.slice(0, resolvedCount).replace(/\s/g, '')).toBe(
      TEXT.slice(0, resolvedCount).replace(/\s/g, ''),
    );
  });

  it('caps the shimmer window rather than scrambling the whole tail', () => {
    const long = 'x'.repeat(200);
    const frame = scrambleFrame(long, 0, fixed(0));
    // Well past the shimmer window, the glyph is fixed by index rather than
    // random — running twice with different "random" fns must agree there.
    const frame2 = scrambleFrame(long, 0, fixed(0.99));
    expect(frame.slice(SCRAMBLE_WINDOW + 10)).toBe(frame2.slice(SCRAMBLE_WINDOW + 10));
  });

  it('handles empty input and out-of-range progress without throwing', () => {
    expect(scrambleFrame('', 0.5)).toBe('');
    expect(scrambleFrame(TEXT, NaN)).toBe(TEXT);
    expect(scrambleFrame(TEXT, -1, fixed(0))).not.toBe(TEXT);
  });
});

describe('coldOpenFrame', () => {
  it('walks seal -> resolve -> settle -> done in order', () => {
    expect(coldOpenFrame(0).phase).toBe('seal');
    expect(coldOpenFrame(COLD_OPEN_SEAL_MS / 2).phase).toBe('seal');
    expect(coldOpenFrame(COLD_OPEN_SEAL_MS).phase).toBe('resolve');
    expect(coldOpenFrame(COLD_OPEN_SEAL_MS + COLD_OPEN_RESOLVE_MS).phase).toBe('settle');
    expect(coldOpenFrame(COLD_OPEN_TOTAL_MS).phase).toBe('done');
    expect(coldOpenFrame(COLD_OPEN_TOTAL_MS * 10).phase).toBe('done');
  });

  it('reports progress within the current phase, not across the whole run', () => {
    const midResolve = coldOpenFrame(COLD_OPEN_SEAL_MS + COLD_OPEN_RESOLVE_MS / 2);
    expect(midResolve.phase).toBe('resolve');
    expect(midResolve.progress).toBeCloseTo(0.5);

    const midSettle = coldOpenFrame(
      COLD_OPEN_SEAL_MS + COLD_OPEN_RESOLVE_MS + COLD_OPEN_SETTLE_MS / 2,
    );
    expect(midSettle.phase).toBe('settle');
    expect(midSettle.progress).toBeCloseTo(0.5);
  });

  it('reads a bad clock as the start rather than throwing', () => {
    expect(coldOpenFrame(NaN)).toEqual({phase: 'seal', progress: 0});
    expect(coldOpenFrame(-1)).toEqual({phase: 'seal', progress: 0});
    expect(coldOpenFrame(Infinity).phase).toBe('seal');
  });
});

describe('cascadeDelay', () => {
  it('steps each element back by one interval', () => {
    expect(cascadeDelay(0)).toBe(0);
    expect(cascadeDelay(1)).toBe(CASCADE_STEP_MS);
    expect(cascadeDelay(3)).toBe(3 * CASCADE_STEP_MS);
  });

  it('caps so a cascade never reads as the screen being slow', () => {
    const ceiling = CASCADE_MAX_STEPS * CASCADE_STEP_MS;
    expect(cascadeDelay(CASCADE_MAX_STEPS)).toBe(ceiling);
    expect(cascadeDelay(CASCADE_MAX_STEPS + 50)).toBe(ceiling);
  });

  it('treats nonsense positions as first', () => {
    expect(cascadeDelay(-3)).toBe(0);
    expect(cascadeDelay(NaN)).toBe(0);
  });
});
