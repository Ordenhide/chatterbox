import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';

/**
 * Shown when someone reaches a Pro-only feature without a subscription.
 *
 * It explains what's behind the lock and hands off to the Store rather than
 * starting checkout inline: every purchase in the app goes through that one
 * screen, so there's a single place where plans and prices are stated.
 */
export default function ProUpsellModal({onClose}: {onClose: () => void}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLDivElement>(onClose);

  const openStore = () => {
    window.location.hash = '#/store';
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('pro.title')}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <span style={styles.badge}>{t('pro.badge')}</span>
        <h2 style={styles.title}>{t('pro.title')}</h2>
        <p style={styles.subtitle}>{t('pro.lockedAi')}</p>

        <ul style={styles.list}>
          <li>{t('pro.featureAi')}</li>
        </ul>

        <button type="button" className="btn btn-primary" style={styles.primary} onClick={openStore}>
          {t('store.openStore')}
        </button>
        <button type="button" style={styles.cancel} onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,15,30,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    background: colors.surfaceStrong,
    borderRadius: 2,
    padding: 26,
    boxShadow: '0 30px 60px -20px rgba(20,30,60,0.4)',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 9px',
    borderRadius: 999,
    background: colors.primary,
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.4px',
  },
  title: {margin: '10px 0 6px', fontSize: 21, color: colors.text},
  subtitle: {margin: '0 0 14px', fontSize: 14, color: colors.textSecondary, lineHeight: 1.5},
  list: {
    margin: '0 0 18px',
    paddingLeft: 18,
    fontSize: 13.5,
    color: colors.text,
    lineHeight: 1.8,
  },
  error: {color: colors.danger, fontSize: 13, marginBottom: 10},
  primary: {width: '100%', padding: '12px', borderRadius: 2, fontSize: 14.5},
  secondary: {width: '100%', padding: '12px', borderRadius: 2, fontSize: 14.5, marginTop: 8},
  cancel: {
    width: '100%',
    marginTop: 12,
    padding: '8px',
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 13.5,
    cursor: 'pointer',
  },
};
