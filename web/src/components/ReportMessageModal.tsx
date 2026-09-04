/**
 * Reporting someone else's message — the action that replaced "delete
 * anyone's message" when deletion became author-only.
 *
 * The disclosure notice is the reason this is a modal rather than a
 * `window.confirm`. Chat content is end-to-end encrypted, so the server holds
 * ciphertext it cannot read; for a report to be actionable it has to carry the
 * reporter's decrypted copy of the message. That takes one message out of the
 * encrypted conversation, and the user should read that in plain words before
 * it happens rather than discover it afterwards. The notice also says what is
 * *not* included, because "reporting" could otherwise be read as handing over
 * the whole conversation.
 */
import {useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {useToast} from '../context/ToastContext';
import {REPORT_REASONS, reportMessage, type ReportReason} from '../services/reports';
import Icon from './Icon';

const REASON_LABEL: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  threat: 'Threat or violence',
  'sexual-content': 'Sexual content',
  impersonation: 'Impersonation',
  other: 'Something else',
};

export default function ReportMessageModal({
  chatId,
  messageId,
  authorUid,
  content,
  me,
  onClose,
}: {
  chatId: string;
  messageId: string;
  authorUid: string;
  /** The reporter's decrypted copy, as rendered on screen. */
  content: string;
  me: {uid: string};
  onClose: () => void;
}) {
  const {t} = useT();
  const toast = useToast();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [includeContent, setIncludeContent] = useState(true);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await reportMessage({
        chatId,
        messageId,
        authorUid,
        reporterUid: me.uid,
        reason,
        ...(includeContent && content ? {content} : null),
      });
      toast.success('Report sent');
      onClose();
    } catch {
      toast.error(t('common.error'));
      setSending(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Report message"
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <div style={styles.title}>
            <Icon name="alertTriangle" size={16} /> Report message
          </div>
          <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={15} />
          </button>
        </div>

        <div style={styles.section}>
          <div style={styles.label}>Why are you reporting this?</div>
          <div style={styles.reasons}>
            {REPORT_REASONS.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                style={{
                  ...styles.reason,
                  ...(reason === r ? styles.reasonActive : null),
                }}>
                {REASON_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {content ? (
          <label style={styles.disclosure}>
            <input
              type="checkbox"
              checked={includeContent}
              onChange={e => setIncludeContent(e.target.checked)}
            />
            <span>
              Include this message's text in the report. It is sent to the moderators so they
              can act on it — the rest of this conversation stays encrypted and is not
              included. Without it, the report may not be actionable.
            </span>
          </label>
        ) : null}

        <div style={styles.actions}>
          <button style={styles.cancel} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button style={styles.submit} onClick={submit} disabled={sending}>
            {sending ? '…' : 'Send report'}
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
    maxWidth: 440,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
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
  section: {display: 'flex', flexDirection: 'column', gap: 8},
  label: {fontSize: 13, fontWeight: 600, color: colors.textSecondary},
  reasons: {display: 'flex', flexWrap: 'wrap', gap: 8},
  reason: {
    padding: '7px 12px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    fontSize: 13,
  },
  reasonActive: {
    background: colors.primary,
    borderColor: colors.primary,
    color: colors.textOnPrimary,
    fontWeight: 600,
  },
  disclosure: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    fontSize: 12,
    lineHeight: 1.5,
    color: colors.textSecondary,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 10,
  },
  actions: {display: 'flex', justifyContent: 'flex-end', gap: 8},
  cancel: {
    padding: '9px 14px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    fontSize: 14,
  },
  submit: {
    padding: '9px 14px',
    borderRadius: 2,
    border: 'none',
    background: colors.danger,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
  },
};
