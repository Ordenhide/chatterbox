import {
  BURST_COUNT,
  ENTRANCE_SCALE,
  makeBurst,
  SPRING,
  staggerDelay,
  STAGGER_MAX_STEPS,
  STAGGER_STEP_MS,
  TIMING,
} from '../motion';

describe('staggerDelay', () => {
  it('steps evenly through the start of a list', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(STAGGER_STEP_MS);
    expect(staggerDelay(3)).toBe(3 * STAGGER_STEP_MS);
  });

  // Without the cap, row 60 of a long list would sit blank for nearly two
  // seconds before appearing.
  it('caps so a long list never waits on its last rows', () => {
    const ceiling = STAGGER_MAX_STEPS * STAGGER_STEP_MS;
    expect(staggerDelay(STAGGER_MAX_STEPS)).toBe(ceiling);
    expect(staggerDelay(200)).toBe(ceiling);
    expect(staggerDelay(5000)).toBe(ceiling);
  });

  // Nonsense input animates immediately rather than being clamped to the
  // ceiling: a row that appears instantly is a far smaller bug than one that
  // waits, and NaN would otherwise propagate into a delay of NaN.
  it('shows the row immediately for a nonsense index', () => {
    expect(staggerDelay(-1)).toBe(0);
    expect(staggerDelay(NaN)).toBe(0);
    expect(staggerDelay(Infinity)).toBe(0);
  });
});

describe('makeBurst', () => {
  it('makes a full burst of the emoji that was tapped', () => {
    const parts = makeBurst('❤️');
    expect(parts).toHaveLength(BURST_COUNT);
    expect(parts.every(p => p.emoji === '❤️')).toBe(true);
  });

  it('gives every particle a distinct id, so React can key them', () => {
    const parts = makeBurst('👍');
    expect(new Set(parts.map(p => p.id)).size).toBe(BURST_COUNT);
  });

  // A burst where every particle took the same path would read as one big
  // emoji rather than a scatter.
  it('spreads particles both directions around the tap', () => {
    // 0 and 1 straddle the 0.5 midpoint the spread is centred on.
    const low = makeBurst('x', () => 0);
    const high = makeBurst('x', () => 1);
    expect(low[0].drift).toBeLessThan(0);
    expect(high[0].drift).toBeGreaterThan(0);
    expect(low[0].spin).toBeLessThan(0);
    expect(high[0].spin).toBeGreaterThan(0);
  });

  it('keeps drift and spin within a sane range', () => {
    for (const p of makeBurst('x')) {
      expect(Math.abs(p.drift)).toBeLessThanOrEqual(60);
      expect(Math.abs(p.spin)).toBeLessThanOrEqual(45);
    }
  });

  it('gives particles varied lifetimes so they do not vanish in unison', () => {
    expect(makeBurst('x', () => 0)[0].life).toBe(900);
    expect(makeBurst('x', () => 1)[0].life).toBe(1400);
  });
});

describe('animation configs', () => {
  // Anything running off the native driver animates across the JS bridge each
  // frame, which is exactly what makes RN animation stutter under load.
  it('always use the native driver', () => {
    expect(SPRING.useNativeDriver).toBe(true);
    expect(TIMING.useNativeDriver).toBe(true);
  });

  it('the entrance scales up, never down', () => {
    expect(ENTRANCE_SCALE).toBeLessThan(1);
    expect(ENTRANCE_SCALE).toBeGreaterThan(0.5);
  });
});
