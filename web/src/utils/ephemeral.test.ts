import {describe, expect, it} from 'vitest';
import {
  BURN_DURATIONS,
  cycleBurnDuration,
  formatBurnDuration,
  formatRemaining,
  isExpired,
  MOMENT_EXPIRY_HOURS,
} from './ephemeral';

describe('cycleBurnDuration', () => {
  it('advances through the durations and wraps around', () => {
    expect(cycleBurnDuration(5)).toBe(10);
    expect(cycleBurnDuration(10)).toBe(30);
    expect(cycleBurnDuration(BURN_DURATIONS[BURN_DURATIONS.length - 1])).toBe(BURN_DURATIONS[0]);
  });
  it('starts from the first duration for an unknown value', () => {
    expect(cycleBurnDuration(999)).toBe(BURN_DURATIONS[0]);
  });
});

describe('formatBurnDuration', () => {
  it('formats seconds and minutes', () => {
    expect(formatBurnDuration(5)).toBe('5s');
    expect(formatBurnDuration(30)).toBe('30s');
    expect(formatBurnDuration(60)).toBe('1m');
    expect(formatBurnDuration(300)).toBe('5m');
  });
});

describe('formatRemaining', () => {
  it('picks the right unit and floors', () => {
    expect(formatRemaining(90 * 1000)).toBe('1m');
    expect(formatRemaining(45 * 60 * 1000)).toBe('45m');
    expect(formatRemaining(3 * 3600 * 1000)).toBe('3h');
    expect(formatRemaining(2 * 86400 * 1000)).toBe('2d');
  });
  it('never shows a negative or zero minute', () => {
    expect(formatRemaining(-1000)).toBe('1m');
    expect(formatRemaining(0)).toBe('1m');
  });
});

describe('isExpired', () => {
  const now = 1_000_000;
  it('is true only for a past, non-null deadline', () => {
    expect(isExpired(now - 1, now)).toBe(true);
    expect(isExpired(now + 1, now)).toBe(false);
    expect(isExpired(null, now)).toBe(false);
    expect(isExpired(undefined, now)).toBe(false);
  });
});

describe('MOMENT_EXPIRY_HOURS', () => {
  it('offers keep + 1h/24h/7d', () => {
    expect(MOMENT_EXPIRY_HOURS).toEqual([0, 1, 24, 168]);
  });
});
