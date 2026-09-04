/**
 * Runs `work` over `items` with at most `limit` in flight at once.
 *
 * For independent async jobs that were being awaited one at a time. The
 * distinction that matters is whether the jobs constrain each other: opening
 * a ratchet envelope advances stored session state and must stay serial,
 * while fetching and decrypting an attachment is keyed to one message slot
 * and shares nothing — so awaiting those in turn made every attachment wait
 * out every attachment ahead of it for no reason.
 *
 * Bounded rather than unbounded because these jobs are usually network reads
 * that stream to disk; letting fifty go at once trades a slow queue for a
 * thrashing one.
 *
 * `work` is never called with an index it has already been given: the cursor
 * advances synchronously before the first await, so the workers cannot race
 * for the same item on a single-threaded runtime.
 *
 * Resolves when every item has been handed to `work` and every call has
 * settled. It does not reject — a job that throws is reported to `work`'s own
 * error handling, because one failed attachment must not abandon the rest.
 */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<void>,
  /** Checked before each item, so a closing screen stops the queue. */
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  if (items.length === 0 || limit < 1) return;

  let next = 0;
  const worker = async (): Promise<void> => {
    while (shouldContinue()) {
      const index = next++;
      if (index >= items.length) return;
      await work(items[index], index);
    }
  };

  await Promise.all(
    Array.from({length: Math.min(limit, items.length)}, () => worker()),
  );
}
