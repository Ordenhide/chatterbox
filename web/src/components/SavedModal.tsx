import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {listenBookmarks, removeBookmark} from '../services/bookmarks';
import Icon from './Icon';
import type {Bookmark} from '../types';

export default function SavedModal({myUid, onClose}: {myUid: string; onClose: () => void}) {
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [items, setItems] = useState<Bookmark[]>([]);

  useEffect(() => listenBookmarks(myUid, setItems), [myUid]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Saved messages"
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <h2 style={styles.title}>Saved messages</h2>
          <button style={styles.close} onClick={onClose} title="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="scroll" style={styles.list}>
          {items.length === 0 ? (
            <div style={styles.empty}>
              No saved messages yet. Open a message's actions in any chat and choose Save.
            </div>
          ) : (
            items.map(b => (
              <div key={b.id} style={styles.item}>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={styles.sender}>{b.senderName || 'Someone'}</div>
                  <div style={styles.text}>{b.text || '[media]'}</div>
                </div>
                <button style={styles.remove} onClick={() => removeBookmark(myUid, b.id)}>
                  Remove
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
    background: 'rgba(10,15,30,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80vh',
    background: colors.surfaceStrong,
    borderRadius: 20,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 30px 60px -24px rgba(20,30,60,0.35)',
  },
  head: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12},
  title: {margin: 0, fontSize: 20, color: colors.text},
  close: {background: 'none', border: 'none', color: colors.textSecondary, display: 'flex', alignItems: 'center'},
  list: {overflowY: 'auto'},
  empty: {textAlign: 'center', color: colors.textSecondary, padding: 28, fontSize: 14, lineHeight: 1.5},
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 4px',
    borderBottom: `1px solid ${colors.border}`,
  },
  sender: {fontWeight: 700, fontSize: 13, color: colors.textSecondary},
  text: {fontSize: 15, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'},
  remove: {
    padding: '6px 12px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
  },
};
