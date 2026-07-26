import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {addTrack, listenPlaylist, removeTrack, voteTrack} from '../services/playlist';
import {useToast} from '../context/ToastContext';
import type {PlaylistItem} from '../types';
import Icon from './Icon';

// Sort by votes desc, then most-recently added — the shared queue everyone can
// upvote, mirroring the mobile playlist screen.
function ranked(items: PlaylistItem[]): PlaylistItem[] {
  return [...items].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0) || b.addedAt - a.addedAt);
}

export default function PlaylistModal({
  chatId,
  me,
  onClose,
}: {
  chatId: string;
  me: {uid: string; name: string};
  onClose: () => void;
}) {
  const {t} = useT();
  const toast = useToast();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => listenPlaylist(chatId, setItems), [chatId]);

  const add = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    addTrack(chatId, {
      title: trimmed,
      artist: artist.trim() || undefined,
      url: url.trim(),
      addedBy: me.uid,
      addedByName: me.name,
    }).catch(() => toast.error(t('common.error')));
    setTitle('');
    setArtist('');
    setUrl('');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('playlist.title')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <span style={styles.title}>
            <Icon name="music" size={18} /> {t('playlist.title')}
          </span>
          <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={styles.addBox}>
          <input style={styles.input} placeholder={t('playlist.song')} value={title} onChange={e => setTitle(e.target.value)} />
          <div style={styles.addRow}>
            <input style={styles.input} placeholder={t('playlist.artist')} value={artist} onChange={e => setArtist(e.target.value)} />
            <input style={styles.input} placeholder={t('playlist.link')} value={url} onChange={e => setUrl(e.target.value)} />
            <button style={styles.addBtn} onClick={add} disabled={!title.trim()} aria-label={t('playlist.add')}>
              <Icon name="plus" size={18} style={{color: '#fff'}} />
            </button>
          </div>
        </div>

        <div className="scroll" style={styles.list}>
          {items.length === 0 ? (
            <div style={styles.empty}>{t('playlist.empty')}</div>
          ) : (
            ranked(items).map(track => {
              const voted = track.votes?.includes(me.uid);
              return (
                <div key={track.id} style={styles.row}>
                  <div style={{flex: 1, minWidth: 0}}>
                    {track.url ? (
                      <a href={track.url} target="_blank" rel="noreferrer" style={styles.trackTitle}>
                        {track.title}
                      </a>
                    ) : (
                      <span style={styles.trackTitle}>{track.title}</span>
                    )}
                    <div style={styles.trackMeta}>
                      {[track.artist, track.addedByName].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button
                    style={{...styles.voteBtn, ...(voted ? styles.voteBtnActive : null)}}
                    onClick={() => voteTrack(chatId, track.id, me.uid).catch(() => toast.error(t('common.error')))}>
                    <Icon name={voted ? 'heartFilled' : 'heart'} size={14} /> {track.votes?.length || 0}
                  </button>
                  {track.addedBy === me.uid && (
                    <button
                      style={styles.removeBtn}
                      onClick={() => removeTrack(chatId, track.id).catch(() => toast.error(t('common.error')))}
                      aria-label={t('common.delete')}>
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
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
    height: 'min(76vh, 680px)',
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 16,
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
  addBox: {display: 'flex', flexDirection: 'column', gap: 8},
  addRow: {display: 'flex', gap: 8},
  input: {
    flex: 1,
    minWidth: 0,
    padding: '9px 12px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    color: colors.text,
    fontSize: 14,
    outline: 'none',
  },
  addBtn: {
    width: 40,
    flexShrink: 0,
    borderRadius: 12,
    border: 'none',
    background: colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  list: {flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8},
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
  },
  trackTitle: {fontSize: 14, fontWeight: 600, color: colors.text, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'},
  trackMeta: {fontSize: 12, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'},
  voteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    color: colors.text,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  },
  voteBtnActive: {borderColor: colors.primary, color: colors.primary},
  removeBtn: {
    border: 'none',
    background: 'transparent',
    color: colors.textTertiary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  empty: {flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 14, padding: 20, textAlign: 'center'},
};
