import {useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {deleteAccount, type AccountActionError} from '../services/account';
import Icon from './Icon';

/**
 * Confirmation flow for permanent account deletion.
 *
 * Deliberately harder to complete than a normal dialog: the action is
 * irreversible, cannot be undone by support (the data is genuinely gone, not
 * flagged), and a mis-click costs the user everything. So it requires typing
 * DELETE by hand, and spells out exactly what goes and what stays before that
 * field is reachable.
 *
 * It used to ask for the account password as well. There is no password now,
 * and the alternative — asking for the recovery phrase — would be asking for
 * a secret this browser is already holding; see reauthenticate in
 * services/account.ts.
 */
export default function DeleteAccountModal({onClose}: {onClose: () => void}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLFormElement>(onClose);
  const [confirmWord, setConfirmWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordMatches = confirmWord.trim().toUpperCase() === t('account.deleteConfirmWord');
  const canSubmit = wordMatches && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const report = await deleteAccount();
      // The account is gone at this point regardless. onAuthStateChanged will
      // drop the app back to the login screen on its own; surfacing a partial
      // failure matters because the user can no longer sign in to retry.
      if (report.errors.length > 0) {
        console.warn('account deleted with residual data:', report.errors);
        window.alert(t('account.deletePartial'));
      }
    } catch (err) {
      const reason = (err as {reason?: AccountActionError}).reason;
      setError(
        reason === 'no-device-key'
          ? t('account.deleteNoKey')
          : reason === 'too-many-requests'
          ? t('account.tooManyRequests')
          : t('account.deleteFailed'),
      );
      setBusy(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={busy ? undefined : onClose}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('account.deleteConfirmTitle')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}
        onSubmit={submit}>
        <div style={styles.head}>
          <span style={styles.title}>{t('account.deleteConfirmTitle')}</span>
          {!busy && (
            <button
              type="button"
              style={styles.close}
              onClick={onClose}
              aria-label={t('common.close')}>
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        <div style={styles.warnBox}>
          <div style={styles.warnTitle}>{t('account.deleteWhatHappens')}</div>
          <ul style={styles.list}>
            <li>{t('account.deleteBullet1')}</li>
            <li>{t('account.deleteBullet2')}</li>
            <li>{t('account.deleteBullet3')}</li>
          </ul>
          <div style={styles.keepsNote}>{t('account.deleteKeepsNote')}</div>
        </div>

        <label style={styles.label} htmlFor="delete-account-confirm-word">
          {t('account.deleteTypeToConfirm')}
        </label>
        <input
          id="delete-account-confirm-word"
          style={styles.input}
          value={confirmWord}
          onChange={e => setConfirmWord(e.target.value)}
          placeholder={t('account.deleteConfirmWord')}
          autoComplete="off"
          disabled={busy}
        />

        {error && <div style={styles.error}>{error}</div>}

        <button
          type="submit"
          style={{...styles.deleteBtn, opacity: canSubmit ? 1 : 0.5}}
          disabled={!canSubmit}>
          {busy ? t('account.deleting') : t('account.deleteAccount')}
        </button>
      </form>
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
    maxHeight: 'min(88vh, 760px)',
    overflowY: 'auto',
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: colors.shadow,
  },
  head: {display: 'flex', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: 17, fontWeight: 700, color: colors.danger},
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
  warnBox: {
    border: `1px solid ${colors.danger}`,
    borderRadius: 2,
    padding: '12px 14px',
    background: 'transparent',
  },
  warnTitle: {fontWeight: 700, fontSize: 13.5, color: colors.danger, marginBottom: 6},
  list: {margin: '0 0 8px', paddingLeft: 18, fontSize: 13.5, color: colors.text, lineHeight: 1.6},
  keepsNote: {fontSize: 12.5, color: colors.textSecondary, lineHeight: 1.5},
  label: {fontSize: 12.5, fontWeight: 700, color: colors.textSecondary, marginTop: 4},
  input: {
    padding: '11px 14px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 15,
    color: colors.text,
  },
  error: {color: colors.danger, fontSize: 13, marginTop: 2},
  deleteBtn: {
    marginTop: 8,
    padding: '13px',
    borderRadius: 2,
    border: 'none',
    background: colors.danger,
    color: colors.textOnDanger,
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },
};
