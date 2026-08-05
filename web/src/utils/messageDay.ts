/**
 * Day grouping for the message thread.
 *
 * A long conversation with no date markers forces you to read timestamps to
 * work out whether "09:12" was this morning or last week. These two helpers
 * decide where a separator goes and what it says.
 *
 * Both compare in the viewer's local timezone deliberately: the label must
 * match the clock on the reader's wall, not UTC.
 */

/** True when two epoch-ms instants land on the same local calendar day. */
export function isSameDay(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const d1 = new Date(a);
  const d2 = new Date(b);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** Whole local days between two instants — negative when `then` is in the future. */
export function daysApart(then: number, now: number): number {
  const startOf = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  return Math.round((startOf(now) - startOf(then)) / 86_400_000);
}

/**
 * "Today" / "Yesterday" for the two days people actually reason about, and a
 * real date beyond that. Older than a year gets the year too, so an archived
 * thread doesn't imply it happened this January.
 */
export function formatDayLabel(
  ms: number,
  t: (key: 'chat.today' | 'chat.yesterday') => string,
  now: number = Date.now(),
): string {
  if (!Number.isFinite(ms)) return '';
  const delta = daysApart(ms, now);
  if (delta === 0) return t('chat.today');
  if (delta === 1) return t('chat.yesterday');
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    weekday: delta < 7 && delta > 0 ? 'long' : undefined,
    month: 'short',
    day: 'numeric',
    year: delta >= 365 ? 'numeric' : undefined,
  });
}
