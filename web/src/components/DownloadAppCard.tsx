import {colors} from '../theme';
import {useT} from '../i18n';
import {useToast} from '../context/ToastContext';
import {useInstallPrompt} from '../hooks/useInstallPrompt';
import {
  DOWNLOAD_URLS,
  PLATFORM_NAME,
  detectPlatform,
  isConfigured,
  type DownloadPlatform,
} from '../services/downloads';
import Icon from './Icon';

const ALL: DownloadPlatform[] = ['ios', 'android', 'macos'];

export default function DownloadAppCard() {
  const {t} = useT();
  const toast = useToast();
  const {canInstall, installed, promptInstall} = useInstallPrompt();
  const detected = detectPlatform();
  // Detected platform first, the rest after.
  const ordered = detected ? [detected, ...ALL.filter(p => p !== detected)] : ALL;

  // macOS ships as the installable web app (PWA), not a native build — the RN
  // macOS target can't run Firebase. iOS/Android link to their native stores.
  const installMac = async () => {
    if (installed) {
      toast.show(t('download.installed'));
      return;
    }
    const res = await promptInstall();
    // Safari (and browsers without the install event) can't be prompted
    // programmatically — guide the user to the manual install instead.
    if (res === 'unavailable') toast.show(t('download.installHint'));
  };

  const activate = (p: DownloadPlatform) => {
    if (p === 'macos') return installMac();
    if (!isConfigured(p)) {
      toast.show(t('download.comingSoon'));
      return;
    }
    window.open(DOWNLOAD_URLS[p], '_blank', 'noopener');
  };

  const label = (p: DownloadPlatform) =>
    p === 'macos' ? (installed ? t('download.installed') : t('download.installMac')) : `${t('download.cta')} ${PLATFORM_NAME[p]}`;

  return (
    <section style={styles.card}>
      <div style={styles.cardTitle}>{t('download.title')}</div>
      <div style={styles.cardDesc}>{t('download.desc')}</div>

      {/* Primary CTA for the detected platform (desktop non-Mac shows none). */}
      {detected && (
        <button style={styles.primary} onClick={() => activate(detected)}>
          <Icon name={detected === 'macos' ? 'plus' : 'download'} size={16} style={{marginRight: 8, verticalAlign: '-3px'}} />
          {label(detected)}
        </button>
      )}

      <div style={styles.otherLabel}>{detected ? t('download.other') : t('download.choose')}</div>
      <div style={styles.row}>
        {ordered.filter(p => p !== detected).map(p => (
          <button key={p} style={styles.chip} onClick={() => activate(p)}>
            <Icon name={p === 'macos' ? 'plus' : 'download'} size={14} style={{marginRight: 6, verticalAlign: '-2px'}} />
            {p === 'macos' ? t('download.macApp') : PLATFORM_NAME[p]}
          </button>
        ))}
      </div>

      {/* On Mac desktop, always surface the manual-install hint for Safari. */}
      {detected === 'macos' && !installed && !canInstall && (
        <div style={styles.hint}>{t('download.installHint')}</div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardTitle: {fontSize: 15, fontWeight: 700, color: colors.text},
  cardDesc: {fontSize: 13.5, color: colors.textSecondary, lineHeight: 1.5},
  primary: {
    alignSelf: 'flex-start',
    marginTop: 4,
    padding: '11px 20px',
    borderRadius: 999,
    border: 'none',
    background: colors.primary,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  otherLabel: {fontSize: 12, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6},
  row: {display: 'flex', flexWrap: 'wrap', gap: 8},
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  hint: {fontSize: 12.5, color: colors.textTertiary, lineHeight: 1.5, marginTop: 4},
};
