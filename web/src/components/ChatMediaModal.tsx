import {useMemo, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {useLightbox} from '../context/LightboxContext';
import type {ChatMessage} from '../types';
import Icon from './Icon';

// Grid of every photo/video shared in the chat, newest first. Sourced from the
// messages already loaded in the pane (matches the mobile ChatMedia screen,
// which likewise reads the live message window) — "Load older" in the chat
// backfills more history into this gallery.
export default function ChatMediaModal({
  messages,
  onClose,
}: {
  messages: ChatMessage[];
  onClose: () => void;
}) {
  const {t} = useT();
  const lightbox = useLightbox();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [video, setVideo] = useState<string | null>(null);

  const media = useMemo(
    () => messages.filter(m => m.image || m.video).slice().reverse(),
    [messages],
  );

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('media.title')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <span style={styles.title}>
            <Icon name="image" size={18} /> {t('media.title')}
          </span>
          <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {media.length === 0 ? (
          <div style={styles.empty}>{t('media.empty')}</div>
        ) : (
          <div className="scroll" style={styles.grid}>
            {media.map(m => (
              <button
                key={m._id}
                style={styles.cell}
                aria-label={m.image ? 'Open photo full size' : 'Play video'}
                onClick={() => (m.image ? lightbox.open(m.image) : setVideo(m.video || null))}>
                {m.image ? (
                  <img src={m.image} alt="" loading="lazy" style={styles.thumb} />
                ) : (
                  <div style={styles.videoThumb}>
                    <video src={m.video || undefined} style={styles.thumb} muted preload="metadata" />
                    <span style={styles.playBadge}>
                      <Icon name="play" size={18} style={{color: '#fff'}} />
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {video && (
        <div style={styles.videoOverlay} onClick={() => setVideo(null)}>
          <video src={video} style={styles.videoPlayer} controls autoPlay onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(6,7,16,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 40,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  modal: {
    width: '100%',
    maxWidth: 560,
    height: 'min(80vh, 720px)',
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: colors.shadow,
  },
  head: {display: 'flex', alignItems: 'center', justifyContent: 'space-between'},
  title: {display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: colors.text},
  close: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flex: 1,
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 4,
    alignContent: 'start',
  },
  cell: {
    position: 'relative',
    aspectRatio: '1',
    padding: 0,
    border: 'none',
    borderRadius: 8,
    overflow: 'hidden',
    background: colors.inputBg,
    cursor: 'pointer',
  },
  thumb: {width: '100%', height: '100%', objectFit: 'cover', display: 'block'},
  videoThumb: {position: 'relative', width: '100%', height: '100%'},
  playBadge: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.25)',
  },
  empty: {flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 14},
  videoOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 50,
  },
  videoPlayer: {maxWidth: '92vw', maxHeight: '86vh', borderRadius: 12},
};
