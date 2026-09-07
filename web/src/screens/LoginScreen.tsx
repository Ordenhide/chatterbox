import {useMemo, useState} from 'react';
import {colors} from '../theme';
import {useT, type TKey} from '../i18n';
import {useToast} from '../context/ToastContext';
import BrandMark from '../components/BrandMark';
import Cascade from '../components/Cascade';
import {createAccount, signInWithPhrase, UnrecognizedPhraseError} from '../services/auth';
import {newAccountSeed, seedToPhrase} from '../services/anonymousIdentity';
import {secureRandomBytes} from '../services/crypto';

const CONFIRM_WORDS = 3;

/**
 * Picks which words the user is asked to type back.
 *
 * From the CSPRNG rather than Math.random — not because an attacker cares
 * which three words are asked for, but because a screen that handles a
 * recovery phrase must not be the one place in the app with a weak random
 * source in it for someone to copy.
 *
 * The modulo below is biased toward the low indices (256 is not a multiple of
 * 24) and that is fine: this picks which words to ask about, not any part of
 * the key. It loops until it has three distinct indices, which terminates
 * because the phrase is always far longer than the number asked for.
 */
function pickConfirmIndices(count: number, total: number): number[] {
  const chosen = new Set<number>();
  while (chosen.size < count) {
    chosen.add(secureRandomBytes(1)[0] % total);
  }
  return [...chosen].sort((a, b) => a - b);
}

/**
 * Signing in is typing a recovery phrase; signing up is being handed one.
 *
 * There is no email field, no password field and no third-party button,
 * because the account has none of those: the 24 words are the whole
 * credential, and the key they encode is adopted in the same step (see
 * services/auth.ts). Nothing is created until the confirmation step passes —
 * the phrase *is* the account, there is no reset and nobody to ask, so an
 * account created before its phrase was written down is one already lost.
 */
export default function LoginScreen({displaced = false}: {displaced?: boolean}) {
  const {t} = useT();
  const toast = useToast();
  const [mode, setMode] = useState<'signin' | 'show' | 'confirm'>('signin');
  const [phrase, setPhrase] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Generated once per visit to this screen. Switching back to sign-in and
  // starting again hands out a different phrase rather than resurrecting one
  // that has already been on screen.
  const seed = useMemo(() => newAccountSeed(), []);
  const newPhrase = useMemo(() => seedToPhrase(seed), [seed]);
  const words = useMemo(() => newPhrase.split(' '), [newPhrase]);
  const confirmIndices = useMemo(() => pickConfirmIndices(CONFIRM_WORDS, words.length), [words]);
  const confirmed = confirmIndices.every(
    i => (typed[i] ?? '').trim().toLowerCase() === words[i],
  );

  const copyPhrase = async () => {
    try {
      await navigator.clipboard.writeText(newPhrase);
      toast.success(t('login.phraseCopied'));
    } catch {
      // Clipboard access can be refused outright (insecure context, or a
      // permission the user declined). The words are on screen either way,
      // which is the copy that actually matters.
      setError(t('common.error'));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'show') {
      setMode('confirm');
      return;
    }
    if (mode === 'confirm' && !confirmed) {
      setError(t('login.confirmWrong'));
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithPhrase(phrase);
      } else {
        await createAccount(newPhrase, displayName.trim() || undefined);
      }
      // onAuthStateChanged in App will swap the view.
    } catch (err) {
      setError(friendlyError(err, t));
      setBusy(false);
    }
  };

  const title =
    mode === 'signin'
      ? t('login.signInToContinue')
      : mode === 'show'
        ? t('login.newTitle')
        : t('login.confirmTitle');
  const subtitle =
    mode === 'signin'
      ? t('login.phraseBody')
      : mode === 'show'
        ? t('login.newBody')
        : t('login.confirmBody');

  return (
    <div style={styles.container} role="main">
      <form onSubmit={submit} style={styles.card}>
        <Cascade index={0}>
          <div style={{display: 'flex', justifyContent: 'center', marginBottom: 18}}>
            <BrandMark size={56} />
          </div>
          <h1 style={styles.title}>Chatterbox</h1>
          <p style={styles.subtitle}>{mode === 'signin' ? title : subtitle}</p>
          {mode !== 'signin' && <p style={styles.stepTitle}>{title}</p>}
        </Cascade>

        <Cascade index={1}>
          {mode === 'signin' && (
            <textarea
              style={{...styles.input, ...styles.phraseInput}}
              placeholder={t('login.phrasePlaceholder')}
              aria-label={t('login.phrasePlaceholder')}
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              rows={4}
              // The phrase is the entire account: keep it out of autofill and
              // out of the browser's spellcheck service, which uploads text.
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
          )}

          {mode === 'show' && (
            <>
              <ol style={styles.grid}>
                {words.map((word, index) => (
                  <li key={index} style={styles.wordCell}>
                    <span style={styles.wordIndex}>{index + 1}</span>
                    <span style={styles.word}>{word}</span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="btn"
                style={styles.secondaryBtn}
                onClick={copyPhrase}>
                {t('login.copyPhrase')}
              </button>
            </>
          )}

          {mode === 'confirm' && (
            <>
              {confirmIndices.map(index => (
                <label key={index} style={styles.field}>
                  <span style={styles.fieldLabel}>{t('login.wordN', {n: index + 1})}</span>
                  <input
                    style={styles.input}
                    value={typed[index] ?? ''}
                    onChange={e => setTyped(prev => ({...prev, [index]: e.target.value}))}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>
              ))}
              <input
                style={styles.input}
                placeholder={t('login.displayName')}
                aria-label={t('login.displayName')}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </>
          )}

          {/* Explains an involuntary sign-out, so being kicked out mid-session
              doesn't look like a bug or an expired login. */}
          {displaced && !error && <div style={styles.notice}>{t('login.displaced')}</div>}
          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={styles.primaryBtn}
            disabled={busy || (mode === 'confirm' && !confirmed)}>
            {busy ? (
              <span className="spinner" />
            ) : mode === 'signin' ? (
              t('login.signIn')
            ) : mode === 'show' ? (
              t('login.writtenDown')
            ) : (
              t('login.createAccountBtn')
            )}
          </button>

          <div style={styles.switchRow}>
            {mode === 'signin' ? (
              <>
                {t('login.needAccount')}{' '}
                <button
                  type="button"
                  style={styles.link}
                  onClick={() => {
                    setError(null);
                    setMode('show');
                  }}
                  disabled={busy}>
                  {t('login.createOne')}
                </button>
              </>
            ) : mode === 'confirm' ? (
              <button
                type="button"
                style={styles.link}
                onClick={() => {
                  setError(null);
                  setMode('show');
                }}
                disabled={busy}>
                {t('login.showPhraseAgain')}
              </button>
            ) : (
              <>
                {t('login.haveAccount')}{' '}
                <button
                  type="button"
                  style={styles.link}
                  onClick={() => {
                    setError(null);
                    setMode('signin');
                  }}
                  disabled={busy}>
                  {t('login.signIn')}
                </button>
              </>
            )}
          </div>
        </Cascade>
      </form>
    </div>
  );
}

function friendlyError(err: unknown, t: (key: TKey) => string): string {
  if (err instanceof UnrecognizedPhraseError) {
    return t('login.phraseNotRecognized');
  }
  const code = (err as {code?: string})?.code || '';
  // Every credential failure means the same thing here, because both halves of
  // the credential come from the same 24 words: those words do not open an
  // account on this server.
  const noAccount = new Set([
    'auth/invalid-credential',
    'auth/invalid-login-credentials',
    'auth/user-not-found',
    'auth/wrong-password',
  ]);
  if (noAccount.has(code)) return t('login.noAccountForPhrase');
  if (code === 'auth/too-many-requests') return 'Too many attempts. Try again later.';
  return t('common.error');
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: colors.surfaceStrong,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    padding: 32,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 30px 60px -30px rgba(20,30,60,0.25)',
  },
  title: {
    fontFamily: 'var(--cb-display)',
    fontSize: 34,
    fontWeight: 700,
    letterSpacing: '-0.5px',
    textAlign: 'center',
    margin: '0 0 6px',
    color: colors.text,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textSecondary,
    margin: '0 0 16px',
    fontSize: 14,
    lineHeight: 1.5,
  },
  stepTitle: {
    textAlign: 'center',
    color: colors.text,
    fontWeight: 700,
    margin: '0 0 18px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 16px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 15,
    marginBottom: 12,
    color: colors.text,
  },
  phraseInput: {
    fontFamily: 'var(--cb-mono)',
    lineHeight: 1.6,
    resize: 'vertical',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px 16px',
    listStyle: 'none',
    margin: '0 0 16px',
    padding: 0,
  },
  wordCell: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  wordIndex: {
    fontFamily: 'var(--cb-mono)',
    fontSize: 11,
    color: colors.textTertiary,
    // Fixed width so the words stay in a column instead of stepping right by
    // a character once the numbering reaches double digits.
    width: 18,
    textAlign: 'right',
    flex: '0 0 auto',
  },
  word: {
    fontFamily: 'var(--cb-mono)',
    fontSize: 14,
    color: colors.text,
  },
  field: {
    display: 'block',
  },
  fieldLabel: {
    display: 'block',
    fontFamily: 'var(--cb-mono)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: colors.textTertiary,
    marginBottom: 6,
  },
  primaryBtn: {
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 6,
    padding: '13px 16px',
    borderRadius: 2,
    fontSize: 16,
    minHeight: 50,
  },
  secondaryBtn: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 16px',
    borderRadius: 2,
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  switchRow: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSecondary,
  },
  link: {
    background: 'none',
    border: 'none',
    color: colors.primary,
    fontWeight: 700,
    fontSize: 14,
    padding: 0,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  // Informational, not a failure — this sign-out was the system working.
  notice: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 10,
    padding: '8px 12px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    textAlign: 'center',
  },
};
