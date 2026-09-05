import {Fragment, useEffect, useState} from 'react';
import {useIsMobile} from '../hooks/useIsMobile';
import type {User} from 'firebase/auth';
import {avatarColor, colors} from '../theme';
import {useTheme} from '../context/ThemeContext';
import {useToast} from '../context/ToastContext';
import {useT, type Lang} from '../i18n';
import {setProfileVisibility, signOut, updateDisplayName} from '../services/auth';
import {changePassword, type PasswordChangeError} from '../services/account';
import {exportUserData} from '../services/dataExport';
import {downloadJson} from '../utils/downloadFile';
import {createBillingPortalSession} from '../services/billing';
import {grantAiConsent, hasAiConsent, revokeAiConsent} from '../services/aiConsent';
import {isLinkPreviewEnabled, setLinkPreviewEnabled} from '../services/linkPreview';
import {useEntitlement} from '../context/EntitlementContext';
import {checkPasswordStrength} from '../services/passwordPolicy';
import {getUserById} from '../services/chat';
import {currentPermission, enablePush, notificationsSupported} from '../services/push';
import {startTour} from '../services/tour';
import SavedModal from '../components/SavedModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import RecoveryPhraseModal from '../components/RecoveryPhraseModal';
import FocusModeCard from '../components/FocusModeCard';
import DownloadAppCard from '../components/DownloadAppCard';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';

type Vis = 'public' | 'friends' | 'private';
type SectionId = 'profile' | 'preferences' | 'privacy' | 'account' | 'subscription' | 'support';

export default function ProfileScreen({user}: {user: User}) {
  const {t, lang, setLang} = useT();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<SectionId>('profile');
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
  const [showRecovery, setShowRecovery] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [exportDataError, setExportDataError] = useState<string | null>(null);
  const {entitlement, isPro} = useEntitlement();
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  // Per-device, so this reflects the browser you're sitting at.
  const [aiAllowed, setAiAllowed] = useState(hasAiConsent);
  const [previewsOn, setPreviewsOn] = useState(isLinkPreviewEnabled);

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

  // "Download my data": a human-readable, decrypted copy of the account's
  // Firestore data (profile, conversations, moments, social graph). Reading
  // the account's own data doesn't count as a Firebase Auth "sensitive
  // operation", so unlike password change/delete this needs no reauthentication.
  const handleDownloadData = async () => {
    setExportingData(true);
    setExportDataError(null);
    try {
      const data = await exportUserData(user.uid);
      downloadJson(`chatterbox-data-${new Date().toISOString().slice(0, 10)}.json`, data);
    } catch (err) {
      console.warn('data export failed:', err);
      setExportDataError(t('account.exportDataFailed'));
    } finally {
      setExportingData(false);
    }
  };

  // Both billing actions hand off to a Stripe-hosted page, so card details
  // never touch this app.
  const startBilling = async (getUrl: () => Promise<string>) => {
    setBillingBusy(true);
    setBillingError(null);
    try {
      window.location.assign(await getUrl());
    } catch (err) {
      console.warn('billing action failed:', err);
      setBillingError(t('pro.error'));
      setBillingBusy(false); // stays busy on success — we're navigating away
    }
  };

  const handleManageBilling = () => startBilling(createBillingPortalSession);

  const proStatusText = (() => {
    if (!entitlement) return t('pro.active');
    const renews = new Date(entitlement.currentPeriodEnd).toLocaleDateString();
    if (entitlement.cancelAtPeriodEnd) return `${t('pro.endsOn')} ${renews}`;
    if (entitlement.status === 'past_due') return t('pro.pastDue');
    return `${t('pro.renewsOn')} ${renews}`;
  })();

  const initial = (savedName || user.email || '?').charAt(0).toUpperCase();

  const sections: {id: SectionId; label: string; node: React.ReactNode}[] = [
    {
      id: 'profile',
      label: t('profile.sectionProfile'),
      node: (
        <>
          <section style={styles.card}>
            <label style={styles.cardTitle} htmlFor="profile-display-name">
              {t('profile.displayName')}
            </label>
            <div style={styles.nameRow}>
              <input
                id="profile-display-name"
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
            <div style={styles.cardTitle}>{t('profile.visibility')}</div>
            <div style={styles.cardDesc}>{t('profile.visibilityDesc')}</div>
            <div style={styles.visRow}>
              {(['public', 'friends', 'private'] as Vis[]).map(v => (
                <button
                  key={v}
                  onClick={() => changeVis(v)}
                  style={{...styles.visChip, ...(vis === v ? styles.chipOn : styles.chipOff)}}>
                  {t(`profile.visibility.${v}` as 'profile.visibility.public')}
                </button>
              ))}
            </div>
          </section>

          <button className="btn btn-soft" style={styles.savedBtn} onClick={() => setShowSaved(true)}>
            <Icon name="bookmark" size={16} style={{verticalAlign: '-3px', marginRight: 8}} />
            {t('profile.saved')}
          </button>
        </>
      ),
    },
    {
      id: 'preferences',
      label: t('profile.sectionPreferences'),
      node: (
        <>
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
        </>
      ),
    },
    {
      id: 'privacy',
      label: t('profile.sectionPrivacy'),
      node: (
        <>
          <section style={styles.card}>
            <div style={styles.cardTitle}>{t('aiConsent.settingsTitle')}</div>
            <div style={styles.cardDesc}>
              {aiAllowed ? t('aiConsent.settingsOn') : t('aiConsent.settingsOff')}
            </div>
            <button
              type="button"
              className={aiAllowed ? 'btn' : 'btn btn-primary'}
              style={aiAllowed ? styles.deleteBtn : styles.pwSubmit}
              onClick={() => {
                if (aiAllowed) {
                  revokeAiConsent();
                  setAiAllowed(false);
                  toast.show(t('aiConsent.turnedOff'));
                } else {
                  grantAiConsent();
                  setAiAllowed(true);
                }
              }}>
              {aiAllowed ? t('aiConsent.turnOff') : t('aiConsent.turnOn')}
            </button>
          </section>

          <FocusModeCard uid={user.uid} />

          <section style={styles.card}>
            <div style={styles.cardTitle}>{t('linkPreview.settingsTitle')}</div>
            <div style={styles.cardDesc}>
              {previewsOn ? t('linkPreview.settingsOn') : t('linkPreview.settingsOff')}
            </div>
            <button
              type="button"
              className={previewsOn ? 'btn' : 'btn btn-primary'}
              style={previewsOn ? styles.deleteBtn : styles.pwSubmit}
              onClick={() => {
                setLinkPreviewEnabled(!previewsOn);
                setPreviewsOn(!previewsOn);
                if (previewsOn) toast.show(t('linkPreview.turnedOff'));
              }}>
              {previewsOn ? t('linkPreview.turnOff') : t('linkPreview.turnOn')}
            </button>
          </section>
        </>
      ),
    },
    {
      id: 'account',
      label: t('profile.sectionAccount'),
      node: (
        <>
          <form style={styles.card} onSubmit={submitPasswordChange}>
            <div style={styles.cardTitle}>{t('account.changePassword')}</div>
            <div style={styles.cardDesc}>{t('account.changePasswordDesc')}</div>
            <PasswordInput
              style={{...styles.input, marginBottom: 8}}
              placeholder={t('account.currentPassword')}
              aria-label={t('account.currentPassword')}
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
            <PasswordInput
              style={{...styles.input, marginBottom: 8}}
              placeholder={t('account.newPassword')}
              aria-label={t('account.newPassword')}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
            <PasswordInput
              style={{...styles.input, marginBottom: 8}}
              placeholder={t('account.confirmPassword')}
              aria-label={t('account.confirmPassword')}
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

          <section style={styles.card}>
            <div style={styles.cardTitle}>Recovery phrase</div>
            <div style={styles.cardDesc}>
              The 24 words that let you read your encrypted messages again if you clear
              this browser's data. Nothing else can recover them.
            </div>
            <button
              type="button"
              className="btn btn-soft"
              style={styles.pwSubmit}
              onClick={() => setShowRecovery(true)}>
              <Icon name="key" size={15} style={{verticalAlign: '-3px', marginRight: 8}} />
              Show or restore phrase
            </button>
          </section>

          <section style={styles.card}>
            <div style={styles.cardTitle}>{t('account.exportData')}</div>
            <div style={styles.cardDesc}>{t('account.exportDataDesc')}</div>
            {exportDataError && <div style={styles.pwError}>{exportDataError}</div>}
            <button
              type="button"
              className="btn btn-primary"
              style={styles.pwSubmit}
              disabled={exportingData}
              onClick={handleDownloadData}>
              {exportingData ? (
                <span className="spinner" />
              ) : (
                <>
                  <Icon name="download" size={15} style={{verticalAlign: '-3px', marginRight: 8}} />
                  {t('account.exportData')}
                </>
              )}
            </button>
          </section>

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
        </>
      ),
    },
    {
      id: 'subscription',
      label: t('profile.sectionSubscription'),
      node: (
        <section style={styles.card}>
          <div style={styles.cardTitle}>
            {t('pro.title')}
            {isPro && <span style={styles.proBadge}>{t('pro.badge')}</span>}
          </div>
          <div style={styles.cardDesc}>
            {isPro ? proStatusText : t('pro.pitch')}
          </div>
          {billingError && <div style={styles.pwError}>{billingError}</div>}
          {isPro ? (
            <button
              type="button"
              className="btn btn-soft"
              style={styles.pwSubmit}
              disabled={billingBusy}
              onClick={handleManageBilling}>
              {billingBusy ? <span className="spinner" /> : t('pro.manage')}
            </button>
          ) : (
            /* Buying happens in one place — the Store. This card only reports
               status and points there, so there's a single commerce surface. */
            <button
              type="button"
              className="btn btn-primary"
              style={styles.pwSubmit}
              onClick={() => {
                window.location.hash = '#/store';
              }}>
              {t('store.openStore')}
            </button>
          )}
        </section>
      ),
    },
    {
      id: 'support',
      label: t('profile.sectionSupport'),
      node: (
        <>
          <section style={styles.card}>
            <div style={styles.cardTitle}>{t('profile.tutorial')}</div>
            <div style={styles.cardDesc}>{t('profile.tutorialDesc')}</div>
            <button className="btn btn-soft" style={styles.pushBtn} onClick={() => startTour()}>
              <Icon name="sparkles" size={15} style={{verticalAlign: '-3px', marginRight: 8}} />
              {t('profile.replayTutorial')}
            </button>
          </section>

          <DownloadAppCard />
        </>
      ),
    },
  ];

  const activeNode = sections.find(s => s.id === activeSection)?.node;

  return (
    <div style={styles.wrap}>
      {isMobile ? (
        <div className="scroll" style={styles.mobileScroll}>
          <div style={styles.header}>
            <div style={{...styles.avatar, background: avatarColor(user.uid)}}>{initial}</div>
            <h1 style={styles.name}>{savedName || 'User'}</h1>
            <div style={styles.email}>{user.email}</div>
            <span style={styles.badge}>{t('profile.member')}</span>
          </div>
          {sections.map((s, i) => (
            <Fragment key={s.id}>
              <div style={{...styles.sectionHeader, ...(i === 0 ? {marginTop: 0} : null)}}>{s.label}</div>
              {s.node}
            </Fragment>
          ))}
        </div>
      ) : (
        <>
          <aside style={styles.rail}>
            <div style={styles.railHeader}>
              <div style={{...styles.avatar, ...styles.avatarSmall, background: avatarColor(user.uid)}}>
                {initial}
              </div>
              <div style={styles.railName}>{savedName || 'User'}</div>
              <div style={styles.railEmail}>{user.email}</div>
              <span style={styles.badge}>{t('profile.member')}</span>
            </div>
            <nav style={styles.navList}>
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  style={{...styles.navItem, ...(activeSection === s.id ? styles.navItemActive : null)}}>
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>
          <div className="scroll" style={styles.content}>
            <div style={styles.contentInner}>{activeNode}</div>
          </div>
        </>
      )}
      {showSaved && <SavedModal myUid={user.uid} onClose={() => setShowSaved(false)} />}
      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
      {showRecovery && (
        <RecoveryPhraseModal uid={user.uid} onClose={() => setShowRecovery(false)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {flex: 1, minWidth: 0, height: '100%', display: 'flex'},
  mobileScroll: {width: '100%', maxWidth: 520, margin: '0 auto', overflowY: 'auto', padding: '32px 20px 48px'},
  // Desktop: a fixed nav rail (mirrors HomeScreen's chat-list sidebar) so the
  // settings never sit as one narrow column stranded in a sea of empty
  // canvas on a wide viewport — the rail claims that space instead.
  rail: {
    width: 264,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '28px 18px',
    borderRight: `1px solid ${colors.border}`,
    overflowY: 'auto',
  },
  railHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 22,
    paddingBottom: 20,
    borderBottom: `1px solid ${colors.border}`,
  },
  avatarSmall: {width: 72, height: 72, fontSize: 28, marginBottom: 10},
  railName: {fontSize: 16.5, fontWeight: 800, color: colors.text, margin: '0 0 2px'},
  railEmail: {fontSize: 12.5, color: colors.textSecondary, marginBottom: 10, wordBreak: 'break-all'},
  navList: {display: 'flex', flexDirection: 'column', gap: 2},
  navItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 14px',
    borderRadius: 2,
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  navItemActive: {background: colors.primaryLight, color: colors.primary},
  content: {flex: 1, minWidth: 0, overflowY: 'auto'},
  contentInner: {maxWidth: 720, margin: '0 auto', padding: '32px 40px 64px'},
  header: {display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28},
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 999,
    background: colors.primary,
    color: colors.textOnPrimary,
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
    borderRadius: 2,
    padding: 18,
    marginBottom: 14,
    boxShadow: colors.shadowSoft,
  },
  sectionHeader: {
    fontSize: 12.5,
    fontWeight: 700,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    margin: '22px 6px 10px',
  },
  cardTitle: {fontWeight: 700, fontSize: 15, color: colors.text, display: 'block'},
  cardDesc: {fontSize: 13.5, color: colors.textSecondary, margin: '4px 0 12px'},
  nameRow: {display: 'flex', gap: 10, marginTop: 10},
  input: {
    flex: 1,
    padding: '11px 14px',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    fontSize: 15,
    color: colors.text,
  },
  saveBtn: {padding: '0 22px', borderRadius: 2, minWidth: 84},
  visRow: {display: 'flex', gap: 8},
  visChip: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 2,
    border: `1px solid ${colors.border}`,
    fontSize: 14,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  chipOn: {background: colors.primary, color: colors.textOnPrimary, borderColor: colors.primary},
  chipOff: {background: 'transparent', color: colors.text},
  pushBtn: {width: '100%', padding: '12px', borderRadius: 2, fontSize: 14.5},
  pushOn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    borderRadius: 2,
    background: colors.primaryLight,
    color: colors.primary,
    fontWeight: 700,
    fontSize: 14.5,
  },
  pushNote: {fontSize: 12.5, color: colors.textTertiary, marginTop: 8, textAlign: 'center'},
  savedBtn: {width: '100%', padding: '13px', borderRadius: 2, fontSize: 15, marginBottom: 12},
  signOut: {
    width: '100%',
    padding: '13px',
    borderRadius: 2,
    border: `1px solid ${colors.danger}`,
    background: 'transparent',
    color: colors.danger,
    fontWeight: 700,
    fontSize: 15,
    marginTop: 8,
  },
  pwError: {color: colors.danger, fontSize: 13, marginBottom: 8},
  pwSubmit: {width: '100%', padding: '12px', borderRadius: 2, fontSize: 14.5, marginTop: 2},
  proBadge: {
    marginLeft: 8,
    padding: '2px 8px',
    borderRadius: 999,
    background: colors.primary,
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: 700,
    verticalAlign: 'middle',
  },
  proPlanRow: {display: 'flex', gap: 10},
  proPlanBtn: {flex: 1, padding: '12px', borderRadius: 2, fontSize: 14.5, marginTop: 2},
  // Visually separated from the rest of the settings so the irreversible
  // action never sits flush against routine toggles.
  dangerZone: {
    marginTop: 28,
    border: `1px solid ${colors.danger}`,
    borderRadius: 2,
    padding: 18,
  },
  deleteBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 2,
    border: 'none',
    background: colors.danger,
    color: colors.textOnDanger,
    fontWeight: 700,
    fontSize: 14.5,
    cursor: 'pointer',
  },
};
