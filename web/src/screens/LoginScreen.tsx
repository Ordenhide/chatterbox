import {useEffect, useRef, useState} from 'react';
import {RecaptchaVerifier, type ConfirmationResult} from 'firebase/auth';
import {colors} from '../theme';
import {auth} from '../firebase';
import {useT} from '../i18n';
import {useToast} from '../context/ToastContext';
import BrandMark from '../components/BrandMark';
import Cascade from '../components/Cascade';
import PasswordInput from '../components/PasswordInput';
import {confirmPhoneCode, resetPassword, sendPhoneCode, signIn, signInWithGoogle, signUp} from '../services/auth';
import {checkPasswordStrength} from '../services/passwordPolicy';

/** Google's official "G" logomark — required as-is (not recolored to match
 * the app's monochrome icon set) by Google's Sign-In branding guidelines.
 * Twin of the one in the mobile client's SocialSignInButtons.tsx. */
function GoogleLogo() {
  return (
    <svg width={20} height={20} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container-login';

export default function LoginScreen({displaced = false}: {displaced?: boolean}) {
  const {t} = useT();
  const toast = useToast();
  const [mode, setMode] = useState<'signin' | 'signup' | 'phone'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The verifier is tied to the container div below, so it can only exist
  // while that div is mounted (mode === 'phone') — created after the div
  // commits, torn down the moment it doesn't apply anymore, so a widget never
  // outlives the DOM node it was rendered into.
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  useEffect(() => {
    if (mode !== 'phone') return;
    recaptchaRef.current = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {size: 'invisible'});
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, [mode]);

  const enterPhoneMode = () => {
    setError(null);
    setConfirmation(null);
    setCode('');
    setMode('phone');
  };
  const exitPhoneMode = () => {
    setError(null);
    setConfirmation(null);
    setCode('');
    setPhoneNumber('');
    setMode('signin');
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // onAuthStateChanged in App will swap the view.
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    if (!email.trim()) {
      setError(t('login.resetEnterEmail'));
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      toast.success(t('login.resetSent'));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    if (!recaptchaRef.current) return;
    setBusy(true);
    try {
      const result = await sendPhoneCode(phoneNumber.trim(), recaptchaRef.current);
      setConfirmation(result);
      setCode('');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'phone') {
      if (confirmation) {
        const trimmed = code.trim();
        if (trimmed.length !== 6) {
          setError(t('login.invalidCode'));
          return;
        }
        setBusy(true);
        try {
          await confirmPhoneCode(confirmation, trimmed);
          // onAuthStateChanged in App will swap the view.
        } catch (err) {
          setError(friendlyError(err));
          setBusy(false);
        }
        return;
      }
      const trimmed = phoneNumber.trim();
      if (!trimmed.startsWith('+') || trimmed.length < 8) {
        setError(t('login.invalidPhone'));
        return;
      }
      if (!recaptchaRef.current) return;
      setBusy(true);
      try {
        const result = await sendPhoneCode(trimmed, recaptchaRef.current);
        setConfirmation(result);
        setCode('');
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError(t('login.enterBoth'));
      return;
    }
    if (mode === 'signup') {
      const strength = checkPasswordStrength(password);
      if (strength !== 'ok') {
        setError(
          {
            'too-short': 'Password must be at least 8 characters.',
            'too-common': 'That password is too common — please choose a less predictable one.',
            'too-simple': 'That password is too predictable (repeated or sequential characters) — please choose another.',
          }[strength],
        );
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName.trim() || undefined);
      }
      // onAuthStateChanged in App will swap the view.
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <div style={styles.container} role="main">
      <form onSubmit={submit} style={styles.card}>
        <Cascade index={0}>
          <div style={{display: 'flex', justifyContent: 'center', marginBottom: 18}}>
            <BrandMark size={56} />
          </div>
          <h1 style={styles.title}>Chatterbox</h1>
          <p style={styles.subtitle}>
            {mode === 'phone'
              ? confirmation
                ? t('login.codeTitle')
                : t('login.phoneTitle')
              : mode === 'signin'
                ? t('login.signInToContinue')
                : t('login.createAccount')}
          </p>
        </Cascade>

        <Cascade index={1}>
          {mode === 'phone' ? (
            confirmation ? (
              <>
                <p style={styles.phoneNote}>
                  {t('login.codeSubtitlePrefix')} {phoneNumber.trim()}
                </p>
                <input
                  style={{...styles.input, ...styles.codeInput}}
                  placeholder={t('login.codePlaceholder')}
                  aria-label={t('login.codePlaceholder')}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                />
              </>
            ) : (
              <>
                <p style={styles.phoneNote}>{t('login.phoneSubtitle')}</p>
                <input
                  style={styles.input}
                  placeholder={t('login.phonePlaceholder')}
                  aria-label={t('login.phonePlaceholder')}
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  autoComplete="tel"
                  autoFocus
                />
              </>
            )
          ) : (
            <>
              {mode === 'signup' && (
                <input
                  style={styles.input}
                  placeholder={t('login.displayName')}
                  aria-label={t('login.displayName')}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              )}
              <input
                style={styles.input}
                placeholder={t('login.email')}
                aria-label={t('login.email')}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
              <PasswordInput
                style={styles.input}
                placeholder={t('login.password')}
                aria-label={t('login.password')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              {mode === 'signin' && (
                <button type="button" style={styles.forgotBtn} onClick={handleForgotPassword} disabled={busy}>
                  {t('login.forgotPassword')} <span style={styles.forgotBtnBold}>{t('login.reset')}</span>
                </button>
              )}
            </>
          )}

          {/* Explains an involuntary sign-out, so being kicked out mid-session
              doesn't look like a bug or an expired login. */}
          {displaced && !error && <div style={styles.notice}>{t('login.displaced')}</div>}
          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={styles.primaryBtn} disabled={busy}>
            {busy ? (
              <span className="spinner" />
            ) : mode === 'phone' ? (
              confirmation ? (
                t('login.verifyCode')
              ) : (
                t('login.sendCode')
              )
            ) : mode === 'signin' ? (
              t('login.signIn')
            ) : (
              t('login.signUp')
            )}
          </button>

          {mode === 'phone' &&
            (confirmation ? (
              <div style={styles.phoneLinkRow}>
                <button type="button" style={styles.link} onClick={handleResendCode} disabled={busy}>
                  {t('login.resendCode')}
                </button>
                <button
                  type="button"
                  style={styles.linkMuted}
                  onClick={() => {
                    setConfirmation(null);
                    setCode('');
                  }}
                  disabled={busy}>
                  {t('login.changeNumber')}
                </button>
              </div>
            ) : (
              <div style={styles.phoneLinkRow}>
                <button type="button" style={styles.linkMuted} onClick={exitPhoneMode} disabled={busy}>
                  {t('login.backToSignIn')}
                </button>
              </div>
            ))}
        </Cascade>

        {mode !== 'phone' && (
          <Cascade index={2}>
            <div style={styles.dividerRow}>
              <div style={styles.dividerLine} />
              <span style={styles.dividerText}>{t('login.orDivider')}</span>
              <div style={styles.dividerLine} />
            </div>
            <button
              type="button"
              className="btn btn-soft"
              style={styles.socialBtn}
              onClick={handleGoogle}
              disabled={busy}>
              <GoogleLogo />
              {t('login.google')}
            </button>
            <button
              type="button"
              className="btn btn-soft"
              style={styles.socialBtn}
              onClick={enterPhoneMode}
              disabled={busy}>
              {t('login.phone')}
            </button>
          </Cascade>
        )}

        {mode !== 'phone' && (
          <Cascade index={3}>
            <div style={styles.switchRow}>
              {mode === 'signin' ? t('login.noAccount') : t('login.haveAccount')}{' '}
              <button
                type="button"
                style={styles.link}
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                }}>
                {mode === 'signin' ? t('login.signUp') : t('login.signIn')}
              </button>
            </div>
          </Cascade>
        )}
      </form>

      {/* Invisible reCAPTCHA's own container — Firebase renders a floating
          badge elsewhere on screen when a challenge is actually needed, so
          this node itself never needs to be visible, only present in the DOM
          while phone sign-in is active (see the effect above). */}
      {mode === 'phone' && <div id={RECAPTCHA_CONTAINER_ID} style={styles.recaptchaContainer} />}
    </div>
  );
}

function friendlyError(err: unknown): string {
  const code = (err as {code?: string})?.code || '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/user-not-found': 'No account found for that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account already exists for that email.',
    'auth/weak-password': 'Password should be at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/popup-closed-by-user': 'Sign-in was closed before finishing.',
    'auth/cancelled-popup-request': 'Sign-in was closed before finishing.',
    'auth/account-exists-with-different-credential':
      'An account already exists for that email with a different sign-in method.',
    'auth/invalid-phone-number': 'That phone number looks invalid.',
    'auth/invalid-verification-code': 'That code is incorrect.',
    'auth/code-expired': 'That code has expired — request a new one.',
  };
  return map[code] || 'Something went wrong. Please try again.';
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
    maxWidth: 380,
    background: colors.surfaceStrong,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${colors.border}`,
    borderRadius: 24,
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
    margin: '0 0 24px',
  },
  input: {
    padding: '13px 16px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 15,
    marginBottom: 12,
    color: colors.text,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: '6px',
    fontWeight: 700,
  },
  phoneNote: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
    margin: '0 0 14px',
  },
  primaryBtn: {
    marginTop: 6,
    padding: '13px 16px',
    borderRadius: 14,
    fontSize: 16,
    minHeight: 50,
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    margin: '-4px 0 12px',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  forgotBtnBold: {
    color: colors.primary,
    fontWeight: 700,
  },
  phoneLinkRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 18,
    marginTop: 16,
  },
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '18px 0 14px',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  socialBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '13px 16px',
    fontSize: 15,
    marginBottom: 10,
    color: colors.text,
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
  linkMuted: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontWeight: 600,
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
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    textAlign: 'center',
  },
  // Kept in the layout (not display:none) so the invisible-reCAPTCHA widget
  // can measure it; tucked off in the corner and made non-interactive rather
  // than visually hidden with zero size.
  recaptchaContainer: {
    position: 'fixed',
    bottom: 0,
    right: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
};
