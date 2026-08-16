import {useEffect, useState} from 'react';
import {doc, onSnapshot} from 'firebase/firestore';
import {db} from '../firebase';
import {colors} from '../theme';
import {useToast} from '../context/ToastContext';
import {
  DEFAULT_AUTO_REPLY,
  disableFocusMode,
  enableFocusMode,
  isFocusActive,
} from '../services/focusMode';

/** Same options the mobile Profile screen offers, so the two read alike. */
const DURATIONS_MIN = [15, 30, 60, 120];

/**
 * Focus mode: auto-reply to anyone who messages you, for a set time.
 *
 * The replying itself is server-side (`autoReplyFocusMode`), so this card only
 * writes the flag — there is no web-specific reply path that could drift from
 * mobile's.
 *
 * State comes from a live listener rather than a one-shot read because the
 * server clears `enabled` when focus expires, and mobile can toggle it too; a
 * snapshot taken at mount would go stale in both cases.
 */
export default function FocusModeCard({uid}: {uid: string}) {
  const toast = useToast();
  const [focus, setFocus] = useState<{enabled?: boolean; until?: number; autoReply?: string} | null>(
    null,
  );
  const [minutes, setMinutes] = useState(30);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // Re-renders on a timer so the card stops claiming focus is on the moment the
  // deadline passes, without waiting for a Firestore write to wake the listener.
  const [, setTick] = useState(0);

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'users', uid),
        snap => setFocus((snap.data()?.focusMode as typeof focus) ?? null),
        () => setFocus(null),
      ),
    [uid],
  );

  const active = isFocusActive(focus);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [active]);

  const enable = async () => {
    setBusy(true);
    try {
      await enableFocusMode(uid, minutes * 60_000, message.trim() || undefined);
      toast.success(`Focus mode on for ${minutes} minutes`);
    } catch {
      toast.error('Could not turn on focus mode. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disableFocusMode(uid);
      toast.show('Focus mode off');
    } catch {
      toast.error('Could not turn off focus mode. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={styles.card}>
      <div style={styles.title}>Focus mode</div>
      <div style={styles.desc}>
        Auto-reply to anyone who messages you, so people know you'll get back to them.
      </div>

      {active ? (
        <>
          <div style={styles.activeBar}>
            Active until{' '}
            {focus?.until
              ? new Date(focus.until).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
              : '—'}
          </div>
          {focus?.autoReply && <div style={styles.reply}>“{focus.autoReply}”</div>}
          <button
            type="button"
            className="btn"
            style={styles.off}
            onClick={disable}
            disabled={busy}>
            Turn off focus mode
          </button>
        </>
      ) : (
        <>
          <div style={styles.label}>Duration</div>
          <div style={styles.chips}>
            {DURATIONS_MIN.map(m => (
              <button
                key={m}
                type="button"
                className="btn"
                style={{...styles.chip, ...(minutes === m ? styles.chipOn : styles.chipOff)}}
                onClick={() => setMinutes(m)}>
                {m < 60 ? `${m} min` : `${m / 60} hr`}
              </button>
            ))}
          </div>
          <input
            style={styles.input}
            placeholder={DEFAULT_AUTO_REPLY}
            aria-label="Auto-reply message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={200}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={styles.on}
            onClick={enable}
            disabled={busy}>
            {busy ? <span className="spinner" /> : 'Turn on focus mode'}
          </button>
        </>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    boxShadow: colors.shadowSoft,
  },
  title: {fontWeight: 700, fontSize: 15, color: colors.text},
  desc: {fontSize: 13.5, color: colors.textSecondary, margin: '4px 0 12px'},
  label: {fontSize: 12.5, color: colors.textSecondary, marginBottom: 8},
  chips: {display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap'},
  chip: {flex: 1, minWidth: 72, padding: '9px 0', borderRadius: 12, fontSize: 13.5},
  chipOn: {background: colors.primary, color: '#fff'},
  chipOff: {background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`},
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  on: {width: '100%', padding: '12px', borderRadius: 12, fontSize: 14.5},
  off: {
    width: '100%',
    padding: '12px',
    borderRadius: 12,
    fontSize: 14.5,
    border: `1px solid ${colors.danger}`,
    background: 'transparent',
    color: colors.danger,
    fontWeight: 700,
  },
  activeBar: {
    padding: '10px 12px',
    borderRadius: 12,
    background: colors.primaryLight,
    color: colors.primary,
    fontWeight: 700,
    fontSize: 13.5,
    marginBottom: 8,
  },
  reply: {fontSize: 13, color: colors.textSecondary, marginBottom: 10},
};
