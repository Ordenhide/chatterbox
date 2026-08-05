import {describe, expect, it} from 'vitest';
import {daysApart, formatDayLabel, isSameDay} from './messageDay';

const t = (k: 'chat.today' | 'chat.yesterday') => (k === 'chat.today' ? 'Today' : 'Yesterday');
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).getTime();

describe('isSameDay', () => {
  it('matches instants on the same local calendar day', () => {
    expect(isSameDay(at(2026, 5, 10, 0, 1), at(2026, 5, 10, 23, 59))).toBe(true);
  });

  it('separates one minute either side of midnight', () => {
    expect(isSameDay(at(2026, 5, 10, 23, 59), at(2026, 5, 11, 0, 1))).toBe(false);
  });

  it('does not confuse the same day-of-month in different months or years', () => {
    expect(isSameDay(at(2026, 4, 10), at(2026, 5, 10))).toBe(false);
    expect(isSameDay(at(2025, 5, 10), at(2026, 5, 10))).toBe(false);
  });

  it('returns false for non-finite input rather than throwing', () => {
    expect(isSameDay(NaN, Date.now())).toBe(false);
  });
});

describe('daysApart', () => {
  it('counts calendar days, not elapsed 24h periods', () => {
    // 23:59 to 00:01 is two minutes but a whole day boundary.
    expect(daysApart(at(2026, 5, 10, 23, 59), at(2026, 5, 11, 0, 1))).toBe(1);
  });

  it('is zero within one day', () => {
    expect(daysApart(at(2026, 5, 10, 1), at(2026, 5, 10, 23))).toBe(0);
  });
});

describe('formatDayLabel', () => {
  const now = at(2026, 5, 10);

  it('says Today and Yesterday for the days people name', () => {
    expect(formatDayLabel(at(2026, 5, 10, 9), t, now)).toBe('Today');
    expect(formatDayLabel(at(2026, 5, 9, 9), t, now)).toBe('Yesterday');
  });

  it('labels a message just past midnight as Today, not by elapsed hours', () => {
    expect(formatDayLabel(at(2026, 5, 10, 0, 5), t, at(2026, 5, 10, 23, 55))).toBe('Today');
  });

  it('names the weekday within the past week', () => {
    const label = formatDayLabel(at(2026, 5, 7), t, now);
    expect(label).not.toBe('Today');
    expect(label).not.toBe('Yesterday');
    expect(label.length).toBeGreaterThan(0);
  });

  it('includes the year only once a message is more than a year old', () => {
    expect(formatDayLabel(at(2024, 0, 15), t, now)).toMatch(/2024/);
    expect(formatDayLabel(at(2026, 2, 15), t, now)).not.toMatch(/\d{4}/);
  });

  it('returns an empty label for a missing timestamp instead of "Invalid Date"', () => {
    expect(formatDayLabel(NaN, t, now)).toBe('');
  });
});
