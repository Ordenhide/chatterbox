import {useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {isChatLocked, removeChatLock, setChatLockPIN, verifyChatPIN} from '../services/appLock';
import Icon from './Icon';

type Mode = 'unlock' | 'manage';

/**
 * The PIN gate for a locked chat, and the panel for setting or clearing that
 * PIN.
 *
 * One component for both because they are the same interaction with different
 * stakes, and splitting them would duplicate the keypad handling and the
 * "wrong PIN" state. `mode` decides which: `unlock` blocks access to a chat,
 * `manage` changes the lock from the chat menu.
 *
 * The lock is a privacy screen, not encryption — see services/appLock. It stops
 * someone with your unlocked browser from reading a chat over your shoulder; it
 * does not protect the messages at rest, which are already E2EE'd independently.
 */
export default function ChatLockModal({
  chatId,
  mode,
  onClose,
  onUnlocked,
}: {
  chatId: string;
  mode: Mode;
  onClose: () => void;
  onUnlocked?: () => void;
}) {
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const locked = isChatLocked(chatId);

  const submitUnlock = () => {
    if (verifyChatPIN(chatId, pin)) {
      onUnlocked?.();
      return;
    }
    setError('Incorrect PIN.');
    setPin('');
  };

  const submitSet = () => {
    if (pin.length < 4) {
      setError('Use at least 4 digits.');
      return;
    }
    if (pin !== confirm) {
      setError('Those PINs do not match.');
      return;
    }
    setChatLockPIN(chatId, pin);
    onClose();
  };

  const clear = () => {
    // Requires the current PIN — otherwise anyone at an unlocked browser could
    // simply remove the lock instead of entering it, which would make the whole
    // feature decorative.
    if (!verifyChatPIN(chatId, pin)) {
      setError('Enter the current PIN to remove the lock.');
      setPin('');
      return;
    }
    removeChatLock(chatId);
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={mode === 'unlock' ? undefined : onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'unlock' ? 'Enter chat PIN' : 'Chat lock'}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.icon}>
          <Icon name="lock" size={22} />
        </div>

        {mode === 'unlock' ? (
          <>
            <div style={styles.title}>This chat is locked</div>
            <div style={styles.desc}>Enter its PIN to open it.</div>
          </>
        ) : (
          <>
            <div style={styles.title}>{locked ? 'Chat lock' : 'Lock this chat'}</div>
            <div style={styles.desc}>
              {locked
                ? 'Enter the current PIN to remove the lock.'
                : 'Ask for a PIN before this chat opens in this browser.'}
            </div>
          </>
        )}

        <input
          style={styles.input}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          aria-label="PIN"
          value={pin}
          onChange={e => {
            setPin(e.target.value);
            setError(null);
          }}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (mode === 'unlock') submitUnlock();
            else if (locked) clear();
            else submitSet();
          }}
          autoFocus
        />

        {mode === 'manage' && !locked && (
          <input
            style={styles.input}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Confirm PIN"
            aria-label="Confirm PIN"
            value={confirm}
            onChange={e => {
              setConfirm(e.target.value);
              setError(null);
            }}
          />
        )}

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          {/* An unlock has no cancel: dismissing it would just reveal the chat
              behind it, which is the thing the PIN is gating. */}
          {mode !== 'unlock' && (
            <button type="button" style={styles.cancel} onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={styles.primary}
            onClick={mode === 'unlock' ? submitUnlock : locked ? clear : submitSet}
            disabled={!pin}>
            {mode === 'unlock' ? 'Unlock' : locked ? 'Remove lock' : 'Set PIN'}
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
    background: 'rgba(6,7,16,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 45,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: colors.shadow,
    textAlign: 'center',
  },
  icon: {color: colors.textSecondary, display: 'flex', justifyContent: 'center'},
  title: {fontSize: 17, fontWeight: 700, color: colors.text},
  desc: {fontSize: 13.5, color: colors.textSecondary, marginBottom: 4},
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 16,
    letterSpacing: '0.3em',
    textAlign: 'center',
    color: colors.text,
  },
  error: {color: colors.danger, fontSize: 13},
  actions: {display: 'flex', gap: 10, marginTop: 4},
  cancel: {
    flex: 1,
    padding: '11px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    fontWeight: 600,
  },
  primary: {flex: 1, padding: '11px', borderRadius: 2, fontSize: 14.5},
};
