import {colors} from '../theme';
import {useT} from '../i18n';
import {useModal} from '../hooks/useModal';
import {modifierLabel, SHORTCUT_HELP} from '../services/shortcuts';
import Icon from './Icon';

/**
 * The `?` overlay listing every binding.
 *
 * Shortcuts nobody can discover are shortcuts nobody uses, and a page of docs
 * is not discovery — the list has to be one keystroke away from wherever you
 * are. Keys render with the platform's own modifier symbol so a Mac user never
 * reads "Ctrl" for a chord they press with Cmd.
 */
export default function ShortcutsHelp({onClose}: {onClose: () => void}) {
  const {t} = useT();
  const ref = useModal<HTMLDivElement>(onClose);
  const mod = modifierLabel();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={ref}
        className="cb-modal-in"
        role="dialog"
        aria-modal="true"
        aria-label={t('shortcuts.title')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <h2 style={styles.title}>{t('shortcuts.title')}</h2>
          <button type="button" onClick={onClose} style={styles.close} aria-label={t('common.close')}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <ul style={styles.list}>
          {SHORTCUT_HELP.map(row => (
            <li key={row.i18nKey} style={styles.row}>
              <span style={styles.label}>{t(row.i18nKey as Parameters<typeof t>[0])}</span>
              <span style={styles.keys}>
                {row.keys(mod).map((k, i) => (
                  <kbd key={`${k}-${i}`} style={styles.kbd}>
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <p style={styles.foot}>{t('shortcuts.hint')}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,15,30,0.45)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 70,
  },
  modal: {
    width: 'min(520px, 100%)',
    maxHeight: 'min(80vh, 640px)',
    overflowY: 'auto',
    background: colors.menuSolid,
    border: `1px solid ${colors.border}`,
    borderRadius: 18,
    boxShadow: colors.shadow,
    padding: '20px 22px 18px',
  },
  head: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14},
  title: {margin: 0, fontSize: 17, fontWeight: 750, color: colors.text},
  close: {
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 1,
    padding: 6,
    borderRadius: 8,
  },
  list: {listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2},
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '9px 4px',
    borderBottom: `1px solid ${colors.border}`,
  },
  label: {fontSize: 14, color: colors.text},
  keys: {display: 'inline-flex', gap: 5, flexShrink: 0},
  kbd: {
    fontFamily: 'var(--cb-mono)',
    fontSize: 12,
    minWidth: 24,
    textAlign: 'center',
    padding: '3px 7px',
    borderRadius: 6,
    border: `1px solid ${colors.borderStrong}`,
    background: colors.surface,
    color: colors.textSecondary,
  },
  foot: {marginTop: 14, marginBottom: 0, fontSize: 12.5, color: colors.textTertiary},
};
