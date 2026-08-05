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

/**
 * The house spring: slightly under-damped so it lands a touch past its target
 * and settles back. Matches the web's cubic-bezier(0.34, 1.56, 0.64, 1) —
 * that curve overshoots ~4%, and tension/friction here are tuned to the same
 * feel rather than to round numbers.
 */
export const SPRING = {tension: 180, friction: 12, useNativeDriver: true} as const;

/** For things that should arrive without bounce (fades, backdrops). */
export const TIMING = {duration: 260, useNativeDriver: true} as const;

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
