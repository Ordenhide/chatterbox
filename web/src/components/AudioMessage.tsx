import {useRef, useState} from 'react';
import {colors} from '../theme';
import Icon from './Icon';

/**
 * A voice message, drawn inside the bubble rather than on top of one.
 *
 * `mine` exists because the bubble already has a fill: a solid block of
 * --cb-text for an outgoing message, a ruled outline for an incoming one.
 * This used to paint surfaceStrong and a border on itself regardless, which
 * put a light pill inside the dark block and read as two stacked elements.
 * Mirrors ChatScreen's renderAudioBubble on mobile.
 */
export default function AudioMessage({
  url,
  duration,
  mine,
}: {
  url: string;
  duration?: number;
  mine?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.play().catch(() => undefined);
    }
  };

  const fmt = (s?: number) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // On the inverted fill the accent is not legible, so the ink is; on the
  // app's own ground the accent is exactly where it belongs.
  const accent = mine ? 'var(--cb-text-on-primary)' : colors.primary;
  return (
    <div style={mine ? styles.wrapPlain : styles.wrap}>
      <button
        onClick={toggle}
        style={mine ? {...styles.play, ...styles.playPlain} : styles.play}
        aria-label={playing ? 'Pause' : 'Play'}>
        <Icon name={playing ? 'pause' : 'play'} size={15} />
      </button>
      <div style={styles.bars}>
        {BARS.map((h, i) => (
          <span key={i} style={{...styles.bar, height: h, background: accent}} />
        ))}
      </div>
      <span style={mine ? {...styles.time, color: accent} : styles.time}>{fmt(duration)}</span>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

const BARS = [7, 12, 18, 10, 15, 20, 11, 8, 14, 9, 16, 12, 6];

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    maxWidth: 300,
    padding: '6px 12px',
    margin: '4px 0',
    borderRadius: 999,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
  },
  // Same box, no fill of its own — the bubble underneath is the fill.
  wrapPlain: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    maxWidth: 300,
    padding: '6px 12px',
    margin: '4px 0',
    borderRadius: 999,
  },
  playPlain: {
    background: 'transparent',
    color: 'var(--cb-text-on-primary)',
  },
  play: {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: 'none',
    color: colors.textOnPrimary,
    background: colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bars: {display: 'flex', alignItems: 'center', gap: 2, flex: 1, height: 22},
  bar: {width: 2.5, borderRadius: 2, display: 'inline-block', background: colors.primary, opacity: 0.55},
  time: {fontSize: 12, flexShrink: 0, color: colors.textSecondary},
};
