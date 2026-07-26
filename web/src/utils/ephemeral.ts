// Pure helpers for the ephemeral features (burn-after-reading, disappearing
// moments). Kept dependency-free so they're unit-testable in isolation.

/** Burn-after-reading durations in seconds (matches the mobile app). */
export const BURN_DURATIONS = [5, 10, 30, 60, 300];

/** Next duration in the cycle; wraps around. Unknown values start at the first. */
export function cycleBurnDuration(prev: number): number {
  const i = BURN_DURATIONS.indexOf(prev);
  return BURN_DURATIONS[(i + 1) % BURN_DURATIONS.length];
}

/** e.g. 5 -> "5s", 90 -> "2m". */
export function formatBurnDuration(s: number): string {
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
}

/** Disappearing-moment lifetimes in hours (0 = keep forever). */
export const MOMENT_EXPIRY_HOURS = [0, 1, 24, 168];

/** Compact remaining-time label from a millisecond delta, e.g. "45m", "3h", "2d". */
export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** True when `expiresAt` (epoch ms) is set and in the past. */
export function isExpired(expiresAt: number | null | undefined, now: number = Date.now()): boolean {
  return typeof expiresAt === 'number' && expiresAt <= now;
}
