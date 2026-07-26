import {useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {findOrCreateDirectChat, getUserByEmail} from '../services/chat';

export default function NewChatModal({
  myUid,
  onClose,
  onCreated,
}: {
  myUid: string;
  onClose: () => void;
  onCreated: (chatId: string) => void;
}) {
  const dialogRef = useModal<HTMLFormElement>(onClose);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const target = email.trim().toLowerCase();
    if (!target) return;
    setBusy(true);
    try {
      const other = await getUserByEmail(target);
      if (!other) {
        setError('No Chatterbox user found with that email.');
        setBusy(false);
        return;
      }
      if (other.uid === myUid) {
        setError('You can’t start a chat with yourself.');
        setBusy(false);
        return;
      }
      const chatId = await findOrCreateDirectChat(myUid, other);
      onCreated(chatId);
    } catch (err) {
      console.warn('new chat failed:', err);
      setError('Could not start the chat. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="New chat"
        style={styles.modal}
        onClick={e => e.stopPropagation()}
        onSubmit={start}>
        <h2 style={styles.title}>New chat</h2>
        <p style={styles.subtitle}>Enter the email of the person you want to message.</p>
        <input
          style={styles.input}
          placeholder="friend@example.com"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoFocus
        />
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.actions}>
          <button type="button" style={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={styles.start} disabled={busy}>
            {busy ? <span className="spinner" /> : 'Start chat'}
          </button>
        </div>
      </form>
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
    zIndex: 10,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    background: colors.surfaceStrong,
    borderRadius: 20,
    padding: 26,
    boxShadow: '0 30px 60px -20px rgba(20,30,60,0.35)',
  },
  title: {margin: '0 0 6px', fontSize: 20, color: colors.text},
  subtitle: {margin: '0 0 18px', fontSize: 14, color: colors.textSecondary},
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 15,
    color: colors.text,
  },
  error: {color: colors.danger, fontSize: 13, marginTop: 10},
  actions: {display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20},
  cancel: {
    padding: '10px 18px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    fontWeight: 600,
  },
  start: {padding: '10px 22px', minHeight: 42, minWidth: 100},
};
