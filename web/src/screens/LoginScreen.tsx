import {useState} from 'react';
import {colors} from '../theme';
import {useT} from '../i18n';
import BrandMark from '../components/BrandMark';
import {signIn, signUp} from '../services/auth';

export default function LoginScreen() {
  const {t} = useT();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t('login.enterBoth'));
      return;
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
    <div style={styles.container}>
      <form onSubmit={submit} style={styles.card}>
        <div style={{display: 'flex', justifyContent: 'center', marginBottom: 18}}>
          <BrandMark size={56} />
        </div>
        <h1 style={styles.title}>Chatterbox</h1>
        <p style={styles.subtitle}>
          {mode === 'signin' ? t('login.signInToContinue') : t('login.createAccount')}
        </p>

        {mode === 'signup' && (
          <input
            style={styles.input}
            placeholder={t('login.displayName')}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        )}
        <input
          style={styles.input}
          placeholder={t('login.email')}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          style={styles.input}
          placeholder={t('login.password')}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" className="btn btn-primary" style={styles.primaryBtn} disabled={busy}>
          {busy ? <span className="spinner" /> : mode === 'signin' ? t('login.signIn') : t('login.signUp')}
        </button>

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
      </form>
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
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
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
    fontSize: 34,
    fontWeight: 800,
    letterSpacing: '-1px',
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
  primaryBtn: {
    marginTop: 6,
    padding: '13px 16px',
    borderRadius: 14,
    fontSize: 16,
    minHeight: 50,
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
};
