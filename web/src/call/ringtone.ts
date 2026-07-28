/**
 * Ringtone for incoming calls, synthesised with the Web Audio API rather than
 * shipped as an audio file — no binary asset, no extra network request, and it
 * cannot be blocked by the Content-Security-Policy that governs media loading.
 *
 * The pattern is the classic dual-tone telephone ring (440 Hz + 480 Hz), which
 * is instantly recognisable as "a call is coming in" in a way a generic
 * notification beep is not.
 */

/** Length of one audible burst. */
const TONE_SECONDS = 1.2;
/** Full ring cycle: burst, then silence, then repeat. */
const CYCLE_MS = 4000;
/** Kept well below 1.0 — two summed oscillators clip easily. */
const PEAK_GAIN = 0.18;
/** Ramp in/out of each burst; a hard start/stop produces an audible click. */
const EDGE_SECONDS = 0.06;

const RING_FREQUENCIES = [440, 480];

export interface Ringtone {
  /**
   * Begins ringing. Resolves to false when the browser's autoplay policy
   * blocked playback (no user gesture yet on this page), so the caller can fall
   * back to a purely visual alert.
   */
  start: () => Promise<boolean>;
  stop: () => void;
}

/** Emits a single dual-tone burst on an already-running context. */
function playBurst(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const end = now + TONE_SECONDS;

  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + EDGE_SECONDS);
  gain.gain.setValueAtTime(PEAK_GAIN, end - EDGE_SECONDS);
  gain.gain.linearRampToValueAtTime(0, end);

  for (const frequency of RING_FREQUENCIES) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    osc.connect(gain);
    osc.start(now);
    osc.stop(end);
  }
}

export function createRingtone(): Ringtone {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    // Release the audio device rather than leaving a silent context running.
    ctx?.close().catch(() => undefined);
    ctx = null;
  };

  const start = async () => {
    if (timer) return true; // already ringing
    const Ctor = window.AudioContext ?? (window as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!Ctor) return false;

    ctx = new Ctor();
    // Browsers hand back a suspended context until the page has seen a user
    // gesture. resume() succeeds if one has happened, throws/stays suspended
    // otherwise — either way we must not throw at the call site.
    try {
      await ctx.resume();
    } catch {
      /* fall through to the suspended check below */
    }
    if (ctx.state !== 'running') {
      stop();
      return false;
    }

    playBurst(ctx);
    timer = setInterval(() => {
      if (ctx && ctx.state === 'running') playBurst(ctx);
    }, CYCLE_MS);
    return true;
  };

  return {start, stop};
}
