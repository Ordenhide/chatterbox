import {useEffect, useRef, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {gifConfigured, searchGifs, trendingGifs, type GifResult} from '../services/gifSearch';
import Icon from './Icon';

export default function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: GifResult) => void;
  onClose: () => void;
}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const p = q.trim() ? searchGifs(q) : trendingGifs();
      p.then(res => {
        setGifs(res);
        setLoading(false);
      }).catch(() => {
        setError(gifConfigured() ? t('gif.error') : t('gif.notConfigured'));
        setLoading(false);
      });
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, t]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('gif.title')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <div style={styles.searchWrap}>
            <Icon name="search" size={16} style={{color: colors.textTertiary}} />
            <input
              style={styles.input}
              placeholder={t('gif.search')}
              aria-label={t('gif.search')}
              value={q}
              onChange={e => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="scroll" style={styles.grid}>
          {loading ? (
            <div style={styles.info}>
              <span className="spinner" />
            </div>
          ) : error ? (
            <div style={styles.info}>{error}</div>
          ) : gifs.length === 0 ? (
            <div style={styles.info}>{t('gif.none')}</div>
          ) : (
            <div style={styles.masonry}>
              {gifs.map(g => (
                <button key={g.id} style={styles.gifBtn} aria-label="Choose this GIF" onClick={() => onPick(g)}>
                  <img src={g.previewUrl} alt="" loading="lazy" style={styles.gifImg} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={styles.attribution}>{t('gif.via')}</div>
      </div>
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
    maxWidth: 460,
    height: 'min(70vh, 640px)',
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: colors.shadow,
  },
  head: {display: 'flex', alignItems: 'center', gap: 8},
  searchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
  },
  input: {flex: 1, border: 'none', background: 'transparent', color: colors.text, fontSize: 14, outline: 'none'},
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
    flexShrink: 0,
  },
  grid: {flex: 1, overflowY: 'auto'},
  masonry: {columnCount: 2, columnGap: 8},
  gifBtn: {
    display: 'block',
    width: '100%',
    marginBottom: 8,
    padding: 0,
    border: 'none',
    borderRadius: 2,
    overflow: 'hidden',
    background: colors.inputBg,
    breakInside: 'avoid',
  },
  gifImg: {width: '100%', display: 'block', borderRadius: 2},
  info: {height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, textAlign: 'center', padding: 20, fontSize: 14},
  attribution: {fontSize: 11, color: colors.textTertiary, textAlign: 'center'},
};
