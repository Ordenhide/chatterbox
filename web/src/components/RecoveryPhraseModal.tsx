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
        return 'That is not a valid 24-word recovery phrase. Check for typos or missing words.';
      case 'key-mismatch':
        return 'That phrase belongs to a different account, so it would not decrypt anything here. Nothing was changed.';
      case 'verification-unavailable':
        return 'Could not reach the server to check the phrase, so nothing was changed. Try again when you are back online.';
      case 'publish-failed':
        return 'The phrase was correct, but saving it failed. Nothing was changed — please try again.';
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
          <div style={styles.title}>Recovery phrase</div>
          <button style={styles.close} onClick={onClose} disabled={busy} aria-label="Close">
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
              {m === 'reveal' ? 'Show mine' : 'Restore'}
            </button>
          ))}
        </div>

        {mode === 'reveal' ? (
          <>
            <div style={styles.warnBox}>
              These 24 words are the only way to read your encrypted messages again if you
              clear this browser's data. They are never uploaded — if you lose them, that
              history is gone permanently. Write them down and keep them somewhere private.
            </div>

            {loadError ? (
              <div style={styles.error}>Could not load your recovery phrase. Please try again.</div>
            ) : !phrase ? (
              <div style={styles.muted}>Loading…</div>
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
                    Copy to clipboard
                  </button>
                ) : (
                  <button className="btn btn-primary" style={styles.action} onClick={reveal}>
                    Reveal phrase
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div style={styles.muted}>
              Enter the 24-word phrase from your other device to read this account's
              encrypted history here. Your current key is only replaced once the phrase
              checks out.
            </div>
            <textarea
              style={styles.input}
              rows={4}
              placeholder="word word word …"
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
              {busy ? <span className="spinner" /> : 'Restore'}
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
    borderRadius: 20,
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
  tab: {flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 14},
  tabOn: {background: colors.primary, color: '#fff'},
  tabOff: {background: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.border}`},
  // Danger-bordered on purpose: losing these words is irreversible data loss,
  // which is the same severity class as the delete-account dialog.
  warnBox: {
    border: `1px solid ${colors.danger}`,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.5,
    color: colors.textSecondary,
  },
  phraseBox: {
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
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
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 14,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: colors.text,
    resize: 'vertical',
  },
  action: {width: '100%', padding: '12px', borderRadius: 12, fontSize: 14.5},
  muted: {fontSize: 13, lineHeight: 1.5, color: colors.textSecondary},
  error: {fontSize: 13, lineHeight: 1.5, color: colors.danger},
};
