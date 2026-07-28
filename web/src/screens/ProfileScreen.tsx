import {useEffect, useState} from 'react';
import type {User} from 'firebase/auth';
import {avatarColor, colors} from '../theme';
import {useTheme} from '../context/ThemeContext';
import {useToast} from '../context/ToastContext';
import {useT, type Lang} from '../i18n';
import {setProfileVisibility, signOut, updateDisplayName} from '../services/auth';
import {changePassword, type PasswordChangeError} from '../services/account';
import {checkPasswordStrength} from '../services/passwordPolicy';
import {getUserById} from '../services/chat';
import {currentPermission, enablePush, notificationsSupported} from '../services/push';
import {startTour} from '../services/tour';
import SavedModal from '../components/SavedModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import DownloadAppCard from '../components/DownloadAppCard';
import Icon from '../components/Icon';

type Vis = 'public' | 'friends' | 'private';

export default function ProfileScreen({user}: {user: User}) {
  const {t, lang, setLang} = useT();
  const {theme, setTheme} = useTheme();
  const toast = useToast();
  const [name, setName] = useState(user.displayName || '');
  const [savedName, setSavedName] = useState(user.displayName || '');
  const [vis, setVis] = useState<Vis>('public');
  const [savingName, setSavingName] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPerm, setPushPerm] = useState(currentPermission());
  const [enablingPush, setEnablingPush] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [changingPw, setChangingPw] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    getUserById(user.uid).then(p => {
      if (p?.profileVisibility) setVis(p.profileVisibility as Vis);
      if (p?.displayName) {
        setName(p.displayName);
        setSavedName(p.displayName);
      }
    });
    setPushSupported(notificationsSupported());
  }, [user.uid]);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === savedName || savingName) return;
    setSavingName(true);
    try {
      await updateDisplayName(trimmed);
      setSavedName(trimmed);
      toast.success(t('common.save'));
    } catch (err) {
      console.warn('save name failed:', err);
      toast.error(t('chat.sendFailed'));
    } finally {
      setSavingName(false);
    }
  };

  const changeVis = async (v: Vis) => {
    setVis(v);
    try {
      await setProfileVisibility(v);
    } catch (err) {
      console.warn('visibility update failed:', err);
    }
  };

  const onEnablePush = async () => {
    setEnablingPush(true);
    try {
      const state = await enablePush(user.uid);
      setPushPerm(state);
      if (state === 'granted') toast.success(t('profile.notificationsOn'));
      else if (state === 'denied') toast.error(t('profile.notificationsBlocked'));
      else if (state === 'unsupported') toast.error(t('profile.notificationsUnsupported'));
    } finally {
      setEnablingPush(false);
    }
  };

  const submitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPw !== confirmPw) {
      setPwError(t('account.passwordMismatch'));
      return;
    }
    // Same policy the sign-up form enforces, so a password change cannot be
    // used to sidestep it and land on something weaker.
    const strength = checkPasswordStrength(newPw);
    if (strength !== 'ok') {
      setPwError(
        {
          'too-short': 'Password must be at least 8 characters.',
          'too-common': 'That password is too common — please choose a less predictable one.',
          'too-simple':
            'That password is too predictable (repeated or sequential characters) — please choose another.',
        }[strength],
      );
      return;
    }
    setChangingPw(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      toast.success(t('account.passwordChanged'));
    } catch (err) {
      const reason = (err as {reason?: PasswordChangeError}).reason;
      setPwError(
        reason === 'wrong-password'
          ? t('account.wrongPassword')
          : reason === 'too-many-requests'
          ? t('account.tooManyRequests')
          : t('account.genericError'),
      );
    } finally {
      setChangingPw(false);
    }
  };

  const initial = (savedName || user.email || '?').charAt(0).toUpperCase();

  return (
    <div style={styles.wrap}>
      <div className="scroll" style={styles.scroll}>
        <div style={styles.header}>
          <div style={{...styles.avatar, background: avatarColor(user.uid)}}>{initial}</div>
          <h1 style={styles.name}>{savedName || 'User'}</h1>
          <div style={styles.email}>{user.email}</div>
          <span style={styles.badge}>{t('profile.member')}</span>
        </div>

        <section style={styles.card}>
          <label style={styles.cardTitle}>{t('profile.displayName')}</label>
          <div style={styles.nameRow}>
            <input
              style={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('profile.yourName')}
            />
            <button
              className="btn btn-primary"
              style={styles.saveBtn}
              onClick={saveName}
              disabled={savingName || !name.trim() || name.trim() === savedName}>
              {savingName ? <span className="spinner" /> : t('common.save')}
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitle}>{t('profile.appearance')}</div>
          <div style={styles.cardDesc}>{t('profile.appearanceDesc')}</div>
          <div style={styles.visRow}>
            <button
              onClick={() => setTheme('dark')}
              style={{...styles.visChip, ...(theme === 'dark' ? styles.chipOn : styles.chipOff)}}>
              <Icon name="moon" size={15} style={{verticalAlign: '-3px', marginRight: 6}} />
              {t('profile.dark')}
            </button>
            <button
              onClick={() => setTheme('light')}
              style={{...styles.visChip, ...(theme === 'light' ? styles.chipOn : styles.chipOff)}}>
              <Icon name="sun" size={15} style={{verticalAlign: '-3px', marginRight: 6}} />
              {t('profile.light')}
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitle}>{t('profile.language')}</div>
          <div style={styles.cardDesc}>{t('profile.languageDesc')}</div>
          <div style={styles.visRow}>
            {([['en', 'English'], ['zh', '中文']] as [Lang, string][]).map(([code, label]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{...styles.visChip, ...(lang === code ? styles.chipOn : styles.chipOff)}}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitle}>{t('profile.notifications')}</div>
          <div style={styles.cardDesc}>{t('profile.notificationsDesc')}</div>
          {pushPerm === 'granted' ? (
            <div style={styles.pushOn}>
              <Icon name="bell" size={15} style={{verticalAlign: '-3px', marginRight: 8}} />
              {t('profile.notificationsOn')}
            </div>
          ) : (
            <button
              className="btn btn-soft"
              style={styles.pushBtn}
              onClick={onEnablePush}
              disabled={enablingPush || !pushSupported}>
              {enablingPush ? (
                <span className="spinner" />
              ) : (
                <>
                  <Icon name="bell" size={15} style={{verticalAlign: '-3px', marginRight: 8}} />
                  {t('profile.enableNotifications')}
                </>
              )}
            </button>
          )}
          {!pushSupported && pushPerm !== 'granted' && (
            <div style={styles.pushNote}>{t('profile.notificationsUnsupported')}</div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitle}>{t('profile.tutorial')}</div>
          <div style={styles.cardDesc}>{t('profile.tutorialDesc')}</div>
          <button className="btn btn-soft" style={styles.pushBtn} onClick={() => startTour()}>
            <Icon name="sparkles" size={15} style={{verticalAlign: '-3px', marginRight: 8}} />
            {t('profile.replayTutorial')}
          </button>
        </section>

        <DownloadAppCard />

        <section style={styles.card}>
          <div style={styles.cardTitle}>{t('profile.visibility')}</div>
          <div style={styles.cardDesc}>{t('profile.visibilityDesc')}</div>
          <div style={styles.visRow}>
            {(['public', 'friends', 'private'] as Vis[]).map(v => (
              <button
                key={v}
                onClick={() => changeVis(v)}
                style={{...styles.visChip, ...(vis === v ? styles.chipOn : styles.chipOff)}}>
                {t(`moments.${v === 'friends' ? 'friendsVis' : v}` as 'moments.public')}
              </button>
            ))}
          </div>
        </section>

        <button className="btn btn-soft" style={styles.savedBtn} onClick={() => setShowSaved(true)}>
          <Icon name="bookmark" size={16} style={{verticalAlign: '-3px', marginRight: 8}} />
          {t('profile.saved')}
        </button>

        <form style={styles.card} onSubmit={submitPasswordChange}>
          <div style={styles.cardTitle}>{t('account.changePassword')}</div>
          <div style={styles.cardDesc}>{t('account.changePasswordDesc')}</div>
          <input
            style={{...styles.input, marginBottom: 8}}
            type="password"
            placeholder={t('account.currentPassword')}
            value={currentPw}
            onChange={e => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
          <input
            style={{...styles.input, marginBottom: 8}}
            type="password"
            placeholder={t('account.newPassword')}
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            autoComplete="new-password"
          />
          <input
            style={{...styles.input, marginBottom: 8}}
            type="password"
            placeholder={t('account.confirmPassword')}
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
          {pwError && <div style={styles.pwError}>{pwError}</div>}
          <button
            type="submit"
            className="btn btn-primary"
            style={styles.pwSubmit}
            disabled={changingPw || !currentPw || !newPw || !confirmPw}>
            {changingPw ? <span className="spinner" /> : t('account.changePassword')}
          </button>
        </form>

        <button style={styles.signOut} onClick={() => signOut()}>
          {t('profile.signOut')}
        </button>

        <section style={styles.dangerZone}>
          <div style={styles.cardTitle}>{t('account.deleteAccount')}</div>
          <div style={styles.cardDesc}>{t('account.deleteDesc')}</div>
          <button style={styles.deleteBtn} onClick={() => setShowDelete(true)}>
            <Icon name="trash" size={15} style={{verticalAlign: '-3px', marginRight: 8}} />
            {t('account.deleteAccount')}
          </button>
        </section>
      </div>
      {showSaved && <SavedModal myUid={user.uid} onClose={() => setShowSaved(false)} />}
      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center'},
  scroll: {width: '100%', maxWidth: 520, overflowY: 'auto', padding: '32px 20px 48px'},
  header: {display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28},
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 999,
    background: colors.primary,
    color: '#fff',
    fontSize: 40,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  name: {fontSize: 26, fontWeight: 800, margin: '0 0 4px', color: colors.text},
  email: {color: colors.textSecondary, marginBottom: 12},
  badge: {
    background: colors.primaryLight,
    color: colors.primary,
    fontWeight: 700,
    fontSize: 13,
    padding: '5px 14px',
    borderRadius: 999,
  },
  card: {
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    boxShadow: colors.shadowSoft,
  },
  cardTitle: {fontWeight: 700, fontSize: 15, color: colors.text, display: 'block'},
  cardDesc: {fontSize: 13.5, color: colors.textSecondary, margin: '4px 0 12px'},
  nameRow: {display: 'flex', gap: 10, marginTop: 10},
  input: {
    flex: 1,
    padding: '11px 14px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 15,
    color: colors.text,
  },
  saveBtn: {padding: '0 22px', borderRadius: 12, minWidth: 84},
  visRow: {display: 'flex', gap: 8},
  visChip: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    fontSize: 14,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  chipOn: {background: colors.primary, color: '#fff', borderColor: colors.primary},
  chipOff: {background: 'transparent', color: colors.text},
  pushBtn: {width: '100%', padding: '12px', borderRadius: 12, fontSize: 14.5},
  pushOn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    borderRadius: 12,
    background: colors.primaryLight,
    color: colors.primary,
    fontWeight: 700,
    fontSize: 14.5,
  },
  pushNote: {fontSize: 12.5, color: colors.textTertiary, marginTop: 8, textAlign: 'center'},
  savedBtn: {width: '100%', padding: '13px', borderRadius: 14, fontSize: 15, marginBottom: 12},
  signOut: {
    width: '100%',
    padding: '13px',
    borderRadius: 14,
    border: `1px solid ${colors.danger}`,
    background: 'transparent',
    color: colors.danger,
    fontWeight: 700,
    fontSize: 15,
    marginTop: 8,
  },
  pwError: {color: colors.danger, fontSize: 13, marginBottom: 8},
  pwSubmit: {width: '100%', padding: '12px', borderRadius: 12, fontSize: 14.5, marginTop: 2},
  // Visually separated from the rest of the settings so the irreversible
  // action never sits flush against routine toggles.
  dangerZone: {
    marginTop: 28,
    border: `1px solid ${colors.danger}`,
    borderRadius: 20,
    padding: 18,
  },
  deleteBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 12,
    border: 'none',
    background: colors.danger,
    color: '#fff',
    fontWeight: 700,
    fontSize: 14.5,
    cursor: 'pointer',
  },
};
