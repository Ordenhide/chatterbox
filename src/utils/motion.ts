/**
 * Shared motion vocabulary for the mobile app.
 *
 * Mirrors the motion section of web/src/styles.css — same personality, same
 * two rules:
 *   1. Only `transform` and `opacity` are animated, always with
 *      `useNativeDriver: true`, so nothing crosses the JS bridge per frame.
 *      That is this platform's equivalent of the web's compositor-only rule.
 *   2. Every effect collapses to an instant state change when the system's
 *      "Reduce Motion" switch is on (see useReduceMotion).
 *
 * Deliberately built on React Native's own Animated API rather than adding
 * Reanimated: nothing here needs gesture-driven or worklet-level animation,
 * and a new native dependency would have to be justified by more than a
 * spring curve.
 *
 * The pure helpers live here (rather than inside the components) so the parts
 * with real logic — particle spread, stagger capping — are unit-testable
 * without rendering anything.
 */
import {useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';
import type {ParticleStyle} from '../services/themeCatalog';
import type {ChatPet} from '../types';

/**
 * The house spring: slightly under-damped so it lands a touch past its target
 * and settles back. Matches the web's cubic-bezier(0.34, 1.56, 0.64, 1) —
 * that curve overshoots ~4%, and tension/friction here are tuned to the same
 * feel rather than to round numbers.
 */
export const SPRING = {tension: 180, friction: 12, useNativeDriver: true} as const;

/** For things that should arrive without bounce (fades, backdrops). */
export const TIMING = {duration: 260, useNativeDriver: true} as const;

/**
 * Press feedback: stiffer and less bouncy than SPRING. A button that overshoots
 * under your finger reads as loose rather than responsive, so this one lands
 * without the wobble the house spring is tuned for.
 */
export const PRESS_SPRING = {tension: 420, friction: 22, useNativeDriver: true} as const;

/** How far a pressable compresses. Deliberately small — felt, not watched. */
export const PRESS_SCALE = 0.96;

/* ------------------------------------------------------------------------ *
 * Gesture physics
 *
 * The three functions below are what separate motion that *plays at* you from
 * motion that *answers* you. None of them animate anything themselves — they
 * are the arithmetic a gesture handler needs in order to hand off to a spring
 * without a visible seam. Pure and dependency-free on purpose, so they are
 * unit-testable without rendering or faking a gesture.
 * ------------------------------------------------------------------------ */

/**
 * Apple's rubber-band constant. Lower resists harder; 0.55 is the value UIKit
 * uses for scroll-view overscroll, and matching it is the point — the whole
 * reason to rubber-band is that the resistance feels like the resistance
 * everywhere else on the device.
 */
export const RUBBERBAND_CONSTANT = 0.55;

/**
 * Resistance past a limit: how far the content *actually* moves when the
 * finger has moved `overshoot` beyond what is allowed.
 *
 * Asymptotic to ±`dimension`, so no matter how hard someone pulls, travel is
 * bounded — that ceiling is what makes the edge feel like a physical stop
 * rather than a number that ran out. Sign is preserved, so it works in both
 * directions without the caller special-casing.
 *
 * A non-positive `dimension` has no meaningful ceiling to approach, so it
 * yields no travel at all rather than dividing by zero.
 */
export function rubberband(
  overshoot: number,
  dimension: number,
  constant: number = RUBBERBAND_CONSTANT,
): number {
  if (!Number.isFinite(overshoot) || !Number.isFinite(dimension) || dimension <= 0) return 0;
  if (!Number.isFinite(constant) || constant <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * UIScrollView's deceleration rates. `NORMAL` is the system default; `FAST`
 * stops noticeably sooner and suits short throws like a dismiss, where
 * coasting a long way reads as sloppy rather than smooth.
 */
export const DECELERATION_NORMAL = 0.998;
export const DECELERATION_FAST = 0.99;

/**
 * Where a flick would come to rest if you let it coast — Apple's momentum
 * projection, taken from their own sample code.
 *
 * This is what lets a gesture commit on *intent* rather than on distance: a
 * short, fast flick projects past the threshold and commits, while a long,
 * slow drag that ends short of it does not. Deciding on final position alone
 * ignores everything the speed of the gesture told you.
 *
 * `velocity` is in points/second; the result is a displacement in points.
 * A deceleration rate outside (0, 1) has no finite resting point, so it
 * projects nowhere rather than returning Infinity.
 */
export function project(velocity: number, decelerationRate: number = DECELERATION_NORMAL): number {
  if (!Number.isFinite(velocity)) return 0;
  if (!Number.isFinite(decelerationRate) || decelerationRate <= 0 || decelerationRate >= 1) return 0;
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate));
}

/**
 * Converts a gesture velocity in points/second into the units
 * `Animated.spring`'s `velocity` option expects when the value being animated
 * is a normalised 0→1 progress rather than a distance in points.
 *
 * Needed because most of this app's animations drive a single 0→1 driver and
 * derive every visual property from it (see MessageEntrance) — handing such a
 * spring a raw px/s velocity would launch it hundreds of times too fast. When
 * the animated value *is* in points, pass the raw velocity instead; no
 * conversion applies.
 *
 * A zero-length remaining distance means the spring has nowhere to travel, so
 * there is no meaningful rate to express and this yields 0.
 */
export function normalizedVelocity(velocity: number, current: number, target: number): number {
  const distance = target - current;
  if (!Number.isFinite(velocity) || !Number.isFinite(distance) || distance === 0) return 0;
  return velocity / distance;
}

/** Which way a one-directional gesture is allowed to travel. */
export type PullDirection = -1 | 1;

/**
 * Far enough out that Animated's `extrapolate: 'clamp'` holds the inert side
 * flat for any pull a finger can produce.
 */
const INERT_TAIL = 10000;

/**
 * An `Animated.interpolate` table that applies `rubberband` to a pull.
 *
 * Exists because the resistance has to be computed *on the native side*. The
 * gesture drives an Animated.Value through the native driver, so the curve
 * cannot be a JS function without dragging every frame back across the bridge —
 * which is the one thing utils/motion.ts exists to avoid. Sampling the curve
 * into an interpolation table keeps the whole gesture native-driven.
 *
 * `samples` is the resolution of that approximation. Eight is plenty: the curve
 * is smooth and monotonic, and the error between samples is well under a point
 * over the range a thumb can reach.
 *
 * Travel is 1:1 up to `threshold`, resisted past it, and completely inert in
 * the opposite direction — a swipe-to-reply that follows your finger backwards
 * reads as broken rather than permissive.
 */
export function rubberbandRange(
  threshold: number,
  dimension: number,
  direction: PullDirection = -1,
  samples: number = 8,
): {inputRange: number[]; outputRange: number[]} {
  const safeThreshold = Number.isFinite(threshold) && threshold > 0 ? threshold : 1;
  const safeSamples = Number.isFinite(samples) && samples >= 1 ? Math.floor(samples) : 1;

  // Magnitudes first, ascending: [0, threshold, threshold+over…]
  const pulls: number[] = [0, safeThreshold];
  const travels: number[] = [0, safeThreshold];
  const maxOver = (Number.isFinite(dimension) && dimension > 0 ? dimension : 1) * 2.5;
  for (let i = 1; i <= safeSamples; i++) {
    const over = (maxOver * i) / safeSamples;
    pulls.push(safeThreshold + over);
    travels.push(safeThreshold + rubberband(over, dimension));
  }

  // `n === 0 ? 0 : -n` rather than plain negation: -0 is a real value here, it
  // compares unequal to 0 under Object.is, and it has no business in a table
  // that gets diffed and asserted against.
  const negate = (n: number) => (n === 0 ? 0 : -n);

  // Signed, and always ascending — Animated rejects an unsorted inputRange.
  if (direction < 0) {
    return {
      inputRange: [...pulls.map(negate).reverse(), INERT_TAIL],
      outputRange: [...travels.map(negate).reverse(), 0],
    };
  }
  return {
    inputRange: [-INERT_TAIL, ...pulls],
    outputRange: [0, ...travels],
  };
}

/**
 * Whether a released gesture should commit, judged on where it was *heading*
 * rather than where it stopped.
 *
 * This is what makes a short, fast flick work: it projects past the threshold
 * and commits, while a long slow drag released short of it does not. Deciding
 * on final position alone throws away everything the speed of the gesture said
 * about intent.
 *
 * A gesture already dragged past the threshold but flicked *back* on release is
 * correctly refused — the projected endpoint lands on the wrong side, which is
 * why this checks direction and not just distance.
 */
export function shouldCommit(
  translation: number,
  velocity: number,
  threshold: number,
  direction: PullDirection = -1,
): boolean {
  if (!Number.isFinite(translation) || !Number.isFinite(threshold) || threshold <= 0) return false;
  const projected = translation + project(velocity);
  if (!Number.isFinite(projected)) return false;
  return Math.sign(projected) === Math.sign(direction) && Math.abs(projected) >= threshold;
}

/** How far a bubble travels on its way in, in points. */
export const ENTRANCE_OFFSET = 14;
export const ENTRANCE_SCALE = 0.88;

/**
 * Stagger for list entrances, capped so a long list never leaves its last row
 * waiting. Same 28ms step and 10-row cap as the web chat list.
 */
export const STAGGER_STEP_MS = 28;
export const STAGGER_MAX_STEPS = 10;

export function staggerDelay(index: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.floor(index), STAGGER_MAX_STEPS) * STAGGER_STEP_MS;
}

/**
 * Scroll-linked reveal: how far a card travels and how much it scales on its
 * way in. Distinct from ENTRANCE_* above, which fires once on mount — these
 * drive a value derived from scroll *position*, so the card is mid-reveal for
 * exactly as long as you hold it mid-screen, and reverses if you scroll back.
 *
 * Kept short on purpose. A card that travels far enough to notice is a card
 * that is still moving when you try to tap it.
 */
export const REVEAL_TRAVEL = 24;
export const REVEAL_SCALE = 0.96;

/**
 * Where in the viewport a card finishes revealing, as a fraction of viewport
 * height measured from the top. At 0.72 a card is fully settled a little below
 * centre — reached early enough that it is never still animating by the time
 * it is comfortably readable.
 */
export const REVEAL_ENTER_RATIO = 0.72;

/**
 * The scroll-offset range over which a card at `itemY` reveals: fully hidden
 * when its top edge sits at the bottom of the viewport, fully shown once that
 * edge has risen to REVEAL_ENTER_RATIO.
 *
 * Returned as a tuple for Animated.interpolate's inputRange. Cards in the
 * first screenful produce an all-negative range, so at scrollY 0 they clamp to
 * "revealed" and never animate — content already on screen when you arrive
 * should simply be there, not perform.
 *
 * A viewport height of 0 (measured before layout) would collapse the range to
 * a single point, which Animated rejects; the guard hands back a unit range in
 * that case, and the real one arrives with the next layout pass.
 */
export function revealWindow(itemY: number, windowHeight: number): [number, number] {
  if (!Number.isFinite(itemY) || !Number.isFinite(windowHeight) || windowHeight <= 0) {
    return [0, 1];
  }
  return [itemY - windowHeight, itemY - windowHeight * REVEAL_ENTER_RATIO];
}

export interface Size {
  width: number;
  height: number;
}

export interface PetMotionProfile {
  /** How far the pet bobs on each idle cycle, in points. */
  bobAmplitude: number;
  /** Duration of one half of the bob cycle (rise or fall), in ms. */
  bobDuration: number;
  /** Idle sway, in degrees, applied in the same direction as the bob. */
  rotateDeg: number;
  /** How much the pet "breathes" — added to 1 for the idle scale peak. */
  scalePulse: number;
  /** Resting opacity. Dimmed for sleep, full otherwise. */
  restOpacity: number;
}

/**
 * How a chat pet idles, by mood — the one thing standing between "a static
 * icon with a label" and something that reads as alive.
 *
 * All four numbers are driven off a single looping 0→1 Animated.Value (see
 * PetAvatar), so a happier pet isn't just "the same animation, faster" — it
 * bobs higher, sways more and breathes more visibly, while a sad or sleeping
 * one settles toward stillness rather than switching to a different motion.
 * That continuity is what keeps mood changes from reading as the pet being
 * swapped out.
 */
export function petMotionProfile(mood: ChatPet['mood']): PetMotionProfile {
  switch (mood) {
    case 'happy':
      return {bobAmplitude: 6, bobDuration: 650, rotateDeg: 5, scalePulse: 0.06, restOpacity: 1};
    case 'neutral':
      return {bobAmplitude: 4, bobDuration: 950, rotateDeg: 3, scalePulse: 0.035, restOpacity: 1};
    case 'sad':
      return {bobAmplitude: 2, bobDuration: 1400, rotateDeg: 1, scalePulse: 0.015, restOpacity: 0.85};
    case 'sleeping':
      return {bobAmplitude: 1, bobDuration: 2000, rotateDeg: 0, scalePulse: 0.02, restOpacity: 0.62};
  }
}

/**
 * The largest box with `natural`'s aspect ratio that fits inside `bounds` —
 * what `resizeMode="contain"` computes internally, but as a value rather than
 * a rendering behaviour.
 *
 * ExpandingImage needs the number, not the behaviour: it animates a thumbnail
 * to its full-screen size using transforms, so it has to know the destination
 * rect before anything renders there.
 *
 * Degenerate input (an image whose size failed to load) falls back to the full
 * bounds, which is the same box "contain" would settle on for a square-ish
 * image — a slightly wrong aspect for one frame beats no transition.
 */
export function fitContain(natural: Size, bounds: Size): Size {
  const {width: nw, height: nh} = natural;
  const {width: bw, height: bh} = bounds;
  if (!(nw > 0) || !(nh > 0) || !(bw > 0) || !(bh > 0)) return {width: bw, height: bh};
  const scale = Math.min(bw / nw, bh / nh);
  return {width: nw * scale, height: nh * scale};
}

/**
 * Parallax rates, as a fraction of scroll distance. The backdrop grid tracks
 * scroll closely enough to feel attached; the accent glows lag further behind,
 * and that difference between the two layers is the whole illusion of depth.
 *
 * Both are well under 1 — a layer moving at scroll speed is not parallax, it
 * is just scrolling.
 */
export const PARALLAX_BACKDROP = 0.3;
export const PARALLAX_GLOW = 0.15;

/* ------------------------------------------------------------------------ *
 * Seal & Resolve
 *
 * The app's signature effect. Chatterbox seals every message to a recipient
 * key before it leaves the device (see services/e2ee.ts) and, in groups, one
 * copy per member — and until now all of that showed up as a padlock glyph,
 * the same padlock every messenger has.
 *
 * So text scrambles as it seals and resolves as it opens. It is honest: the
 * animation marks the moment the message actually becomes ciphertext, not a
 * decoration chosen to look technical.
 * ------------------------------------------------------------------------ */

/** The cipher alphabet. Fixed-ish width and visually noisy, so a scrambling
 * line keeps roughly the shape of the sentence underneath it. */
export const CIPHER_GLYPHS = 'ABCDEF0123456789/+=%$#@&*<>{}[]^~';

export const SCRAMBLE_MIN_MS = 360;
export const SCRAMBLE_MAX_MS = 1200;
export const SCRAMBLE_MS_PER_CHAR = 18;

/**
 * How many characters shimmer at the resolving edge at once.
 *
 * This is the cost cap. Without it a long message re-randomises every glyph on
 * every frame; with it the work per frame is bounded no matter how long the
 * message is, and the effect reads better anyway — a wave of legibility
 * travelling through the text rather than the whole block twitching.
 */
export const SCRAMBLE_WINDOW = 48;

/**
 * How long a message takes to resolve: proportional to length, but clamped.
 *
 * A two-word reply that took as long as a paragraph would feel broken, and a
 * paragraph that scaled linearly would still be resolving after you had read
 * it. Nothing here is ever slower than SCRAMBLE_MAX_MS.
 */
export function scrambleDuration(length: number): number {
  if (!Number.isFinite(length) || length <= 0) return SCRAMBLE_MIN_MS;
  return Math.min(SCRAMBLE_MAX_MS, SCRAMBLE_MIN_MS + length * SCRAMBLE_MS_PER_CHAR);
}

/**
 * One frame of the scramble: `text` with the first `progress` share of it
 * resolved and the rest still ciphertext.
 *
 * Whitespace is never scrambled. Keeping spaces and newlines in place holds the
 * line breaks still, so the bubble does not reflow — and word shape is most of
 * what makes the resolve read as *this* sentence arriving rather than as a
 * block of noise being replaced.
 *
 * `random` is injectable for the same reason makeBurst's is: the spread is the
 * behaviour worth testing, and sampling it and hoping is not a test.
 */
export function scrambleFrame(
  text: string,
  progress: number,
  random: () => number = Math.random,
): string {
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
      // stays put instead of flickering — cheap, and it reads as sealed rather
      // than as noise.
      out += CIPHER_GLYPHS[i % CIPHER_GLYPHS.length];
    }
  }
  return out;
}

/* ------------------------------------------------------------------------ *
 * Cipher texture
 *
 * The ambient layer behind a conversation: the sealed form of the thread,
 * sitting under the messages that have been opened out of it. Same alphabet
 * as scrambleFrame, so the texture and the resolve animation are visibly the
 * same material rather than two effects that happen to share a look.
 *
 * Deliberately *static*. scrambleFrame churns because it is mid-transition
 * and about to stop; a background that never stopped churning would be
 * unreadable to sit next to all day, and would burn a frame budget behind a
 * scrolling list forever.
 *
 * Seeded rather than Math.random so a given chat's texture is stable — it does
 * not reshuffle on every re-render, and returning to a conversation shows the
 * same sealed field you left. Two different chats get different fields, which
 * is the honest reading: different conversation, different ciphertext.
 * ------------------------------------------------------------------------ */

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 *
 * Needed because the texture must be reproducible from a chat id, and
 * Math.random cannot be seeded. Quality only has to be good enough that the
 * glyphs do not visibly band or repeat; this clears that easily and is five
 * lines, which beats taking a dependency for it.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a chat id, for seeding the texture above. */
export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A block of `length` cipher glyphs, stable for a given `seed`.
 *
 * Whitespace is inserted at irregular intervals rather than never: an
 * unbroken wall of glyphs reads as a texture fill, while broken runs read as
 * sealed *content* — which is what this is standing in for.
 */
export function cipherTexture(length: number, seed: number): string {
  if (!Number.isFinite(length) || length <= 0) return '';
  const random = seededRandom(seed);
  let out = '';
  let sinceBreak = 0;
  for (let i = 0; i < length; i++) {
    // Runs of 3–11 glyphs, so the field never settles into a visible column.
    if (sinceBreak > 2 && random() < 0.14) {
      out += ' ';
      sinceBreak = 0;
      continue;
    }
    out += CIPHER_GLYPHS[Math.floor(random() * CIPHER_GLYPHS.length) % CIPHER_GLYPHS.length];
    sinceBreak++;
  }
  return out;
}

/* ------------------------------------------------------------------------ *
 * Cold open
 *
 * The launch sequence, and the one place the app gets to introduce itself.
 * Same honesty rule as CipherText above: the wordmark resolves out of
 * ciphertext because that is what this app does to messages, not because
 * scrambling text looks technical. It plays over the auth-state check that
 * genuinely is happening at that moment (App.tsx renders nothing while
 * `loading`), so it occupies real waiting time rather than inventing some.
 *
 * Three phases rather than one long tween, because they are doing different
 * jobs: `seal` establishes the wordmark as ciphertext, `resolve` is the
 * reveal, and `settle` is the beat that keeps the reveal from being cut off
 * by the app arriving on top of it.
 * ------------------------------------------------------------------------ */

export const COLD_OPEN_SEAL_MS = 620;
export const COLD_OPEN_RESOLVE_MS = 900;
export const COLD_OPEN_SETTLE_MS = 420;
export const COLD_OPEN_TOTAL_MS =
  COLD_OPEN_SEAL_MS + COLD_OPEN_RESOLVE_MS + COLD_OPEN_SETTLE_MS;

export type ColdOpenPhase = 'seal' | 'resolve' | 'settle' | 'done';

export interface ColdOpenFrame {
  phase: ColdOpenPhase;
  /** 0→1 *within the current phase*, not across the whole sequence. */
  progress: number;
}

/**
 * Which phase the cold open is in at `elapsed` ms, and how far through it.
 *
 * Per-phase progress rather than one global 0→1 so each phase can use its own
 * curve without every consumer re-deriving the same boundaries — and so the
 * durations above can be retuned without touching the component.
 *
 * Negative or non-finite input reads as the very start rather than throwing:
 * this is driven by a clock, and a bad clock reading should cost a frame, not
 * the launch screen.
 */
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
 * Distinct from staggerDelay above, which paces list rows at 28ms — a rate
 * tuned to stay out of the way while you scroll. A cascade is the opposite
 * situation: a handful of elements on a screen you have just arrived at, with
 * nothing competing for attention, so the step is long enough to read as a
 * sequence rather than as one block easing in slightly unevenly.
 * ------------------------------------------------------------------------ */

export const CASCADE_STEP_MS = 85;

/**
 * Capped for the same reason staggerDelay is, but much lower: past half a
 * dozen elements a cascade stops reading as choreography and starts reading
 * as the screen being slow.
 */
export const CASCADE_MAX_STEPS = 6;

export function cascadeDelay(index: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.floor(index), CASCADE_MAX_STEPS) * CASCADE_STEP_MS;
}

/** How far a cascading element travels on its way in, in points. */
export const CASCADE_TRAVEL = 22;
export const CASCADE_SCALE = 0.94;

/* ------------------------------------------------------------------------ *
 * Fan-out bloom
 * ------------------------------------------------------------------------ */

export interface FanGhost {
  id: string;
  /** Direction of travel, in radians. */
  angle: number;
  /** How far it travels before folding back, in points. */
  radius: number;
  /** How long before this copy starts, in ms. */
  delay: number;
}

/**
 * Drawn ghosts are capped well below MAX_GROUP_MEMBERS (32). Past about a
 * dozen the bloom reads as "a crowd" regardless of the exact number, and every
 * extra one is a view being created and torn down for no added meaning.
 */
export const FANOUT_MAX_GHOSTS = 12;
export const FANOUT_STAGGER_MS = 22;

/** Sweep, in radians. Wide enough to read as distribution, short of a full
 * circle so it stays directional rather than looking like an explosion. */
const FANOUT_SWEEP = (200 * Math.PI) / 180;
const FANOUT_START = (-190 * Math.PI) / 180;

/**
 * One copy per recipient, fanned across an arc — the visible form of
 * sealForRecipients, which produces exactly this many sealed envelopes.
 *
 * A 1:1 chat produces no ghosts at all: with a single recipient there is no
 * fan-out to show, and a lone copy drifting off a bubble would suggest
 * something was sent somewhere unexpected.
 */
export function fanOutGhosts(memberCount: number, random: () => number = Math.random): FanGhost[] {
  if (!Number.isFinite(memberCount) || memberCount < 2) return [];
  const count = Math.min(Math.floor(memberCount), FANOUT_MAX_GHOSTS);
  const seed = Date.now();
  return Array.from({length: count}, (_, i) => ({
    id: `${seed}-${i}`,
    // count === 1 would divide by zero; a single ghost simply leaves mid-sweep.
    angle: FANOUT_START + (count === 1 ? FANOUT_SWEEP / 2 : (FANOUT_SWEEP / (count - 1)) * i),
    radius: 62 + Math.round(random() * 26),
    delay: i * FANOUT_STAGGER_MS,
  }));
}

/* ------------------------------------------------------------------------ *
 * Magnetic reaction arc
 * ------------------------------------------------------------------------ */

export interface ArcSlot {
  /** Offset from the arc's centre, in points. */
  x: number;
  y: number;
}

/** How close a finger has to be before a reaction starts growing toward it. */
export const ARC_MAGNET_RADIUS = 110;
/** How much the nearest reaction grows. */
export const ARC_MAGNET_SCALE = 0.62;

/**
 * Lays reactions out along an arc rather than a row.
 *
 * An arc puts every option roughly the same distance from where your thumb
 * already is, which a row does not — in a row the far end is a stretch, and
 * the emoji at the ends get picked less as a result.
 */
export function reactionArcSlots(count: number, radius: number): ArcSlot[] {
  if (!Number.isFinite(count) || count < 1) return [];
  if (!Number.isFinite(radius) || radius <= 0) return [];
  const span = (150 * Math.PI) / 180;
  const start = (-165 * Math.PI) / 180;
  return Array.from({length: Math.floor(count)}, (_, i) => {
    const angle = start + (count === 1 ? span / 2 : (span / (count - 1)) * i);
    return {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius};
  });
}

/**
 * How strongly each slot is attracted to the finger, 0–1.
 *
 * Returned for every slot rather than just the winner because the neighbours
 * yielding is what makes the selection legible: one item growing in isolation
 * reads as a hover state, whereas the whole arc deforming around your thumb
 * reads as the thing being pulled toward you.
 */
export function arcMagnetism(slots: ArcSlot[], x: number, y: number): number[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return slots.map(() => 0);
  return slots.map(slot => {
    const distance = Math.hypot(slot.x - x, slot.y - y);
    return Math.max(0, 1 - distance / ARC_MAGNET_RADIUS);
  });
}

/** Index of the slot nearest the finger, or -1 when nothing is close enough. */
export function nearestArcSlot(slots: ArcSlot[], x: number, y: number): number {
  const pulls = arcMagnetism(slots, x, y);
  let best = -1;
  let bestPull = 0;
  for (let i = 0; i < pulls.length; i++) {
    if (pulls[i] > bestPull) {
      bestPull = pulls[i];
      best = i;
    }
  }
  return best;
}

/* ------------------------------------------------------------------------ *
 * Burn dissolve
 * ------------------------------------------------------------------------ */

export interface Shard {
  /** Horizontal drift, in points. Signed. */
  dx: number;
  /** Vertical drift, in points. Negative — shards lift as they go. */
  dy: number;
  /** Final rotation, in degrees. */
  rotate: number;
  /** Stagger before this glyph starts, in ms. */
  delay: number;
}

export const DISINTEGRATE_MS = 620;
export const DISINTEGRATE_STAGGER_MS = 11;

/**
 * Above this, per-glyph views stop being worth it and the effect degrades to a
 * three-band wipe (see shouldBandDisintegrate). Ninety views for one animation
 * is already generous; nine hundred would drop frames on the exact devices
 * least able to afford it.
 */
export const DISINTEGRATE_MAX_GLYPHS = 90;

/** Whether a message is too long for per-glyph shards. */
export function shouldBandDisintegrate(length: number): boolean {
  return Number.isFinite(length) && length > DISINTEGRATE_MAX_GLYPHS;
}

/**
 * Per-glyph drift for a message coming apart — burn-after-reading, at the
 * moment it expires.
 *
 * Staggered by index so the sentence is consumed from its leading edge rather
 * than vanishing all at once: destruction that happens instantly is
 * indistinguishable from a list item being removed, which is exactly what this
 * exists to stop being.
 *
 * The drift is biased upward and slightly forward so it reads as something
 * lifting away, not falling off the bubble.
 */
export function disintegrateShards(length: number, random: () => number = Math.random): Shard[] {
  if (!Number.isFinite(length) || length <= 0) return [];
  const count = Math.min(Math.floor(length), DISINTEGRATE_MAX_GLYPHS);
  return Array.from({length: count}, (_, i) => ({
    dx: Math.round((random() - 0.3) * 26),
    dy: -14 - Math.round(random() * 26),
    rotate: Math.round((random() - 0.5) * 50),
    delay: i * DISINTEGRATE_STAGGER_MS,
  }));
}

export interface BurstParticle {
  id: string;
  emoji: string;
  /** Horizontal drift in points; signed, so particles fan both ways. */
  drift: number;
  /** Final rotation in degrees. */
  spin: number;
  /** Lifetime in ms. */
  life: number;
}

/** Six reads as a burst; more just costs frames on a gesture used constantly. */
export const BURST_COUNT = 6;

/**
 * Builds one burst. `random` is injectable so tests can assert the spread
 * deterministically instead of sampling and hoping.
 */
export function makeBurst(emoji: string, random: () => number = Math.random): BurstParticle[] {
  const seed = Date.now();
  return Array.from({length: BURST_COUNT}, (_, i) => ({
    id: `${seed}-${i}`,
    emoji,
    drift: Math.round((random() - 0.5) * 120),
    spin: Math.round((random() - 0.5) * 90),
    life: 900 + Math.round(random() * 500),
  }));
}

export interface ThemeParticle {
  id: string;
  /** Horizontal position, percent of the container width (0-100). */
  left: number;
  /** How long to wait before this particle's first loop, in ms. */
  delay: number;
  /** One float-up-and-fade cycle, in ms. */
  duration: number;
  /** px — spark/dot render small, confetti a touch larger. */
  size: number;
}

/**
 * Builds a chat theme's ambient particle layer — the mobile twin of the
 * web's `.cb-particle` (see ChatPane.tsx/styles.css). Unlike makeBurst above
 * this is a steady loop, not a one-shot: each particle just needs a starting
 * position and timing, not a drift/spin/life triple tuned for a single pass.
 *
 * `random` is injectable for the same reason makeBurst's is — deterministic
 * tests instead of sampling and hoping.
 */
export function makeThemeParticles(
  density: number,
  style: ParticleStyle,
  random: () => number = Math.random,
): ThemeParticle[] {
  const size = style === 'confetti' ? 7 : style === 'spark' ? 4 : 6;
  return Array.from({length: density}, (_, i) => ({
    id: `${style}-${i}`,
    left: Math.round(random() * 100),
    delay: Math.round(random() * 4000),
    duration: 7000 + Math.round(random() * 5000),
    size,
  }));
}

/**
 * Tracks the system Reduce Motion setting, and keeps tracking it — someone can
 * turn it on while the app is open, and an animation that ignored that would
 * be exactly the one they turned it on to stop.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (active) setReduced(value);
      })
      // Failing to "motion allowed" matches the platform default; this is a
      // comfort preference, not a safety guard.
      .catch(() => undefined);

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', value =>
      setReduced(!!value),
    );
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
