import {useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {createChat, findOrCreateDirectChat, getUserByEmail} from '../services/chat';
import {MAX_GROUP_MEMBERS} from '../services/e2ee';
import type {UserProfile} from '../types';

export default function NewChatModal({
  myUid,
  onClose,
  onCreated,
  onUseInvite,
}: {
  myUid: string;
  onClose: () => void;
  onCreated: (chatId: string) => void;
  onUseInvite: () => void;
}) {
  const dialogRef = useModal<HTMLFormElement>(onClose);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One person makes a direct chat, several makes a group — there is no
  // separate "create group" mode to choose up front. Mirrors mobile's
  // NewChatScreen.
  const [invitees, setInvitees] = useState<UserProfile[]>([]);

  const addInvitee = async () => {
    setError(null);
    const target = email.trim().toLowerCase();
    if (!target) return;
    // The signed-in user takes one of the seats, so only cap-1 others fit.
    if (invitees.length >= MAX_GROUP_MEMBERS - 1) {
      setError(`A chat can hold at most ${MAX_GROUP_MEMBERS} people.`);
      return;
    }
    setBusy(true);
    try {
      const other = await getUserByEmail(target);
      if (!other) {
        setError('No Chatterbox user found with that email.');
        return;
      }
      if (other.uid === myUid) {
        setError('You can’t start a chat with yourself.');
        return;
      }
      if (invitees.some(i => i.uid === other.uid)) {
        setError('That person is already in this chat.');
        return;
      }
      setInvitees(prev => [...prev, other]);
      setEmail('');
    } catch (err) {
      console.warn('add invitee failed:', err);
      setError('Could not look that person up. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Typing an address and hitting enter without pressing Add should still do
    // the obvious thing rather than silently starting an empty chat.
    if (invitees.length === 0) {
      await addInvitee();
      return;
    }
    setBusy(true);
    try {
      // Only direct chats are de-duplicated: two groups with the same members
      // are legitimately different conversations.
      if (invitees.length === 1) {
        onCreated(await findOrCreateDirectChat(myUid, invitees[0]));
        return;
      }
      const name = invitees.map(i => i.displayName || i.email).join(', ');
      onCreated(await createChat([myUid, ...invitees.map(i => i.uid)], name));
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
        <p style={styles.subtitle}>
          Add one person for a direct chat, or several for a group.
        </p>
        {/* Above the email field, not below it: this is the path replacing it.
            Email lookup only reaches people who already have an account and
            whose address you know, and it costs a searchable directory. */}
        <button type="button" className="btn btn-soft" style={styles.invite} onClick={onUseInvite}>
          Invite with a link instead
        </button>
        <div style={styles.addRow}>
          <input
            style={styles.input}
            placeholder="friend@example.com"
            aria-label="Email address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="btn btn-soft"
            style={styles.add}
            onClick={addInvitee}
            disabled={busy || !email.trim()}>
            Add
          </button>
        </div>

        {invitees.length > 0 && (
          <ul style={styles.chips}>
            {invitees.map(person => (
              <li key={person.uid}>
                <button
                  type="button"
                  style={styles.chip}
                  onClick={() => setInvitees(prev => prev.filter(p => p.uid !== person.uid))}
                  aria-label={`Remove ${person.displayName || person.email}`}>
                  {person.displayName || person.email} ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.actions}>
          <button type="button" style={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={styles.start} disabled={busy}>
            {busy ? (
              <span className="spinner" />
            ) : invitees.length > 1 ? (
              'Start group'
            ) : (
              'Start chat'
            )}
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
    borderRadius: 2,
    padding: 26,
    boxShadow: '0 30px 60px -20px rgba(20,30,60,0.35)',
  },
  title: {margin: '0 0 6px', fontSize: 20, color: colors.text},
  subtitle: {margin: '0 0 18px', fontSize: 14, color: colors.textSecondary},
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 15,
    color: colors.text,
  },
  addRow: {display: 'flex', gap: 8},
  invite: {width: '100%', padding: '12px 0', marginBottom: 16, minHeight: 44},
  add: {padding: '10px 16px', borderRadius: 2, whiteSpace: 'nowrap'},
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    listStyle: 'none',
    padding: 0,
    margin: '12px 0 0',
  },
  chip: {
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 600,
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
