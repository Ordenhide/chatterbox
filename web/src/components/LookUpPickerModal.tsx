import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';

/**
 * Asks which of several names to look up.
 *
 * Only appears when a message yields more than one candidate. The extraction
 * is a regex over capitalised words and is wrong often enough that picking for
 * the reader would open an article about the wrong thing.
 *
 * Nothing is fetched from here or from the caller: choosing opens Wikipedia in
 * a new tab, so what reaches Wikipedia is a visit the reader made.
 */
export default function LookUpPickerModal({
  names,
  onClose,
  onChoose,
}: {
  names: string[];
  onClose: () => void;
  onChoose: (name: string) => void;
}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLDivElement>(onClose);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('chat.lookUp')}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <h2 style={styles.title}>{t('chat.lookUp')}</h2>
        <p style={styles.subtitle}>{t('chat.lookUpPick')}</p>
        <div style={styles.options}>
          {names.map(name => (
            <button
              key={name}
              type="button"
              className="btn btn-primary"
              style={styles.option}
              onClick={() => onChoose(name)}>
              {name}
            </button>
          ))}
        </div>
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
    background: 'rgba(10,15,30,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    background: colors.surfaceStrong,
    borderRadius: 2,
    padding: 26,
    boxShadow: '0 30px 60px -20px rgba(20,30,60,0.35)',
  },
  title: {margin: '0 0 6px', fontSize: 20, color: colors.text},
  subtitle: {margin: '0 0 18px', fontSize: 14, color: colors.textSecondary},
  options: {display: 'flex', flexDirection: 'column', gap: 10},
  option: {width: '100%', padding: '12px', borderRadius: 2, fontSize: 14.5},
  cancel: {
    width: '100%',
    marginTop: 14,
    padding: '10px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    fontWeight: 600,
  },
};
