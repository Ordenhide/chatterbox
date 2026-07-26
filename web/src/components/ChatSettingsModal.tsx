import {useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {
  deleteChat,
  EXPIRY_OPTIONS,
  setChatExpiryPolicy,
  setChatName,
  setChatTheme,
  setChatWallpaper,
  toggleMuteChat,
} from '../services/chat';
import {useToast} from '../context/ToastContext';
import type {ChatRoom} from '../types';
import Icon from './Icon';

// Accent colors and wallpaper tints — a web-tasteful subset that overlaps the
// mobile palette so a choice made on either client reads sensibly on both.
const THEME_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#64748B'];
const WALLPAPERS: {id: string; value: string | null}[] = [
  {id: 'none', value: null},
  {id: 'blush', value: '#FDECF3'},
  {id: 'mint', value: '#E7F8F1'},
  {id: 'sky', value: '#E8F1FE'},
  {id: 'sand', value: '#F6F1E7'},
  {id: 'dusk', value: '#1B1B2A'},
  {id: 'ink', value: '#12131F'},
];

export default function ChatSettingsModal({
  chatId,
  me,
  chat,
  onClose,
  onDeleted,
}: {
  chatId: string;
  me: {uid: string};
  chat: ChatRoom | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const {t} = useT();
  const toast = useToast();
  const dialogRef = useModal<HTMLDivElement>(onClose);

  const [name, setName] = useState(chat?.nameBy?.[me.uid] || '');
  const isMuted = !!chat?.mutedBy?.includes(me.uid);
  const theme = chat?.themeBy?.[me.uid] || THEME_COLORS[0];
  const wallpaper = chat?.wallpaperBy?.[me.uid] ?? null;
  const expiry = chat?.messageExpiry || 0;

  const saveName = () => {
    const trimmed = name.trim();
    setChatName(chatId, me.uid, trimmed || null).catch(() => toast.error(t('common.error')));
  };

  const expiryLabel = (hours: number): string => {
    if (!hours) return t('chatSettings.expiryOff');
    if (hours < 24) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
  };

  const confirmDelete = () => {
    if (!window.confirm(t('chatSettings.deleteConfirm'))) return;
    deleteChat(chatId)
      .then(() => {
        onDeleted();
        onClose();
      })
      .catch(() => toast.error(t('common.error')));
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('chatSettings.title')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <span style={styles.title}>{t('chatSettings.title')}</span>
          <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="scroll" style={styles.body}>
          {/* Custom name */}
          <div style={styles.section}>
            <div style={styles.label}>{t('chatSettings.customName')}</div>
            <div style={styles.nameRow}>
              <input
                style={styles.input}
                value={name}
                placeholder={t('chatSettings.customNamePlaceholder')}
                onChange={e => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={e => e.key === 'Enter' && saveName()}
              />
            </div>
          </div>

          {/* Mute */}
          <button
            style={styles.toggleRow}
            onClick={() => toggleMuteChat(chatId, me.uid, isMuted).catch(() => toast.error(t('common.error')))}>
            <span style={styles.rowLabel}>
              <Icon name={isMuted ? 'bellOff' : 'bell'} size={16} /> {t('chatSettings.mute')}
            </span>
            <span style={{...styles.switch, background: isMuted ? colors.primary : colors.border}}>
              <span style={{...styles.knob, transform: isMuted ? 'translateX(18px)' : 'translateX(0)'}} />
            </span>
          </button>

          {/* Theme accent */}
          <div style={styles.section}>
            <div style={styles.label}>{t('chatSettings.theme')}</div>
            <div style={styles.swatchRow}>
              {THEME_COLORS.map(c => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => setChatTheme(chatId, me.uid, c).catch(() => toast.error(t('common.error')))}
                  style={{
                    ...styles.swatch,
                    background: c,
                    outline: theme === c ? `2px solid ${colors.text}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Wallpaper */}
          <div style={styles.section}>
            <div style={styles.label}>{t('chatSettings.wallpaper')}</div>
            <div style={styles.swatchRow}>
              {WALLPAPERS.map(w => (
                <button
                  key={w.id}
                  aria-label={w.id}
                  onClick={() => setChatWallpaper(chatId, me.uid, w.value).catch(() => toast.error(t('common.error')))}
                  style={{
                    ...styles.swatch,
                    background: w.value || colors.inputBg,
                    border: w.value ? styles.swatch.border : `1px dashed ${colors.borderStrong}`,
                    outline: wallpaper === w.value ? `2px solid ${colors.text}` : 'none',
                    outlineOffset: 2,
                  }}>
                  {w.value === null && <Icon name="close" size={14} style={{color: colors.textTertiary}} />}
                </button>
              ))}
            </div>
          </div>

          {/* Disappearing messages */}
          <div style={styles.section}>
            <div style={styles.label}>{t('chatSettings.disappearing')}</div>
            <div style={styles.chipRow}>
              {EXPIRY_OPTIONS.map(o => (
                <button
                  key={o.hours}
                  onClick={() => setChatExpiryPolicy(chatId, o.hours).catch(() => toast.error(t('common.error')))}
                  style={{
                    ...styles.chip,
                    ...(expiry === o.hours ? styles.chipActive : null),
                  }}>
                  {expiryLabel(o.hours)}
                </button>
              ))}
            </div>
          </div>

          {/* Danger zone */}
          <button style={styles.deleteBtn} onClick={confirmDelete}>
            <Icon name="trash" size={16} /> {t('chatSettings.deleteChat')}
          </button>
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
    maxWidth: 440,
    maxHeight: 'min(84vh, 720px)',
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
  title: {fontSize: 17, fontWeight: 700, color: colors.text},
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
  body: {display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingRight: 2},
  section: {display: 'flex', flexDirection: 'column', gap: 8},
  label: {fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4},
  nameRow: {display: 'flex', gap: 8},
  input: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    color: colors.text,
    fontSize: 14,
    outline: 'none',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 2px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  rowLabel: {display: 'flex', alignItems: 'center', gap: 8, color: colors.text, fontSize: 15, fontWeight: 500},
  switch: {width: 40, height: 22, borderRadius: 999, position: 'relative', transition: 'background .15s', flexShrink: 0},
  knob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: 999,
    background: '#fff',
    transition: 'transform .15s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  swatchRow: {display: 'flex', flexWrap: 'wrap', gap: 10},
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  chipRow: {display: 'flex', flexWrap: 'wrap', gap: 8},
  chip: {
    padding: '7px 14px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: {background: colors.primary, borderColor: colors.primary, color: '#fff'},
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '11px',
    borderRadius: 12,
    border: `1px solid ${colors.danger}`,
    background: 'transparent',
    color: colors.danger,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
  },
};
