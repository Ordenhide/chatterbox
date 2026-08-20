import {
  BURST_COUNT,
  ARC_MAGNET_RADIUS,
  CASCADE_MAX_STEPS,
  CASCADE_STEP_MS,
  COLD_OPEN_RESOLVE_MS,
  COLD_OPEN_SEAL_MS,
  COLD_OPEN_SETTLE_MS,
  COLD_OPEN_TOTAL_MS,
  cascadeDelay,
  coldOpenFrame,
  arcMagnetism,
  nearestArcSlot,
  reactionArcSlots,
  DECELERATION_FAST,
  DISINTEGRATE_MAX_GLYPHS,
  disintegrateShards,
  shouldBandDisintegrate,
  DECELERATION_NORMAL,
  ENTRANCE_SCALE,
  FANOUT_MAX_GHOSTS,
  fanOutGhosts,
  fitContain,
  SCRAMBLE_MAX_MS,
  SCRAMBLE_MIN_MS,
  SCRAMBLE_WINDOW,
  scrambleDuration,
  scrambleFrame,
  normalizedVelocity,
  project,
  rubberband,
  rubberbandRange,
  shouldCommit,
  makeBurst,
  makeThemeParticles,
  petMotionProfile,
  REVEAL_ENTER_RATIO,
  revealWindow,
  SPRING,
  staggerDelay,
  STAGGER_MAX_STEPS,
  STAGGER_STEP_MS,
  TIMING,
} from '../motion';

describe('petMotionProfile', () => {
  const MOODS = ['happy', 'neutral', 'sad', 'sleeping'] as const;

  it('gives every mood a distinct profile, so mood changes are visible', () => {
    const profiles = MOODS.map(petMotionProfile);
    const serialized = profiles.map(p => JSON.stringify(p));
    expect(new Set(serialized).size).toBe(MOODS.length);
  });

  // The whole point of driving these off mood is that a happier pet reads as
  // livelier, not just "the same animation, faster or slower".
  it('scales liveliness down monotonically from happy to sleeping', () => {
    const [happy, neutral, sad, sleeping] = MOODS.map(petMotionProfile);
    expect(happy.bobAmplitude).toBeGreaterThan(neutral.bobAmplitude);
    expect(neutral.bobAmplitude).toBeGreaterThan(sad.bobAmplitude);
    expect(sad.bobAmplitude).toBeGreaterThanOrEqual(sleeping.bobAmplitude);

    expect(happy.rotateDeg).toBeGreaterThan(neutral.rotateDeg);
    expect(neutral.rotateDeg).toBeGreaterThan(sad.rotateDeg);
    expect(sad.rotateDeg).toBeGreaterThanOrEqual(sleeping.rotateDeg);
  });

  // A faster idle cycle is what makes "happy" read as more energetic than a
  // bigger bob alone would: it's not just moving further, it's moving more often.
  it('cycles faster the happier the mood', () => {
    const [happy, neutral, sad, sleeping] = MOODS.map(petMotionProfile);
    expect(happy.bobDuration).toBeLessThan(neutral.bobDuration);
    expect(neutral.bobDuration).toBeLessThan(sad.bobDuration);
    expect(sad.bobDuration).toBeLessThan(sleeping.bobDuration);
  });

  it('dims a sleeping pet but keeps every other mood at full opacity', () => {
    expect(petMotionProfile('sleeping').restOpacity).toBeLessThan(1);
    expect(petMotionProfile('happy').restOpacity).toBe(1);
    expect(petMotionProfile('neutral').restOpacity).toBe(1);
  });

  it('never returns a negative or zero duration, which Animated.loop would reject', () => {
    for (const mood of MOODS) {
      expect(petMotionProfile(mood).bobDuration).toBeGreaterThan(0);
    }
  });
});

describe('fitContain', () => {
  const BOUNDS = {width: 400, height: 800};

  it('fits a wide image to the available width, letterboxed vertically', () => {
    // 2:1 into a 1:2 box — width is the binding constraint.
    expect(fitContain({width: 1000, height: 500}, BOUNDS)).toEqual({width: 400, height: 200});
  });

  it('fits a tall image to the available height', () => {
    // 1:4 into a 1:2 box — height binds this time.
    expect(fitContain({width: 500, height: 2000}, BOUNDS)).toEqual({width: 200, height: 800});
  });

  it('preserves aspect ratio in both directions', () => {
    const {width, height} = fitContain({width: 1600, height: 900}, BOUNDS);
    expect(width / height).toBeCloseTo(16 / 9);
  });

  it('scales a small image up rather than leaving it tiny in the middle', () => {
    expect(fitContain({width: 40, height: 20}, BOUNDS)).toEqual({width: 400, height: 200});
  });

  // Image.getSize can fail (offline, dead URL); the viewer still has to open.
  it('falls back to the full bounds when the natural size is unknown', () => {
    expect(fitContain({width: 0, height: 0}, BOUNDS)).toEqual(BOUNDS);
    expect(fitContain({width: Number.NaN, height: 100}, BOUNDS)).toEqual(BOUNDS);
    expect(fitContain({width: -10, height: 100}, BOUNDS)).toEqual(BOUNDS);
  });
});

describe('revealWindow', () => {
  const VIEWPORT = 800;

  it('starts the reveal as the card reaches the bottom edge and finishes it above centre', () => {
    const [start, end] = revealWindow(2000, VIEWPORT);
    // Scrolled to `start`, the card's top sits exactly at the viewport bottom.
    expect(start).toBe(2000 - VIEWPORT);
    // By `end` it has risen to REVEAL_ENTER_RATIO of the way down the screen.
    expect(end).toBe(2000 - VIEWPORT * REVEAL_ENTER_RATIO);
  });

  it('always returns an increasing range, which Animated requires of an inputRange', () => {
    for (const y of [0, 1, 500, 12_345]) {
      const [start, end] = revealWindow(y, VIEWPORT);
      expect(end).toBeGreaterThan(start);
    }
  });

  // A card in the first screenful produces an all-negative window, so at scroll
  // offset 0 it is already past the end and clamps to fully revealed. Content
  // that is on screen when you arrive should be there, not perform.
  it('leaves cards above the fold already revealed at rest', () => {
    const [, end] = revealWindow(0, VIEWPORT);
    expect(end).toBeLessThan(0);
  });

  // Measured before layout, viewport height is 0; the natural range would
  // collapse to a single point and Animated rejects that.
  it('falls back to a usable range when the viewport has not been measured', () => {
    expect(revealWindow(500, 0)).toEqual([0, 1]);
    expect(revealWindow(500, Number.NaN)).toEqual([0, 1]);
    expect(revealWindow(Number.NaN, VIEWPORT)).toEqual([0, 1]);
  });
});

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

describe('makeThemeParticles', () => {
  it('builds exactly `density` particles', () => {
    expect(makeThemeParticles(9, 'dot')).toHaveLength(9);
    expect(makeThemeParticles(13, 'spark')).toHaveLength(13);
  });

  it('gives every particle a distinct id, so React can key them', () => {
    const particles = makeThemeParticles(10, 'confetti');
    expect(new Set(particles.map(p => p.id)).size).toBe(10);
  });

  it('spreads particles across the full width, not clustered at one edge', () => {
    const low = makeThemeParticles(1, 'dot', () => 0)[0];
    const high = makeThemeParticles(1, 'dot', () => 1)[0];
    expect(low.left).toBe(0);
    expect(high.left).toBe(100);
  });

  it('sizes confetti larger than spark, and spark larger than dot', () => {
    const size = (style: Parameters<typeof makeThemeParticles>[1]) => makeThemeParticles(1, style)[0].size;
    expect(size('confetti')).toBeGreaterThan(size('dot'));
    expect(size('dot')).toBeGreaterThan(size('spark'));
  });

  it('gives every particle a positive delay and duration', () => {
    for (const p of makeThemeParticles(12, 'dot')) {
      expect(p.delay).toBeGreaterThanOrEqual(0);
      expect(p.duration).toBeGreaterThan(0);
    }
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

describe('rubberband', () => {
  it('resists: travel is always less than the pull that produced it', () => {
    for (const pull of [10, 50, 120, 400]) {
      expect(rubberband(pull, 300)).toBeLessThan(pull);
    }
  });

  it('resists harder the further you pull', () => {
    // The *ratio* of travel to pull must keep shrinking. Merely checking that
    // travel increases would also pass for a linear drag, which is the thing
    // rubber-banding exists to not be.
    const ratios = [10, 60, 200, 600].map(pull => rubberband(pull, 300) / pull);
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeLessThan(ratios[i - 1]);
    }
  });

  it('never travels past the dimension, however hard it is pulled', () => {
    // The asymptote is what makes the edge feel like a stop rather than a
    // number running out.
    expect(rubberband(1e6, 300)).toBeLessThan(300);
    expect(rubberband(1e9, 300)).toBeLessThan(300);
    expect(rubberband(1e9, 300)).toBeGreaterThan(299);
  });

  it('preserves direction, so callers need no special case per edge', () => {
    expect(rubberband(-120, 300)).toBeCloseTo(-rubberband(120, 300), 10);
    expect(rubberband(0, 300)).toBe(0);
  });

  it('resists harder with a smaller constant', () => {
    expect(rubberband(100, 300, 0.3)).toBeLessThan(rubberband(100, 300, 0.55));
  });

  it('yields no travel for degenerate input rather than NaN or Infinity', () => {
    for (const value of [
      rubberband(100, 0),
      rubberband(100, -50),
      rubberband(NaN, 300),
      rubberband(100, NaN),
      rubberband(100, 300, 0),
    ]) {
      expect(value).toBe(0);
    }
  });
});

describe('project', () => {
  it('projects further the faster the flick', () => {
    expect(project(2000)).toBeGreaterThan(project(500));
  });

  it('preserves direction and rests in place at zero velocity', () => {
    expect(project(-1000)).toBeCloseTo(-project(1000), 10);
    expect(project(0)).toBe(0);
  });

  it('stops sooner at the fast deceleration rate', () => {
    expect(project(1000, DECELERATION_FAST)).toBeLessThan(project(1000, DECELERATION_NORMAL));
  });

  it('matches Apple’s formula at a known velocity', () => {
    // 1000 px/s at 0.998 => (1000/1000) * (0.998/0.002) = 499 px
    expect(project(1000, 0.998)).toBeCloseTo(499, 6);
  });

  it('projects nowhere when the deceleration rate has no resting point', () => {
    for (const value of [project(1000, 1), project(1000, 1.5), project(1000, 0), project(1000, -1), project(NaN)]) {
      expect(value).toBe(0);
    }
  });
});

describe('scrambleDuration', () => {
  it('takes longer for longer messages', () => {
    expect(scrambleDuration(40)).toBeGreaterThan(scrambleDuration(4));
  });

  it('never resolves faster than the floor or slower than the ceiling', () => {
    expect(scrambleDuration(1)).toBeGreaterThanOrEqual(SCRAMBLE_MIN_MS);
    // A paragraph must not still be resolving after you have read it.
    expect(scrambleDuration(100000)).toBe(SCRAMBLE_MAX_MS);
    expect(scrambleDuration(0)).toBe(SCRAMBLE_MIN_MS);
    expect(scrambleDuration(NaN)).toBe(SCRAMBLE_MIN_MS);
  });
});

describe('coldOpenFrame', () => {
  it('walks seal -> resolve -> settle -> done in order', () => {
    expect(coldOpenFrame(0).phase).toBe('seal');
    expect(coldOpenFrame(COLD_OPEN_SEAL_MS / 2).phase).toBe('seal');
    expect(coldOpenFrame(COLD_OPEN_SEAL_MS).phase).toBe('resolve');
    expect(coldOpenFrame(COLD_OPEN_SEAL_MS + COLD_OPEN_RESOLVE_MS).phase).toBe('settle');
    expect(coldOpenFrame(COLD_OPEN_TOTAL_MS).phase).toBe('done');
    // Still done long after — the sequence must not wrap round to seal.
    expect(coldOpenFrame(COLD_OPEN_TOTAL_MS * 10).phase).toBe('done');
  });

  it('reports progress within the current phase, not across the whole run', () => {
    // Halfway through resolve is 0.5, despite being much further than that
    // through the sequence overall.
    const midResolve = coldOpenFrame(COLD_OPEN_SEAL_MS + COLD_OPEN_RESOLVE_MS / 2);
    expect(midResolve.phase).toBe('resolve');
    expect(midResolve.progress).toBeCloseTo(0.5);

    const midSettle = coldOpenFrame(
      COLD_OPEN_SEAL_MS + COLD_OPEN_RESOLVE_MS + COLD_OPEN_SETTLE_MS / 2,
    );
    expect(midSettle.phase).toBe('settle');
    expect(midSettle.progress).toBeCloseTo(0.5);
  });

  it('never leaves progress outside 0..1', () => {
    for (let t = -500; t <= COLD_OPEN_TOTAL_MS + 500; t += 37) {
      const {progress} = coldOpenFrame(t);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });

  it('reads a bad clock as the start rather than throwing', () => {
    // Driven by Date.now() deltas; a bad reading should cost a frame, not the
    // whole launch screen.
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

  it('is slower than the list-row stagger it is distinct from', () => {
    // The two exist precisely because they are paced differently; if this ever
    // stops holding, one of them is redundant.
    expect(CASCADE_STEP_MS).toBeGreaterThan(STAGGER_STEP_MS);
  });

  it('treats nonsense positions as first', () => {
    expect(cascadeDelay(-3)).toBe(0);
    expect(cascadeDelay(NaN)).toBe(0);
  });
});

describe('scrambleFrame', () => {
  const TEXT = 'Meet me at the pier at six';
  // Deterministic "random" so the assertions are about behaviour, not luck.
  const fixed = () => 0;

  it('is fully resolved at progress 1 and fully sealed at progress 0', () => {
    expect(scrambleFrame(TEXT, 1, fixed)).toBe(TEXT);
    const sealed = scrambleFrame(TEXT, 0, fixed);
    expect(sealed).not.toBe(TEXT);
    expect(sealed).toHaveLength(TEXT.length);
  });

  it('resolves left to right', () => {
    const half = scrambleFrame(TEXT, 0.5, fixed);
    const resolved = Math.floor(0.5 * TEXT.length);
    expect(half.slice(0, resolved)).toBe(TEXT.slice(0, resolved));
    expect(half.slice(resolved)).not.toBe(TEXT.slice(resolved));
  });

  // Word shape is most of what makes the resolve read as a sentence arriving,
  // and moving the spaces would reflow the bubble mid-animation.
  it('never scrambles whitespace, so the bubble cannot reflow', () => {
    for (const p of [0, 0.25, 0.5, 0.75]) {
      const frame = scrambleFrame(TEXT, p, fixed);
      expect(frame).toHaveLength(TEXT.length);
      for (let i = 0; i < TEXT.length; i++) {
        if (/\s/.test(TEXT[i])) expect(frame[i]).toBe(TEXT[i]);
      }
    }
  });

  it('bounds per-frame work on long messages via the shimmer window', () => {
    const long = 'x'.repeat(SCRAMBLE_WINDOW * 4);
    let calls = 0;
    scrambleFrame(long, 0, () => {
      calls++;
      return 0;
    });
    // Only the resolving edge shimmers; the rest is index-derived and static.
    expect(calls).toBeLessThanOrEqual(SCRAMBLE_WINDOW);
  });

  it('is stable beyond the shimmer window rather than flickering', () => {
    const long = 'x'.repeat(SCRAMBLE_WINDOW * 3);
    let n = 0;
    const varying = () => (n++ % 7) / 7;
    const a = scrambleFrame(long, 0, varying);
    const b = scrambleFrame(long, 0, varying);
    expect(a.slice(SCRAMBLE_WINDOW)).toBe(b.slice(SCRAMBLE_WINDOW));
  });

  it('handles empty and degenerate input', () => {
    expect(scrambleFrame('', 0.5, fixed)).toBe('');
    expect(scrambleFrame(TEXT, NaN, fixed)).toBe(TEXT);
    expect(scrambleFrame(TEXT, -5, fixed)).toHaveLength(TEXT.length);
  });
});

describe('fanOutGhosts', () => {
  it('draws one copy per recipient', () => {
    expect(fanOutGhosts(5, () => 0)).toHaveLength(5);
  });

  it('caps the drawn copies however large the group is', () => {
    // MAX_GROUP_MEMBERS is 32; past a dozen the bloom just reads as a crowd.
    expect(fanOutGhosts(32, () => 0)).toHaveLength(FANOUT_MAX_GHOSTS);
  });

  it('produces nothing for a 1:1 chat, where there is no fan-out to show', () => {
    expect(fanOutGhosts(1, () => 0)).toEqual([]);
    expect(fanOutGhosts(0, () => 0)).toEqual([]);
    expect(fanOutGhosts(NaN, () => 0)).toEqual([]);
  });

  it('staggers the copies and keeps them travelling outward', () => {
    const ghosts = fanOutGhosts(8, () => 0.5);
    for (let i = 1; i < ghosts.length; i++) {
      expect(ghosts[i].delay).toBeGreaterThan(ghosts[i - 1].delay);
    }
    for (const g of ghosts) {
      expect(g.radius).toBeGreaterThan(0);
      expect(Number.isFinite(g.angle)).toBe(true);
    }
  });

  it('gives every copy a distinct id so they can be keyed', () => {
    const ghosts = fanOutGhosts(FANOUT_MAX_GHOSTS, () => 0);
    expect(new Set(ghosts.map(g => g.id)).size).toBe(ghosts.length);
  });
});

describe('reactionArcSlots', () => {
  it('lays every reaction at the same distance from the centre', () => {
    // The point of an arc over a row: no option is further from your thumb
    // than any other, so the ends stop being second-class choices.
    for (const slot of reactionArcSlots(6, 96)) {
      expect(Math.hypot(slot.x, slot.y)).toBeCloseTo(96, 6);
    }
  });

  it('spreads the options rather than stacking them', () => {
    const slots = reactionArcSlots(6, 96);
    expect(new Set(slots.map(s => `${s.x.toFixed(2)},${s.y.toFixed(2)}`)).size).toBe(6);
  });

  it('handles a single option and degenerate input', () => {
    expect(reactionArcSlots(1, 96)).toHaveLength(1);
    expect(reactionArcSlots(0, 96)).toEqual([]);
    expect(reactionArcSlots(6, 0)).toEqual([]);
    expect(reactionArcSlots(NaN, 96)).toEqual([]);
  });
});

describe('arcMagnetism / nearestArcSlot', () => {
  const slots = reactionArcSlots(6, 96);

  it('pulls hardest on the slot under the finger', () => {
    const target = slots[2];
    const pulls = arcMagnetism(slots, target.x, target.y);
    expect(nearestArcSlot(slots, target.x, target.y)).toBe(2);
    expect(pulls[2]).toBeCloseTo(1, 6);
  });

  // Neighbours yielding is what makes the selection legible; one item growing
  // alone reads as a hover state rather than the arc deforming toward you.
  it('falls off with distance instead of switching on and off', () => {
    const target = slots[2];
    const pulls = arcMagnetism(slots, target.x, target.y);
    expect(pulls[1]).toBeGreaterThan(0);
    expect(pulls[1]).toBeLessThan(pulls[2]);
  });

  it('selects nothing when the finger is nowhere near the arc', () => {
    const far = ARC_MAGNET_RADIUS * 10;
    expect(nearestArcSlot(slots, far, far)).toBe(-1);
    expect(arcMagnetism(slots, far, far).every(p => p === 0)).toBe(true);
  });

  it('treats unreadable coordinates as no pull at all', () => {
    expect(arcMagnetism(slots, NaN, 0).every(p => p === 0)).toBe(true);
    expect(nearestArcSlot(slots, NaN, 0)).toBe(-1);
  });
});

describe('disintegrateShards', () => {
  it('produces one shard per glyph', () => {
    expect(disintegrateShards(20, () => 0.5)).toHaveLength(20);
  });

  it('staggers so the sentence is consumed rather than vanishing at once', () => {
    const shards = disintegrateShards(10, () => 0.5);
    for (let i = 1; i < shards.length; i++) {
      expect(shards[i].delay).toBeGreaterThan(shards[i - 1].delay);
    }
  });

  it('always lifts, never falls', () => {
    // Drift is biased upward so it reads as something leaving, not dropping
    // off the bubble.
    for (const s of disintegrateShards(30, Math.random)) {
      expect(s.dy).toBeLessThan(0);
    }
  });

  it('caps the shard count so a long message cannot spawn hundreds of views', () => {
    expect(disintegrateShards(5000, () => 0.5)).toHaveLength(DISINTEGRATE_MAX_GLYPHS);
  });

  it('produces nothing for degenerate input', () => {
    expect(disintegrateShards(0, () => 0.5)).toEqual([]);
    expect(disintegrateShards(NaN, () => 0.5)).toEqual([]);
  });
});

describe('shouldBandDisintegrate', () => {
  it('switches to the banded fallback only past the glyph cap', () => {
    expect(shouldBandDisintegrate(DISINTEGRATE_MAX_GLYPHS)).toBe(false);
    expect(shouldBandDisintegrate(DISINTEGRATE_MAX_GLYPHS + 1)).toBe(true);
    expect(shouldBandDisintegrate(NaN)).toBe(false);
  });
});

describe('rubberbandRange', () => {
  const THRESHOLD = 74;
  const DIMENSION = 120;

  // Animated rejects an unsorted inputRange, and a mismatched pair silently
  // produces garbage rather than throwing — so both are worth asserting.
  it('produces a strictly ascending inputRange of matching length', () => {
    for (const dir of [-1, 1] as const) {
      const {inputRange, outputRange} = rubberbandRange(THRESHOLD, DIMENSION, dir);
      expect(inputRange).toHaveLength(outputRange.length);
      for (let i = 1; i < inputRange.length; i++) {
        expect(inputRange[i]).toBeGreaterThan(inputRange[i - 1]);
      }
    }
  });

  it('tracks the finger 1:1 up to the threshold', () => {
    const {inputRange, outputRange} = rubberbandRange(THRESHOLD, DIMENSION, -1);
    const at = inputRange.indexOf(-THRESHOLD);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(outputRange[at]).toBe(-THRESHOLD);
    expect(outputRange[inputRange.indexOf(0)]).toBe(0);
  });

  it('resists past the threshold, never travelling as far as the pull', () => {
    const {inputRange, outputRange} = rubberbandRange(THRESHOLD, DIMENSION, -1);
    for (let i = 0; i < inputRange.length; i++) {
      if (inputRange[i] < -THRESHOLD) {
        expect(Math.abs(outputRange[i])).toBeLessThan(Math.abs(inputRange[i]));
        expect(Math.abs(outputRange[i])).toBeGreaterThan(THRESHOLD);
      }
    }
  });

  it('is inert in the opposite direction', () => {
    const left = rubberbandRange(THRESHOLD, DIMENSION, -1);
    expect(left.outputRange[left.inputRange.length - 1]).toBe(0);
    const right = rubberbandRange(THRESHOLD, DIMENSION, 1);
    expect(right.outputRange[0]).toBe(0);
  });

  it('survives degenerate input instead of emitting an unusable table', () => {
    for (const range of [
      rubberbandRange(0, DIMENSION, -1),
      rubberbandRange(THRESHOLD, 0, -1),
      rubberbandRange(THRESHOLD, DIMENSION, -1, 0),
      rubberbandRange(NaN, NaN, -1),
    ]) {
      expect(range.inputRange).toHaveLength(range.outputRange.length);
      for (let i = 1; i < range.inputRange.length; i++) {
        expect(range.inputRange[i]).toBeGreaterThan(range.inputRange[i - 1]);
      }
    }
  });
});

describe('shouldCommit', () => {
  const THRESHOLD = 74;

  it('commits a drag taken past the threshold and released', () => {
    expect(shouldCommit(-90, 0, THRESHOLD)).toBe(true);
  });

  it('refuses a slow drag released short of the threshold', () => {
    expect(shouldCommit(-40, 0, THRESHOLD)).toBe(false);
  });

  it('commits a short flick that was clearly heading past it', () => {
    // 40pt in, but moving fast enough to coast well beyond the threshold.
    expect(shouldCommit(-40, -600, THRESHOLD)).toBe(true);
  });

  it('refuses a gesture flicked back, even from beyond the threshold', () => {
    // The whole reason this checks direction: distance alone would commit here.
    expect(shouldCommit(-90, 2000, THRESHOLD)).toBe(false);
  });

  it('honours the opposite direction', () => {
    expect(shouldCommit(90, 0, THRESHOLD, 1)).toBe(true);
    expect(shouldCommit(-90, 0, THRESHOLD, 1)).toBe(false);
  });

  it('refuses when the gesture itself is unmeasurable', () => {
    expect(shouldCommit(NaN, 0, THRESHOLD)).toBe(false);
    expect(shouldCommit(-90, 0, 0)).toBe(false);
  });

  // An unreadable velocity should cost us the flick shortcut, not the whole
  // gesture: falling back to "where did your finger actually stop" is the
  // behaviour someone dragging deliberately would expect anyway.
  it('falls back to position alone when velocity is unreadable', () => {
    expect(shouldCommit(-90, NaN, THRESHOLD)).toBe(true);
    expect(shouldCommit(-40, NaN, THRESHOLD)).toBe(false);
  });
});

describe('normalizedVelocity', () => {
  it('expresses velocity as a fraction of the distance still to travel', () => {
    // Half the remaining distance per second => 0.5 progress-units/second.
    expect(normalizedVelocity(50, 0, 100)).toBeCloseTo(0.5, 10);
    expect(normalizedVelocity(200, 0, 100)).toBeCloseTo(2, 10);
  });

  it('accounts for where the value already is, not just the target', () => {
    // Same raw velocity, but only 25 points left to cover, so it is four times
    // as fast in progress terms.
    expect(normalizedVelocity(50, 75, 100)).toBeCloseTo(2, 10);
  });

  it('is negative when the gesture moves away from the target', () => {
    expect(normalizedVelocity(-50, 0, 100)).toBeCloseTo(-0.5, 10);
  });

  it('yields no rate when there is nowhere left to travel', () => {
    // Guards the division: a spring already at its target has no meaningful
    // rate, and Infinity here would be handed straight to Animated.spring.
    expect(normalizedVelocity(50, 100, 100)).toBe(0);
    expect(normalizedVelocity(NaN, 0, 100)).toBe(0);
  });
});
