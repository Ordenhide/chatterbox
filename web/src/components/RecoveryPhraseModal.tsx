import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useToast} from '../context/ToastContext';
import Icon from './Icon';
import {
  getRecoveryPhrase,
  markRecoveryPhraseRevealed,
  restoreDeviceKeypairFromPhrase,
  type RestoreKeypairResult,
} from '../services/e2eeKeys';
import {useT} from '../i18n';

type Mode = 'reveal' | 'restore';

/**
 * Shows this account's E2EE recovery phrase, and takes one back to restore
 * decryption in a fresh browser profile.
 *
 * The web client shipped without this for a long time while mobile had it,
 * which meant clearing site data — a routine one-click action a browser will
 * also do on its own under storage pressure — silently and permanently
 * destroyed every encrypted message the account could read. The secret key
 * exists nowhere else by design, so there was no recovery path at all.
 *
 * Deliberately not auto-opened: revealing a secret has to be something the
 * user chose to do, on a screen they can see is theirs.
 */
export default function RecoveryPhraseModal({
  uid,
  onClose,
}: {
  uid: string;
  onClose: () => void;
}) {
  const {t} = useT();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('reveal');
  const [phrase, setPhrase] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Loaded up front but kept blurred until the user asks: the phrase is worth
  // exactly as much as the account, so it should never be sitting in a
  // screenshot or on a shared screen by accident.
  useEffect(() => {
    let cancelled = false;
    getRecoveryPhrase(uid)
      .then(p => {
        if (!cancelled) setPhrase(p);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const reveal = () => {
    setRevealed(true);
    // Records that this account has been offered its phrase, so the app stops
    // nagging. Local-only — it never gates whether the phrase can be shown again.
    markRecoveryPhraseRevealed(uid);
  };

  const copy = async () => {
    if (!phrase) return;
    try {
      await navigator.clipboard.writeText(phrase);
      toast.success('Recovery phrase copied');
    } catch {
      toast.error('Could not copy — select the words and copy manually');
    }
  };

  const restoreErrorMessage = (result: Extract<RestoreKeypairResult, {success: false}>) => {
    switch (result.reason) {
      case 'invalid-phrase':
        return t('recovery.errInvalid');
      case 'key-mismatch':
        return t('recovery.errMismatch');
      case 'verification-unavailable':
        return t('recovery.errUnverifiable');
      case 'publish-failed':
        return t('recovery.errPublishFailed');
    }
  };

  const submitRestore = async () => {
    setBusy(true);
    setRestoreError(null);
    try {
      const result = await restoreDeviceKeypairFromPhrase(uid, input);
      if (result.success) {
        toast.success('Recovery phrase restored — reloading');
        // A reload is the honest way to apply this: decrypted message caches
        // are spread across mounted views, and getKeyGeneration only prompts
        // the ones actively watching it. Starting clean guarantees every view
        // reads through the restored key.
        setTimeout(() => window.location.reload(), 600);
        return;
      }
      setRestoreError(restoreErrorMessage(result));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={busy ? undefined : onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <div style={styles.title}>{t('recovery.title')}</div>
          <button style={styles.close} onClick={onClose} disabled={busy} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={styles.tabs}>
          {(['reveal', 'restore'] as Mode[]).map(m => (
            <button
              key={m}
              className="btn"
              style={{...styles.tab, ...(mode === m ? styles.tabOn : styles.tabOff)}}
              onClick={() => setMode(m)}>
              {m === 'reveal' ? t('recovery.showMine') : t('recovery.restore')}
            </button>
          ))}
        </div>

        {mode === 'reveal' ? (
          <>
            <div style={styles.warnBox}>{t('recovery.warn')}</div>

            {loadError ? (
              <div style={styles.error}>{t('recovery.loadFailed')}</div>
            ) : !phrase ? (
              <div style={styles.muted}>{t('recovery.loading')}</div>
            ) : (
              <>
                <div
                  style={{
                    ...styles.phraseBox,
                    ...(revealed ? null : styles.phraseHidden),
                  }}>
                  {phrase}
                </div>
                {revealed ? (
                  <button className="btn btn-soft" style={styles.action} onClick={copy}>
                    {t('recovery.copy')}
                  </button>
                ) : (
                  <button className="btn btn-primary" style={styles.action} onClick={reveal}>
                    {t('recovery.reveal')}
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div style={styles.muted}>{t('recovery.restoreIntro')}</div>
            <textarea
              style={styles.input}
              rows={4}
              placeholder={t('recovery.phrasePlaceholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
            {restoreError && <div style={styles.error}>{restoreError}</div>}
            <button
              className="btn btn-primary"
              style={styles.action}
              disabled={busy || !input.trim()}
              onClick={submitRestore}>
              {busy ? <span className="spinner" /> : t('recovery.restore')}
            </button>
          </>
        )}
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
  tabs: {display: 'flex', gap: 8},
  tab: {flex: 1, padding: '9px 0', borderRadius: 2, fontSize: 14},
  tabOn: {background: colors.primary, color: colors.textOnPrimary},
  tabOff: {background: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.border}`},
  // Danger-bordered on purpose: losing these words is irreversible data loss,
  // which is the same severity class as the delete-account dialog.
  warnBox: {
    border: `1px solid ${colors.danger}`,
    borderRadius: 2,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.5,
    color: colors.textSecondary,
  },
  phraseBox: {
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 14,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 14,
    lineHeight: 1.7,
    color: colors.text,
    wordSpacing: 4,
    userSelect: 'text',
  },
  // Blur rather than omit: the box keeps its size, so revealing doesn't make
  // the dialog jump, and it is obvious something is deliberately concealed.
  phraseHidden: {filter: 'blur(7px)', userSelect: 'none'},
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 14,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: colors.text,
    resize: 'vertical',
  },
  action: {width: '100%', padding: '12px', borderRadius: 2, fontSize: 14.5},
  muted: {fontSize: 13, lineHeight: 1.5, color: colors.textSecondary},
  error: {fontSize: 13, lineHeight: 1.5, color: colors.danger},
};
