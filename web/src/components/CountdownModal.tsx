import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useArtifactCrypto} from '../hooks/useArtifactCrypto';
import {useT, type TKey} from '../i18n';
import {
  addTask,
  createCountdown,
  deleteCountdown,
  listenCountdowns,
  rsvpCountdown,
  toggleTask,
} from '../services/countdown';
import {useToast} from '../context/ToastContext';
import type {SharedCountdown} from '../types';
import Icon from './Icon';

const RSVPS: {id: 'going' | 'maybe' | 'skip'; key: TKey}[] = [
  {id: 'going', key: 'countdown.going'},
  {id: 'maybe', key: 'countdown.maybe'},
  {id: 'skip', key: 'countdown.skip'},
];

// Breaks a remaining-milliseconds value into a compact "3d 4h" / "2h 5m" / "Now"
// label. Returns null while still counting; the label is built in the caller so
// units stay localizable.
function remaining(target: number, now: number): {d: number; h: number; m: number; past: boolean} {
  const diff = target - now;
  const past = diff <= 0;
  const abs = Math.abs(diff);
  return {
    d: Math.floor(abs / 86400000),
    h: Math.floor((abs % 86400000) / 3600000),
    m: Math.floor((abs % 3600000) / 60000),
    past,
  };
}

export default function CountdownModal({
  chatId,
  me,
  peerUid,
  onClose,
}: {
  chatId: string;
  me: {uid: string; name: string};
  /** Needed to seal contents to the pair — see services/e2eeArtifacts.ts. */
  peerUid?: string;
  onClose: () => void;
}) {
  const {t} = useT();
  const toast = useToast();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [items, setItems] = useState<SharedCountdown[]>([]);
  const [now, setNow] = useState(Date.now());
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [when, setWhen] = useState('');
  const [taskDraft, setTaskDraft] = useState<Record<string, string>>({});

  const crypto = useArtifactCrypto(me.uid, peerUid, chatId);
  // Re-subscribes once the sealer resolves so content decrypts rather than
  // flashing empty.
  useEffect(() => listenCountdowns(chatId, setItems, crypto), [chatId, crypto]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const create = () => {
    const trimmed = title.trim();
    if (!trimmed || !when) return;
    createCountdown(chatId, {
      title: trimmed,
      targetDate: new Date(when).getTime(),
      emoji: emoji.trim() || undefined,
      createdBy: me.uid,
      createdByName: me.name,
    }, crypto).catch(() => toast.error(t('common.error')));
    setTitle('');
    setEmoji('');
    setWhen('');
  };

  const label = (c: SharedCountdown): string => {
    const {d, h, m, past} = remaining(c.targetDate, now);
    if (past && d === 0 && h === 0 && m === 0) return t('countdown.now');
    const parts = d > 0 ? [`${d}${t('countdown.dShort')}`, `${h}${t('countdown.hShort')}`] : [`${h}${t('countdown.hShort')}`, `${m}${t('countdown.mShort')}`];
    return past ? `${parts.join(' ')} ${t('countdown.ago')}` : parts.join(' ');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('countdown.title')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <span style={styles.title}>
            <Icon name="calendar" size={18} /> {t('countdown.title')}
          </span>
          <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={styles.addBox}>
          <div style={styles.addRow}>
            <input style={{...styles.input, maxWidth: 52, textAlign: 'center'}} placeholder="🎉" aria-label="Emoji" value={emoji} onChange={e => setEmoji(e.target.value)} />
            <input style={styles.input} placeholder={t('countdown.eventName')} aria-label={t('countdown.eventName')} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div style={styles.addRow}>
            <input style={styles.input} type="datetime-local" aria-label={t('countdown.eventDateTime')} value={when} onChange={e => setWhen(e.target.value)} />
            <button style={styles.addBtn} onClick={create} disabled={!title.trim() || !when}>
              {t('countdown.add')}
            </button>
          </div>
        </div>

        <div className="scroll" style={styles.list}>
          {items.length === 0 ? (
            <div style={styles.empty}>{t('countdown.empty')}</div>
          ) : (
            items.map(c => {
              const myRsvp = c.rsvps?.[me.uid];
              const draft = taskDraft[c.id] || '';
              return (
                <div key={c.id} style={styles.card}>
                  <div style={styles.cardHead}>
                    <span style={styles.emoji}>{c.emoji || '📅'}</span>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={styles.eventTitle}>{c.title}</div>
                      <div style={styles.eventDate}>{new Date(c.targetDate).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}</div>
                    </div>
                    <span style={styles.countdownPill}>{label(c)}</span>
                    {c.createdBy === me.uid && (
                      <button style={styles.iconBtn} onClick={() => deleteCountdown(chatId, c.id).catch(() => toast.error(t('common.error')))} aria-label={t('common.delete')}>
                        <Icon name="trash" size={15} />
                      </button>
                    )}
                  </div>

                  <div style={styles.rsvpRow}>
                    {RSVPS.map(r => (
                      <button
                        key={r.id}
                        style={{...styles.rsvpBtn, ...(myRsvp === r.id ? styles.rsvpActive : null)}}
                        onClick={() => rsvpCountdown(chatId, c.id, me.uid, r.id).catch(() => toast.error(t('common.error')))}>
                        {t(r.key)}
                      </button>
                    ))}
                  </div>

                  {(c.tasks?.length || 0) > 0 && (
                    <div style={styles.tasks}>
                      {c.tasks!.map(task => (
                        <button key={task.id} style={styles.task} onClick={() => toggleTask(chatId, c.id, task.id).catch(() => toast.error(t('common.error')))}>
                          <span style={{...styles.checkbox, ...(task.done ? styles.checkboxOn : null)}}>
                            {task.done && <Icon name="check" size={12} style={{color: '#fff'}} />}
                          </span>
                          <span style={{...styles.taskText, ...(task.done ? styles.taskDone : null)}}>{task.text}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={styles.addTaskRow}>
                    <input
                      style={{...styles.input, fontSize: 13, padding: '7px 10px'}}
                      placeholder={t('countdown.addTask')}
                      aria-label={t('countdown.addTask')}
                      value={draft}
                      onChange={e => setTaskDraft(prev => ({...prev, [c.id]: e.target.value}))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && draft.trim()) {
                          addTask(chatId, c.id, draft.trim(), crypto).catch(() =>
                            toast.error(t('common.error')),
                          );
                          setTaskDraft(prev => ({...prev, [c.id]: ''}));
                        }
                      }}
                    />
                  </div>
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
    maxWidth: 480,
    height: 'min(82vh, 720px)',
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
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
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    color: colors.text,
    fontSize: 14,
    outline: 'none',
  },
  addBtn: {
    padding: '0 18px',
    flexShrink: 0,
    borderRadius: 2,
    border: 'none',
    background: colors.primary,
    color: colors.textOnPrimary,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
  list: {flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12},
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 14,
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
  },
  cardHead: {display: 'flex', alignItems: 'center', gap: 10},
  emoji: {fontSize: 24, flexShrink: 0},
  eventTitle: {fontSize: 15, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'},
  eventDate: {fontSize: 12, color: colors.textSecondary},
  countdownPill: {
    padding: '5px 10px',
    borderRadius: 999,
    background: colors.primaryLight,
    color: colors.primary,
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  iconBtn: {border: 'none', background: 'transparent', color: colors.textTertiary, cursor: 'pointer', display: 'flex', flexShrink: 0},
  rsvpRow: {display: 'flex', gap: 6},
  rsvpBtn: {
    flex: 1,
    padding: '7px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rsvpActive: {background: colors.primary, borderColor: colors.primary, color: colors.textOnPrimary},
  tasks: {display: 'flex', flexDirection: 'column', gap: 6},
  task: {display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left'},
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 2,
    border: `1.6px solid ${colors.borderStrong}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxOn: {background: colors.success, borderColor: colors.success},
  taskText: {fontSize: 13.5, color: colors.text},
  taskDone: {textDecoration: 'line-through', color: colors.textTertiary},
  addTaskRow: {display: 'flex'},
  empty: {flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 14, padding: 20, textAlign: 'center'},
};
