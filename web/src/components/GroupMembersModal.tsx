import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {addChatMembers, getUserById, getUserByEmail, GroupFullError, leaveChat} from '../services/chat';
import {MAX_GROUP_MEMBERS} from '../services/e2ee';
import Icon from './Icon';

/**
 * Who is in this chat, and the two membership changes the security rules allow:
 * adding someone, and leaving yourself.
 *
 * Removing *other* people is deliberately absent rather than unimplemented —
 * firestore.rules rejects it. There are no admin roles yet, so the only
 * available policy would be "anyone may remove anyone", which invites kick-wars
 * and lets one member quietly cut everyone else out of a conversation.
 *
 * The member list is also the access-control list for the encryption: senders
 * seal one copy per uid listed here (see sealForRecipients), so this panel is
 * showing exactly who can read what gets sent next.
 */
export default function GroupMembersModal({
  chatId,
  myUid,
  participants,
  onClose,
  onLeft,
}: {
  chatId: string;
  myUid: string;
  participants: string[];
  onClose: () => void;
  onLeft: () => void;
}) {
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [names, setNames] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>(participants);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      members.map(async uid => [uid, await getUserById(uid).catch(() => null)] as const),
    ).then(pairs => {
      if (cancelled) return;
      setNames(
        Object.fromEntries(
          pairs.map(([uid, profile]) => [
            uid,
            profile?.displayName || profile?.email || uid.slice(0, 6),
          ]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [members]);

  const add = async () => {
    const target = email.trim().toLowerCase();
    if (!target) return;
    setError(null);
    setBusy(true);
    try {
      const person = await getUserByEmail(target);
      if (!person) {
        setError('No Chatterbox user found with that email.');
        return;
      }
      if (members.includes(person.uid)) {
        setError('That person is already in this chat.');
        return;
      }
      await addChatMembers(chatId, [person.uid]);
      setMembers(prev => [...prev, person.uid]);
      setEmail('');
    } catch (err) {
      setError(
        err instanceof GroupFullError
          ? `A chat can hold at most ${MAX_GROUP_MEMBERS} people.`
          : 'Could not add that person. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!window.confirm('Leave this chat? You will stop receiving new messages.')) return;
    setBusy(true);
    try {
      await leaveChat(chatId, myUid);
      onLeft();
    } catch {
      setError('Could not leave the chat. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chat members"
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <div style={styles.title}>Members ({members.length})</div>
          <button style={styles.close} onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <ul style={styles.list}>
          {members.map(uid => (
            <li key={uid} style={styles.member}>
              {names[uid] || uid.slice(0, 6)}
              {uid === myUid && <span style={styles.you}> (you)</span>}
            </li>
          ))}
        </ul>

        <div style={styles.addRow}>
          <input
            style={styles.input}
            placeholder="Add by email"
            aria-label="Add member by email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-soft"
            style={styles.add}
            onClick={add}
            disabled={busy || !email.trim()}>
            Add
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button type="button" className="btn" style={styles.leave} onClick={leave} disabled={busy}>
          Leave chat
        </button>
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
    maxWidth: 380,
    maxHeight: 'min(80vh, 640px)',
    overflowY: 'auto',
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 18,
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
  list: {listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6},
  member: {fontSize: 14.5, color: colors.text, padding: '6px 0'},
  you: {color: colors.textSecondary},
  addRow: {display: 'flex', gap: 8},
  input: {
    flex: 1,
    minWidth: 0,
    padding: '10px 14px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 14,
    color: colors.text,
  },
  add: {padding: '10px 16px', borderRadius: 12, whiteSpace: 'nowrap'},
  error: {color: colors.danger, fontSize: 13},
  leave: {
    width: '100%',
    padding: '11px',
    borderRadius: 12,
    border: `1px solid ${colors.danger}`,
    background: 'transparent',
    color: colors.danger,
    fontWeight: 700,
    fontSize: 14.5,
  },
};
