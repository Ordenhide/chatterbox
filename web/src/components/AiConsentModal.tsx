/**
 * The disclosure shown before any AI feature is used for the first time.
 *
 * Deliberately blunt: this is the one place the app's end-to-end encryption is
 * opened on purpose, and a vague "we use AI to improve your experience" would
 * be worse than saying nothing. It names what is sent, where it goes, and what
 * stays protected.
 */
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {grantAiConsent} from '../services/aiConsent';
import Icon from './Icon';

export default function AiConsentModal({
  onAccept,
  onClose,
}: {
  onAccept: () => void;
  onClose: () => void;
}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLDivElement>(onClose);

  const accept = () => {
    grantAiConsent();
    onAccept();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('aiConsent.title')}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <span style={styles.badge}>
          <Icon name="sparkles" size={13} /> {t('aiConsent.badge')}
        </span>
        <h2 style={styles.title}>{t('aiConsent.title')}</h2>
        <p style={styles.lead}>{t('aiConsent.lead')}</p>

        <ul style={styles.list}>
          <li>{t('aiConsent.point1')}</li>
          <li>{t('aiConsent.point2')}</li>
          <li>{t('aiConsent.point3')}</li>
        </ul>

        <p style={styles.note}>{t('aiConsent.revoke')}</p>

        <button type="button" className="btn btn-primary" style={styles.primary} onClick={accept}>
          {t('aiConsent.accept')}
        </button>
        <button type="button" style={styles.cancel} onClick={onClose}>
          {t('aiConsent.decline')}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,15,30,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 50,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 26,
    boxShadow: '0 30px 60px -20px rgba(20,30,60,0.4)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    borderRadius: 999,
    background: colors.primaryLight,
    color: colors.primary,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.4,
  },
  title: {margin: '12px 0 8px', fontSize: 20, color: colors.text},
  lead: {margin: '0 0 14px', fontSize: 14, color: colors.text, lineHeight: 1.55},
  list: {
    margin: '0 0 14px',
    paddingInlineStart: 18,
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 1.75,
  },
  note: {margin: '0 0 18px', fontSize: 12.5, color: colors.textTertiary, lineHeight: 1.5},
  primary: {width: '100%', padding: 12, borderRadius: 2, fontSize: 14.5, fontWeight: 700},
  cancel: {
    width: '100%',
    marginTop: 10,
    padding: 8,
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 13.5,
    cursor: 'pointer',
  },
};
