/**
 * A phase timer for tracking down "why is this slow", dev builds only.
 *
 * Opening a chat is half a dozen overlapping stages — reading the local body
 * cache, the first Firestore snapshot, the synchronous decrypt pass, the
 * serial ratchet pass, then attachments — and a stopwatch on the whole thing
 * says only that it was slow. Each `mark` prints the time since the previous
 * mark and since the start, so the expensive stage names itself instead of
 * being guessed at.
 *
 * Inert in release: `start` returns a shared no-op tracer, so callers need no
 * `__DEV__` guard of their own and nothing is allocated per call.
 */
export type Trace = {
  /** Records a phase boundary. `detail` is for counts — "42 messages". */
  mark: (phase: string, detail?: string | number) => void;
};

const NOOP: Trace = {mark: () => undefined};

export function startTrace(label: string): Trace {
  if (!__DEV__) return NOOP;

  const t0 = Date.now();
  let last = t0;

  return {
    mark: (phase, detail) => {
      const now = Date.now();
      const since = now - last;
      last = now;
      const suffix = detail === undefined ? '' : ` (${detail})`;
      console.log(`[trace] ${label} · ${phase}${suffix}  +${since}ms  total ${now - t0}ms`);
    },
  };
}
