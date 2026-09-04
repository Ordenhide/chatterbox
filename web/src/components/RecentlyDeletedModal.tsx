/**
 * Recently deleted messages, with the time each has left before it is gone
 * for good. Only the person who deleted a message can see or recover it —
 * enforced by the rules on chats/{chatId}/trash, not just by this screen.
 */
import {useCallback, useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {useToast} from '../context/ToastContext';
import {decryptMessage, isEncryptedPayload} from '../services/e2ee';
import {getDeviceKeypairIfEnrolled} from '../services/e2eeKeys';
import {
  formatRemaining,
  listenTrash,
  recoverMessage,
  type TrashedMessage,
} from '../services/messageTrash';
import Icon from './Icon';

/** A short label for a trashed message: its text where readable, else its kind. */
function preview(
  item: TrashedMessage,
  secretKey: Uint8Array | null,
  chatId: string,
  t: (k: 'trash.photo' | 'trash.video' | 'trash.voice' | 'trash.file' | 'trash.message') => string,
): string {
  const p = item.payload as Record<string, unknown>;
  if (typeof p.text === 'string' && p.text) return p.text;
  if (secretKey && isEncryptedPayload(p.encrypted)) {
    try {
      return decryptMessage(p.encrypted, secretKey, chatId);
    } catch {
      /* fall through to a kind label */
    }
  }
  if (p.image || p.encryptedImage || p.gif) return t('trash.photo');
  if (p.video || p.encryptedVideo) return t('trash.video');
  if (p.audio || p.encryptedAudio) return t('trash.voice');
  if (p.file || p.encryptedFileUri) return t('trash.file');
  return t('trash.message');
}

export default function RecentlyDeletedModal({
  chatId,
  uid,
  onClose,
}: {
  chatId: string;
  uid: string;
  onClose: () => void;
}) {
  const {t} = useT();
  const toast = useToast();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [items, setItems] = useState<TrashedMessage[]>([]);
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Re-render on a timer so the countdown stays honest while the modal is open.
  const [, setTick] = useState(0);

  useEffect(() => listenTrash(chatId, uid, setItems), [chatId, uid]);

  useEffect(() => {
    let active = true;
    // Reading the trash must not enrol this browser; without a key the list
    // simply renders undecrypted.
    getDeviceKeypairIfEnrolled(uid)
      .then(kp => {
        if (active && kp) setSecretKey(kp.secretKey);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [uid]);

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const recover = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        const ok = await recoverMessage(chatId, id);
        toast.show(t(ok ? 'trash.recovered' : 'trash.expired'), ok ? 'success' : 'error');
      } catch {
        toast.error(t('common.error'));
      } finally {
        setBusy(null);
      }
    },
    [chatId, t, toast],
  );

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('trash.title')}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <span style={styles.title}>
            <Icon name="trash" size={17} /> {t('trash.title')}
          </span>
          <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <p style={styles.desc}>{t('trash.desc')}</p>

        <div className="scroll" style={styles.list}>
          {items.length === 0 ? (
            <div style={styles.empty}>{t('trash.empty')}</div>
          ) : (
            items.map(item => (
              <div key={item.id} style={styles.row}>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={styles.rowText}>{preview(item, secretKey, chatId, t)}</div>
                  <div style={styles.rowMeta}>
                    {new Date(item.deletedAt).toLocaleString()} · {t('trash.timeLeft')}{' '}
                    {formatRemaining(item.deletedAt)}
                  </div>
                </div>
                <button
                  className="btn btn-soft"
                  style={styles.recoverBtn}
                  disabled={busy === item.id}
                  onClick={() => recover(item.id)}>
                  {busy === item.id ? <span className="spinner" /> : t('trash.recover')}
                </button>
              </div>
            ))
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
    maxWidth: 480,
    maxHeight: 'min(76vh, 660px)',
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
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
  desc: {margin: '0 0 4px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5},
  list: {flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8},
  empty: {padding: '28px 0', textAlign: 'center', color: colors.textSecondary, fontSize: 14},
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
  },
  rowText: {
    fontSize: 14,
    color: colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowMeta: {fontSize: 11.5, color: colors.textTertiary, marginTop: 2},
  recoverBtn: {flexShrink: 0, padding: '7px 12px', fontSize: 13, fontWeight: 700},
};
