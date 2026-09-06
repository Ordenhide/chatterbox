import {useEffect, useState} from 'react';
import {auth} from '../firebase';
import {colors} from '../theme';
import {useT} from '../i18n';
import {useModal} from '../hooks/useModal';
import {createChat, setChatIntroduction, setChatName} from '../services/chat';
import {getDeviceKeypairIfEnrolled} from '../services/e2eeKeys';
import {sealIntroduction} from '../services/introductions';
import {
  acceptInvite,
  createInvite,
  forgetInvite,
  inviteLink,
  inviteState,
  outstandingInvite,
  parseInviteLink,
  rememberInvite,
  revokeInvite,
  type Invite,
  type InviteState,
} from '../services/invites';

/**
 * Invite links, both directions. Mirrors src/screens/chat/InviteScreen.tsx on
 * mobile; see services/invites.ts for why a searchable directory had to go.
 *
 * The web half matters as much as the mobile one here. A privacy property that
 * only holds on one of a person's clients is not a property — and once email
 * lookup is removed, a browser with no way to start a conversation is a browser
 * that cannot be used.
 */

/** Whole hours left, rounded up, so "1h" never means four minutes. */
function hoursLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (60 * 60 * 1000)));
}

export default function InviteModal({
  myUid,
  onClose,
  onCreated,
}: {
  myUid: string;
  onClose: () => void;
  onCreated: (chatId: string) => void;
}) {
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const {t} = useT();
  const [invite, setInvite] = useState<Invite | null>(() => outstandingInvite());
  const [state, setState] = useState<InviteState>('pending');
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invite) return;
    let cancelled = false;
    // One read, to answer the question the dialog is opened to ask: did they
    // use it yet?
    inviteState(invite.token).then(current => {
      if (!cancelled) setState(current);
    });
    return () => {
      cancelled = true;
    };
  }, [invite]);

  const mint = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await createInvite(myUid);
      if (!result.ok) {
        setError(
          result.reason === 'not-enrolled'
            ? t('invite.notEnrolled')
            : t('invite.createFailed'),
        );
        return;
      }
      rememberInvite(result.invite);
      setInvite(result.invite);
      setState('pending');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!invite) return;
    await revokeInvite(invite.token);
    forgetInvite();
    setInvite(null);
  };

  const open = async () => {
    setError(null);
    const token = parseInviteLink(pasted);
    if (!token) {
      setError(t('invite.notALink'));
      return;
    }
    setBusy(true);
    try {
      const result = await acceptInvite(token, myUid);
      if (!result.ok) {
        setError(
          {
            'not-found': t('invite.errNotFound'),
            expired: t('invite.errExpired'),
            'already-used': t('invite.errUsed'),
            'own-invite': t('invite.errOwn'),
            failed: t('invite.errFailed'),
          }[result.reason],
        );
        return;
      }
      // The name is the accepter's own word for this person, kept in `nameBy`
      // where it stays theirs. The server is never told who the other side is.
      const chosen = label.trim();
      const chatId = await createChat([myUid, result.inviterUid], 'Chat');
      if (chosen) await setChatName(chatId, myUid, chosen);

      // The other half: they have no idea who just opened their link, and the
      // profile no longer carries a name to look up. So it is sealed to the key
      // the invite carried and left on the chat for them alone to read — see
      // services/introductions.ts.
      const myName = auth.currentUser?.displayName;
      if (myName) {
        const keypair = await getDeviceKeypairIfEnrolled(myUid);
        const sealed =
          keypair && sealIntroduction(myName, keypair.secretKey, result.inviterKey, chatId);
        if (sealed) await setChatIntroduction(chatId, myUid, sealed);
      }
      onCreated(chatId);
    } catch (err) {
      console.warn('accept invite failed:', err);
      setError(t('invite.errFailed'));
    } finally {
      setBusy(false);
    }
  };

  const link = invite ? inviteLink(invite.token) : '';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('invite.aria')}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <h2 style={styles.title}>{t('invite.yoursTitle')}</h2>
        {!invite ? (
          <>
            <p style={styles.subtitle}>
              {t('invite.yoursIntro')}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={styles.wide}
              onClick={mint}
              disabled={busy}>
              {busy ? <span className="spinner" /> : t('invite.create')}
            </button>
          </>
        ) : (
          <>
            {/* Selectable mono: it is a key, and people check it character by
                character against what they pasted. */}
            <code style={styles.link}>{link}</code>
            <p style={{...styles.meta, color: state === 'accepted' ? colors.primary : colors.textSecondary}}>
              {state === 'accepted'
                ? t('invite.stateAccepted')
                : state === 'gone'
                  ? t('invite.stateGone')
                  : t('invite.statePending', {hours: String(hoursLeft(invite.expiresAt))})}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={styles.wide}
              onClick={() => {
                navigator.clipboard
                  .writeText(link)
                  .then(() => setCopied(true))
                  .catch(() => setError(t('invite.copyFailed')));
              }}>
              {copied ? t('invite.copied') : t('invite.copy')}
            </button>
            <button type="button" style={styles.textButton} onClick={withdraw}>
              {t('invite.withdraw')}
            </button>
          </>
        )}

        <hr style={styles.rule} />

        <h2 style={styles.title}>{t('invite.openTitle')}</h2>
        <p style={styles.subtitle}>
          {t('invite.openIntro')}
        </p>
        <input
          style={styles.input}
          placeholder="chatterbox://invite#…"
          aria-label={t('invite.openTitle')}
          value={pasted}
          onChange={e => setPasted(e.target.value)}
        />
        <label style={styles.label} htmlFor="invite-name">
          {t('invite.nameLabel')}
        </label>
        <input
          id="invite-name"
          style={styles.input}
          placeholder={t('invite.namePlaceholder')}
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        <p style={styles.footnote}>
          {t('invite.nameHint')}
        </p>

        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.actions}>
          <button type="button" style={styles.cancel} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={styles.start}
            onClick={open}
            disabled={busy || !pasted.trim()}>
            {busy ? <span className="spinner" /> : t('invite.open')}
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
    background: 'rgba(10,15,30,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90vh',
    overflowY: 'auto',
    background: colors.surfaceStrong,
    borderRadius: 2,
    padding: 26,
    boxShadow: '0 30px 60px -20px rgba(20,30,60,0.35)',
  },
  title: {margin: '0 0 6px', fontSize: 20, color: colors.text},
  subtitle: {margin: '0 0 16px', fontSize: 14, lineHeight: 1.5, color: colors.textSecondary},
  link: {
    display: 'block',
    padding: 12,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    background: colors.inputBg,
    color: colors.text,
    fontSize: 12,
    wordBreak: 'break-all',
    userSelect: 'all',
  },
  meta: {margin: '10px 0 14px', fontSize: 12, letterSpacing: 1},
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  label: {
    display: 'block',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  footnote: {margin: '0 0 4px', fontSize: 12, lineHeight: 1.5, color: colors.textSecondary},
  rule: {border: 0, borderTop: `1px solid ${colors.border}`, margin: '22px 0'},
  wide: {width: '100%', padding: '12px 0', minHeight: 44},
  textButton: {
    display: 'block',
    width: '100%',
    marginTop: 10,
    padding: '10px 0',
    border: 0,
    background: 'transparent',
    color: colors.danger,
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
