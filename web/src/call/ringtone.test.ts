import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRingtone} from './ringtone';

/** Minimal Web Audio stand-in — jsdom implements none of it. */
function fakeAudioContext(opts: {resumesTo: AudioContextState}) {
  const oscillators: {frequency: {value: number}; started: boolean}[] = [];
  const ctx = {
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    closed: false,
    resume: vi.fn(async () => {
      ctx.state = opts.resumesTo;
    }),
    close: vi.fn(async () => {
      ctx.closed = true;
      ctx.state = 'closed';
    }),
    destination: {},
    createGain: () => ({
      connect: vi.fn(),
      gain: {setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn()},
    }),
    createOscillator: () => {
      const osc = {
        type: '',
        frequency: {value: 0},
        started: false,
        connect: vi.fn(),
        start: vi.fn(() => (osc.started = true)),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    },
  };
  return {ctx, oscillators};
}

function install(ctx: unknown) {
  (window as unknown as {AudioContext: unknown}).AudioContext = vi.fn(() => ctx);
}

afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as {AudioContext?: unknown}).AudioContext;
  delete (window as unknown as {webkitAudioContext?: unknown}).webkitAudioContext;
});

describe('createRingtone', () => {
  it('reports failure instead of throwing when Web Audio is unavailable', async () => {
    delete (window as unknown as {AudioContext?: unknown}).AudioContext;
    expect(await createRingtone().start()).toBe(false);
  });

  it('reports failure when autoplay policy keeps the context suspended', async () => {
    // The blocked case: resume() is allowed to no-op when the page has never
    // seen a user gesture. Callers rely on `false` to show a visual alert.
    const {ctx} = fakeAudioContext({resumesTo: 'suspended'});
    install(ctx);
    expect(await createRingtone().start()).toBe(false);
    expect(ctx.close).toHaveBeenCalled(); // no orphaned audio context
  });

  it('rings with the dual-tone telephone frequencies once running', async () => {
    const {ctx, oscillators} = fakeAudioContext({resumesTo: 'running'});
    install(ctx);
    const ring = createRingtone();

    expect(await ring.start()).toBe(true);
    expect(oscillators.map(o => o.frequency.value).sort()).toEqual([440, 480]);
    expect(oscillators.every(o => o.started)).toBe(true);
    ring.stop();
  });

  it('repeats on a cycle until stopped', async () => {
    vi.useFakeTimers();
    const {ctx, oscillators} = fakeAudioContext({resumesTo: 'running'});
    install(ctx);
    const ring = createRingtone();
    await ring.start();

    expect(oscillators).toHaveLength(2); // first burst
    vi.advanceTimersByTime(4000);
    expect(oscillators).toHaveLength(4); // second burst

    ring.stop();
    vi.advanceTimersByTime(12000);
    expect(oscillators).toHaveLength(4); // silent after stop
  });

  it('is idempotent — starting twice does not double the ring', async () => {
    vi.useFakeTimers();
    const {ctx, oscillators} = fakeAudioContext({resumesTo: 'running'});
    install(ctx);
    const ring = createRingtone();

    await ring.start();
    await ring.start();
    vi.advanceTimersByTime(4000);

    expect(oscillators).toHaveLength(4); // two bursts, not four
    ring.stop();
  });

  it('releases the audio device on stop', async () => {
    const {ctx} = fakeAudioContext({resumesTo: 'running'});
    install(ctx);
    const ring = createRingtone();
    await ring.start();
    ring.stop();
    expect(ctx.closed).toBe(true);
  });
});
