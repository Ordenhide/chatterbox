/**
 * Starting a conversation, without a directory to search.
 *
 * This dialog used to take an email address, which worked because `users` held
 * a plaintext indexed email that any signed-in client could query. Invite links
 * replaced that on the way in (services/invites.ts); what is left here is the
 * other thing that box did — getting several people into one group.
 *
 * Those people all already have a one-to-one chat with you, so their uids are
 * in documents this client already holds. Nothing is looked up. Mirrors
 * src/screens/chat/NewChatScreen.tsx on mobile.
 */
import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {createChat, listenChatsForUser, setChatName} from '../services/chat';
import {contactsFromChats, type Contact} from '../services/contacts';
import {MAX_GROUP_MEMBERS} from '../services/e2ee';
import type {ChatRoom} from '../types';

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
  const [chats, setChats] = useState<ChatRoom[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      listenChatsForUser(myUid, found => {
        setChats(found);
        setContacts(contactsFromChats(found, myUid));
      }),
    [myUid],
  );

  const toggle = (uid: string) => {
    setError(null);
    setSelected(prev => {
      if (prev.includes(uid)) return prev.filter(id => id !== uid);
      // You take one of the seats, so only cap-1 others fit.
      if (prev.length >= MAX_GROUP_MEMBERS - 1) {
        setError(`A chat can hold at most ${MAX_GROUP_MEMBERS} people.`);
        return prev;
      }
      return [...prev, uid];
    });
  };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) return;

    // One person means the chat that put them on this list. A second one would
    // split the history across two threads for no reason.
    if (selected.length === 1) {
      const existing = (chats || []).find(chat => {
        const p = chat.participants || [];
        return p.length === 2 && p.includes(myUid) && p.includes(selected[0]);
      });
      if (existing) return onCreated(existing.id);
    }

    setBusy(true);
    try {
      const picked = contacts.filter(c => selected.includes(c.uid));
      const title = name.trim() || picked.map(c => c.label).join(', ');
      const chatId = await createChat([myUid, ...selected], title);
      // Your own label for the group, kept in `nameBy` where it stays yours.
      if (name.trim()) await setChatName(chatId, myUid, name.trim());
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
        <p style={styles.subtitle}>
          Send someone an invite link, or put people you already talk to into a group.
        </p>

        <button type="button" className="btn btn-primary" style={styles.invite} onClick={onUseInvite}>
          Invite someone with a link
        </button>

        {chats === null ? (
          <p style={styles.subtitle}>Loading…</p>
        ) : contacts.length === 0 ? (
          <p style={styles.subtitle}>
            You don’t have any conversations yet. Send someone an invite link above to start one.
          </p>
        ) : (
          <>
            <p style={styles.subtitle}>
              Pick from the people you already have a chat with. There is nobody else to pick
              from — that is the point.
            </p>
            <ul style={styles.chips}>
              {contacts.map(contact => {
                const on = selected.includes(contact.uid);
                return (
                  <li key={contact.uid}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      style={{
                        ...styles.chip,
                        borderColor: on ? colors.primary : colors.border,
                        background: on ? colors.primary : colors.surface,
                        color: on ? colors.textOnPrimary : colors.text,
                      }}
                      onClick={() => toggle(contact.uid)}>
                      {contact.label}
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected.length > 1 && (
              <input
                style={styles.input}
                placeholder="Group name (optional)"
                aria-label="Group name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            )}
          </>
        )}

        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.actions}>
          <button type="button" style={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={styles.start}
            disabled={busy || selected.length === 0}>
            {busy ? <span className="spinner" /> : selected.length > 1 ? 'Start group' : 'Open chat'}
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
    marginBottom: 4,
    padding: '12px 16px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 15,
    color: colors.text,
  },
  invite: {width: '100%', padding: '12px 0', margin: '0 0 18px', minHeight: 44},
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    listStyle: 'none',
    padding: 0,
    margin: '0 0 16px',
  },
  chip: {
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: '8px 14px',
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
