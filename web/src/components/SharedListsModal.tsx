import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {
  createSharedList,
  deleteSharedList,
  listenSharedLists,
  updateSharedListItems,
} from '../services/sharedLists';
import {useToast} from '../context/ToastContext';
import type {SharedList, SharedListItem} from '../types';
import Icon from './Icon';

function newId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function SharedListsModal({
  chatId,
  me,
  onClose,
}: {
  chatId: string;
  me: {uid: string};
  onClose: () => void;
}) {
  const {t} = useT();
  const toast = useToast();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [lists, setLists] = useState<SharedList[]>([]);
  const [newList, setNewList] = useState('');
  const [itemDraft, setItemDraft] = useState<Record<string, string>>({});

  useEffect(() => listenSharedLists(chatId, setLists), [chatId]);

  const fail = () => toast.error(t('common.error'));

  const createList = () => {
    const title = newList.trim();
    if (!title) return;
    createSharedList(chatId, title).catch(fail);
    setNewList('');
  };

  const addItem = (list: SharedList) => {
    const text = (itemDraft[list.id] || '').trim();
    if (!text) return;
    const item: SharedListItem = {id: newId(), text, checked: false};
    updateSharedListItems(chatId, list.id, [...list.items, item]).catch(fail);
    setItemDraft(prev => ({...prev, [list.id]: ''}));
  };

  const toggleItem = (list: SharedList, itemId: string) => {
    const items = list.items.map(it =>
      it.id === itemId ? {...it, checked: !it.checked, checkedBy: !it.checked ? me.uid : undefined} : it,
    );
    updateSharedListItems(chatId, list.id, items).catch(fail);
  };

  const removeItem = (list: SharedList, itemId: string) => {
    updateSharedListItems(chatId, list.id, list.items.filter(it => it.id !== itemId)).catch(fail);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('lists.title')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <span style={styles.title}>
            <Icon name="list" size={18} /> {t('lists.title')}
          </span>
          <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={styles.addRow}>
          <input
            style={styles.input}
            placeholder={t('lists.newList')}
            value={newList}
            onChange={e => setNewList(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createList()}
          />
          <button style={styles.addBtn} onClick={createList} disabled={!newList.trim()}>
            <Icon name="plus" size={18} style={{color: '#fff'}} />
          </button>
        </div>

        <div className="scroll" style={styles.list}>
          {lists.length === 0 ? (
            <div style={styles.empty}>{t('lists.empty')}</div>
          ) : (
            lists.map(list => {
              const done = list.items.filter(it => it.checked).length;
              return (
                <div key={list.id} style={styles.card}>
                  <div style={styles.cardHead}>
                    <span style={styles.listTitle}>{list.title}</span>
                    <span style={styles.progress}>
                      {done}/{list.items.length}
                    </span>
                    <button style={styles.iconBtn} onClick={() => deleteSharedList(chatId, list.id).catch(fail)} aria-label={t('common.delete')}>
                      <Icon name="trash" size={15} />
                    </button>
                  </div>

                  {list.items.map(it => (
                    <div key={it.id} style={styles.itemRow}>
                      <button style={styles.itemToggle} onClick={() => toggleItem(list, it.id)}>
                        <span style={{...styles.checkbox, ...(it.checked ? styles.checkboxOn : null)}}>
                          {it.checked && <Icon name="check" size={12} style={{color: '#fff'}} />}
                        </span>
                        <span style={{...styles.itemText, ...(it.checked ? styles.itemDone : null)}}>{it.text}</span>
                      </button>
                      <button style={styles.iconBtn} onClick={() => removeItem(list, it.id)} aria-label={t('common.delete')}>
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  ))}

                  <input
                    style={{...styles.input, fontSize: 13, padding: '7px 10px', marginTop: 4}}
                    placeholder={t('lists.addItem')}
                    value={itemDraft[list.id] || ''}
                    onChange={e => setItemDraft(prev => ({...prev, [list.id]: e.target.value}))}
                    onKeyDown={e => e.key === 'Enter' && addItem(list)}
                  />
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
    height: 'min(80vh, 700px)',
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
  list: {flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12},
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
  },
  cardHead: {display: 'flex', alignItems: 'center', gap: 8},
  listTitle: {flex: 1, fontSize: 15, fontWeight: 700, color: colors.text},
  progress: {fontSize: 12, fontWeight: 700, color: colors.textSecondary},
  iconBtn: {border: 'none', background: 'transparent', color: colors.textTertiary, cursor: 'pointer', display: 'flex', flexShrink: 0},
  itemRow: {display: 'flex', alignItems: 'center', gap: 8},
  itemToggle: {flex: 1, display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0', textAlign: 'left'},
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    border: `1.6px solid ${colors.borderStrong}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxOn: {background: colors.success, borderColor: colors.success},
  itemText: {fontSize: 14, color: colors.text},
  itemDone: {textDecoration: 'line-through', color: colors.textTertiary},
  empty: {flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 14, padding: 20, textAlign: 'center'},
};
