import {useRef, useState} from 'react';
import {colors} from '../theme';
import Icon from './Icon';

export default function AudioMessage({url, duration}: {url: string; duration?: number}) {
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

  return (
    <div style={styles.wrap}>
      <button onClick={toggle} style={styles.play} aria-label={playing ? 'Pause' : 'Play'}>
        <Icon name={playing ? 'pause' : 'play'} size={15} />
      </button>
      <div style={styles.bars}>
        {BARS.map((h, i) => (
          <span key={i} style={{...styles.bar, height: h}} />
        ))}
      </div>
      <span style={styles.time}>{fmt(duration)}</span>
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
