import {runPool} from '../pool';

/** A promise plus the handle to settle it, so a test can hold jobs open. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return {promise, resolve};
}

describe('runPool', () => {
  it('hands every item to the worker exactly once', async () => {
    const seen: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, async n => {
      seen.push(n);
    });
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('passes each item its own index', async () => {
    const pairs: [string, number][] = [];
    await runPool(['a', 'b', 'c'], 2, async (item, i) => {
      pairs.push([item, i]);
    });
    expect(pairs.sort((x, y) => x[1] - y[1])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  // The point of the whole thing. Serial execution passes every other test
  // here, so without this one the fix is unasserted.
  it('actually runs jobs concurrently rather than one at a time', async () => {
    const started: number[] = [];
    const gate = deferred();

    const pool = runPool([0, 1, 2, 3, 4], 3, async n => {
      started.push(n);
      await gate.promise;
    });

    // Let the workers reach their first await.
    await Promise.resolve();
    await Promise.resolve();

    expect(started).toEqual([0, 1, 2]);
    gate.resolve();
    await pool;
    expect(started).toHaveLength(5);
  });

  it('never exceeds the limit', async () => {
    let live = 0;
    let peak = 0;
    await runPool(Array.from({length: 20}, (_, i) => i), 4, async () => {
      live++;
      peak = Math.max(peak, live);
      await new Promise(r => setTimeout(r, 0));
      live--;
    });
    expect(peak).toBe(4);
  });

  it('does not spawn more workers than there are items', async () => {
    let live = 0;
    let peak = 0;
    await runPool([1, 2], 10, async () => {
      live++;
      peak = Math.max(peak, live);
      await new Promise(r => setTimeout(r, 0));
      live--;
    });
    expect(peak).toBe(2);
  });

  it('waits for every job to settle before resolving', async () => {
    const done: number[] = [];
    await runPool([1, 2, 3, 4, 5, 6], 2, async n => {
      await new Promise(r => setTimeout(r, 0));
      done.push(n);
    });
    expect(done).toHaveLength(6);
  });

  // A closing chat screen must not keep downloading into caches nobody will
  // read. Checked before each item, so work already in flight still settles.
  it('stops taking new items when the caller says to stop', async () => {
    let taken = 0;
    let open = true;
    await runPool(
      Array.from({length: 50}, (_, i) => i),
      2,
      async () => {
        taken++;
        if (taken >= 4) open = false;
      },
      () => open,
    );
    expect(taken).toBeLessThan(10);
    expect(taken).toBeGreaterThanOrEqual(4);
  });

  it('does nothing for an empty list, and never calls the worker', async () => {
    const work = jest.fn();
    await runPool([], 4, work);
    expect(work).not.toHaveBeenCalled();
  });

  it('treats a nonsense limit as nothing to do rather than looping forever', async () => {
    const work = jest.fn();
    await runPool([1, 2, 3], 0, work);
    expect(work).not.toHaveBeenCalled();
  });
});
