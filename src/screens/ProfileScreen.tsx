import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useColorScheme,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {getColors, monoFont, radius} from '../theme/colors';
import {
  decryptedImportAll,
  encryptedExportAll,
  MIN_BACKUP_PASSPHRASE_LENGTH,
} from '../services/firebaseChat';
import Clipboard from '@react-native-clipboard/clipboard';
import {getBooleanFlag} from '../services/featureFlags';
import {submitFeedback} from '../services/feedback';
import {reportError, trackEvent} from '../services/telemetry';
import {useFocusEffect} from '@react-navigation/native';
import {doc, getFirestore, onSnapshot, serverTimestamp, setDoc} from '../services/firebase/firestore';
import GlassView from '../components/GlassView';
import GlassScreen from '../components/GlassScreen';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import i18n, {LANGUAGES} from '../i18n';
import {applyLayoutDirection} from '../i18n/rtl';
import {PRIVACY_TOGGLES, type PrivacyKey} from '../services/privacyToggles';
import {enableFocusMode, disableFocusMode} from '../services/focusMode';
import {uploadVoiceStatus, removeVoiceStatus} from '../services/voiceStatus';
import {startTutorial} from '../services/tutorial';
import {SHOW_NATIVE_ONLY_FEATURES} from '../config/parity';
import {useNavigation} from '@react-navigation/native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {
  changePassword,
  deleteAccount,
  type PasswordChangeError,
} from '../services/account';
import {exportUserData} from '../services/dataExport';
import {isProActive, listenEntitlement, type Entitlement} from '../services/entitlement';
import {grantAiConsent, hasAiConsent, revokeAiConsent} from '../services/aiConsent';
import {isLinkPreviewEnabled, setLinkPreviewEnabled} from '../services/privacyGuard';
import {shareTextFile} from '../utils/shareFile';
import {checkPasswordStrength} from '../services/passwordPolicy';
import {guardDocSnapshot} from '../services/snapshotGuard';
import {bodyWeight, fonts} from '../theme/typography';

export default function ProfileScreen() {
  const {user, signOut} = useAuth();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [exportVisible, setExportVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  // Change-password / delete-account flows.
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  // Backups are encrypted under a passphrase the user chooses; it is never
  // persisted, so losing it means losing the backup.
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [exportDataError, setExportDataError] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  // Per device, so this reflects the phone in your hand.
  const [aiAllowed, setAiAllowed] = useState(false);
  // MMKV-backed and synchronous, unlike AI consent — no effect needed.
  const [previewsOn, setPreviewsOn] = useState(isLinkPreviewEnabled);

  useEffect(() => {
    hasAiConsent().then(setAiAllowed);
  }, []);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [visibilityLoading, setVisibilityLoading] = useState(true);
  const [focusEnabled, setFocusEnabled] = useState(false);
  const [focusUntil, setFocusUntil] = useState<number | null>(null);
  const [focusAutoReply, setFocusAutoReply] = useState('');
  const [focusModalVisible, setFocusModalVisible] = useState(false);
  const [focusDuration, setFocusDuration] = useState('60');
  const [focusMessage, setFocusMessage] = useState('I\'m currently in focus mode. I\'ll get back to you later.');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  const [voiceStatusUrl, setVoiceStatusUrl] = useState<string | null>(null);
  const [voiceStatusDuration, setVoiceStatusDuration] = useState(0);
  const [vsRecording, setVsRecording] = useState(false);
  const [vsPlaying, setVsPlaying] = useState(false);
  const [vsRecordedUri, setVsRecordedUri] = useState<string | null>(null);
  const [vsRecordedDuration, setVsRecordedDuration] = useState(0);
  const [vsModalVisible, setVsModalVisible] = useState(false);
  const vsRecorderRef = useRef(new AudioRecorderPlayer());
  const db = useMemo(() => getFirestore(), []);
  const navigation = useNavigation<any>();
  const visibilityOptions = useMemo(() => ['public', 'friends', 'private'] as const, []);

  useEffect(() => {
    const recorder = vsRecorderRef.current;
    return () => {
      recorder.stopRecorder().catch(() => {});
      recorder.stopPlayer().catch(() => {});
      recorder.removeRecordBackListener();
      recorder.removePlayBackListener();
    };
  }, []);

  const currentLanguage = useMemo(() => {
    const resolved = i18n.language;
    return LANGUAGES.find(l => l.code === resolved) || LANGUAGES[0];
  }, [i18n.language]);

  const filteredLanguages = useMemo(() => {
    if (!languageSearch.trim()) return LANGUAGES;
    const q = languageSearch.toLowerCase().trim();
    return LANGUAGES.filter(
      l =>
        l.label.toLowerCase().includes(q) ||
        l.nativeLabel.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [languageSearch]);

  const [privacy, setPrivacy] = useState<Record<PrivacyKey, boolean>>(() =>
    Object.fromEntries(PRIVACY_TOGGLES.map(x => [x.key, x.read()])) as Record<PrivacyKey, boolean>,
  );

  const handlePrivacyToggle = useCallback((key: PrivacyKey) => {
    const toggle = PRIVACY_TOGGLES.find(x => x.key === key);
    if (!toggle) return;
    toggle.write(!toggle.read());
    // Read back rather than trusting the value just written: the row is a
    // claim about stored state, and MMKV is the thing that holds it.
    setPrivacy(prev => ({...prev, [key]: toggle.read()}));
  }, []);

  const handleLanguageChange = useCallback(
    (code: string) => {
      i18n.changeLanguage(code);
      setLanguageModalVisible(false);
      setLanguageSearch('');
      // changeLanguage records the layout direction for the next launch (see
      // i18n/rtl.ts). React Native cannot reflow the running app, so when the
      // direction actually flips the user is told — otherwise they are left
      // looking at right-to-left text inside a left-to-right layout and have
      // no reason to think a relaunch would fix it.
      const {needsRestart} = applyLayoutDirection(code);
      if (needsRestart) {
        const language = LANGUAGES.find(l => l.code === code)?.nativeLabel || code;
        Alert.alert(
          t('profile.restartForLayoutTitle'),
          t('profile.restartForLayoutBody', {language}),
        );
      }
    },
    [t],
  );
  const profileInitial = useMemo(() => {
    return user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';
  }, [user?.displayName, user?.email]);

  useEffect(() => {
    let active = true;
    const loadFlag = async () => {
      const enabled = await getBooleanFlag('feedback_enabled', true);
      if (active) {
        setFeedbackEnabled(prev => (prev === enabled ? prev : enabled));
      }
    };
    loadFlag();
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user?.uid) return;
      const unsub = onSnapshot(
        doc(db, 'users', user.uid),
        guardDocSnapshot('listen_profile_visibility', snapshot => {
          const data = snapshot.data() as any;
          const next = (data?.profileVisibility as 'public' | 'friends' | 'private') || 'public';
          setProfileVisibility(next);
          setVisibilityLoading(false);
          const vs = data?.voiceStatus;
          if (vs?.url && vs?.createdAt && Date.now() - vs.createdAt < 24 * 60 * 60 * 1000) {
            setVoiceStatusUrl(vs.url);
            setVoiceStatusDuration(vs.duration || 0);
          } else {
            setVoiceStatusUrl(null);
            setVoiceStatusDuration(0);
          }
          const focus = data?.focusMode;
          if (focus?.enabled && focus?.until && focus.until > Date.now()) {
            setFocusEnabled(true);
            setFocusUntil(focus.until);
            setFocusAutoReply(focus.autoReply || '');
          } else {
            setFocusEnabled(false);
            setFocusUntil(null);
          }
        }),
        error => {
          reportError(error, 'profile_visibility_listener');
          if (__DEV__) {
            console.error('profile visibility listener failed:', error);
          }
          setVisibilityLoading(false);
        },
      );
      return () => unsub();
    }, [user?.uid, db]),
  );

  const updateVisibility = useCallback(
    async (next: 'public' | 'friends' | 'private') => {
      if (!user?.uid || next === profileVisibility) return;
      setProfileVisibility(next);
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            profileVisibility: next,
            updatedAt: serverTimestamp(),
          },
          {merge: true},
        );
        trackEvent('profile_visibility_changed', {visibility: next}).catch(() => undefined);
      } catch (error) {
        reportError(error, 'profile_visibility_update');
        if (__DEV__) {
          console.error('profile visibility update failed:', error);
        }
        Alert.alert(t('common.error'), t('profile.alerts.visibilityUpdateFailed'));
      }
    },
    [db, profileVisibility, user?.uid, t],
  );

  const handleEnableFocus = useCallback(async () => {
    if (!user?.uid) return;
    const mins = parseInt(focusDuration, 10);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert('Invalid', 'Enter a valid duration in minutes.');
      return;
    }
    try {
      await enableFocusMode(user.uid, mins * 60 * 1000, focusMessage);
      // State will be updated by the Firestore snapshot listener
      setFocusModalVisible(false);
      Alert.alert('Focus Mode', `Enabled for ${mins} minutes. Auto-reply will be sent to incoming messages.`);
    } catch {
      Alert.alert('Error', 'Failed to enable focus mode.');
    }
  }, [user?.uid, focusDuration, focusMessage]);

  const handleDisableFocus = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await disableFocusMode(user.uid);
      // State will be updated by the Firestore snapshot listener
    } catch {
      Alert.alert('Error', 'Failed to disable focus mode.');
    }
  }, [user?.uid]);

  const handleVsStartRecording = useCallback(async () => {
    try {
      await vsRecorderRef.current.startRecorder();
      setVsRecording(true);
      setVsRecordedUri(null);
      vsRecorderRef.current.addRecordBackListener((e: any) => {
        setVsRecordedDuration(Math.floor((e.currentPosition || 0) / 1000));
      });
    } catch {
      Alert.alert('Error', 'Failed to start recording.');
    }
  }, []);

  const handleVsStopRecording = useCallback(async () => {
    try {
      const uri = await vsRecorderRef.current.stopRecorder();
      vsRecorderRef.current.removeRecordBackListener();
      setVsRecording(false);
      setVsRecordedUri(uri);
    } catch {
      setVsRecording(false);
    }
  }, []);

  const handleVsSave = useCallback(async () => {
    if (!user?.uid || !vsRecordedUri) return;
    try {
      await uploadVoiceStatus(user.uid, vsRecordedUri, vsRecordedDuration);
      setVsModalVisible(false);
      setVsRecordedUri(null);
      Alert.alert('Voice Status', 'Your voice diary has been set! It will expire in 24 hours.');
    } catch {
      Alert.alert('Error', 'Failed to upload voice status.');
    }
  }, [user?.uid, vsRecordedUri, vsRecordedDuration]);

  const handleVsRemove = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await removeVoiceStatus(user.uid);
    } catch {
      Alert.alert('Error', 'Failed to remove voice status.');
    }
  }, [user?.uid]);

  const handleVsPlay = useCallback(async () => {
    if (!voiceStatusUrl) return;
    try {
      setVsPlaying(true);
      await vsRecorderRef.current.startPlayer(voiceStatusUrl);
      vsRecorderRef.current.addPlayBackListener((e: any) => {
        if (e.currentPosition >= e.duration) {
          vsRecorderRef.current.stopPlayer();
          vsRecorderRef.current.removePlayBackListener();
          setVsPlaying(false);
        }
      });
    } catch {
      setVsPlaying(false);
    }
  }, [voiceStatusUrl]);

  const handleVsStop = useCallback(async () => {
    try {
      await vsRecorderRef.current.stopPlayer();
      vsRecorderRef.current.removePlayBackListener();
    } catch {}
    setVsPlaying(false);
  }, []);

  const handleSignOut = useCallback(() => {
    Alert.alert(t('profile.alerts.signOutTitle'), t('profile.alerts.signOutBody'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('profile.buttons.signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert(t('common.error'), t('profile.alerts.signOutFailed'));
          }
        },
      },
    ]);
  }, [signOut]);

  const passwordErrorMessage = useCallback(
    (reason: PasswordChangeError | undefined) =>
      reason === 'wrong-password'
        ? t('profile.account.wrongPassword')
        : reason === 'too-many-requests'
        ? t('profile.account.tooManyRequests')
        : t('profile.account.genericError'),
    [t],
  );

  const submitPasswordChange = useCallback(async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('profile.account.passwordMismatch'));
      return;
    }
    // Same policy the sign-up screen enforces, so changing a password cannot
    // be used to sidestep it and land on something weaker.
    const strength = checkPasswordStrength(newPassword);
    if (strength !== 'ok') {
      const key = {
        'too-short': 'auth.errors.passwordMin',
        'too-common': 'auth.errors.passwordTooCommon',
        'too-simple': 'auth.errors.passwordTooSimple',
      }[strength];
      Alert.alert(t('common.error'), t(key));
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t('profile.account.changePasswordTitle'), t('profile.account.passwordChanged'));
    } catch (error) {
      Alert.alert(t('common.error'), passwordErrorMessage((error as any)?.reason));
    } finally {
      setChangingPassword(false);
    }
  }, [confirmPassword, currentPassword, newPassword, passwordErrorMessage, t]);

  const runDeletion = useCallback(
    async (password: string) => {
      setDeleting(true);
      try {
        const report = await deleteAccount(password);
        // The account is gone regardless at this point; AuthContext's
        // onAuthStateChanged returns the app to the login screen on its own.
        // Surfacing a partial failure matters because the user can no longer
        // sign in to retry it.
        if (report.errors.length > 0) {
          reportError(new Error(report.errors.join('; ')), 'account_delete_partial');
          Alert.alert(t('common.error'), t('profile.account.deletePartial'));
        }
      } catch (error) {
        setDeleting(false);
        setDeleteVisible(false);
        Alert.alert(
          t('common.error'),
          (error as any)?.reason
            ? passwordErrorMessage((error as any).reason)
            : t('profile.account.deleteFailed'),
        );
      }
    },
    [passwordErrorMessage, t],
  );

  /**
   * Two-step confirmation: an explicit summary of what is destroyed, then the
   * account password. The action is irreversible and cannot be undone by
   * support — the data is genuinely gone, not flagged — so a single tap must
   * never be enough to trigger it.
   */
  const handleDeleteAccount = useCallback(() => {
    Alert.alert(t('profile.account.deleteTitle'), t('profile.account.deleteWhatHappens'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('profile.account.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          setDeletePassword('');
          setDeleteVisible(true);
        },
      },
    ]);
  }, [t]);

  // Opens the modal in "choose a passphrase" state; the backup is only produced
  // once the user supplies one (see handleGenerateExport).
  const handleExport = useCallback(() => {
    setExportText('');
    setExportPassphrase('');
    setExportVisible(true);
  }, []);

  const handleGenerateExport = useCallback(async () => {
    if (!user?.uid) return;
    if (exportPassphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
      Alert.alert(
        t('common.error'),
        t('profile.alerts.passphraseTooShort', {min: MIN_BACKUP_PASSPHRASE_LENGTH}),
      );
      return;
    }
    setExporting(true);
    try {
      // scrypt is deliberately slow (~100ms+); yield first so the spinner paints.
      await new Promise(resolve => setTimeout(resolve, 0));
      const backup = await encryptedExportAll(user.uid, exportPassphrase);
      setExportText(backup);
    } catch (error) {
      reportError(error, 'export_backup_failed');
      Alert.alert(t('profile.alerts.exportFailedTitle'), t('profile.alerts.exportFailedBody'));
    } finally {
      setExporting(false);
    }
  }, [exportPassphrase, t, user?.uid]);

  // "Download my data": a human-readable, decrypted copy of the account's
  // Firestore data (profile, conversations, moments, social graph), distinct
  // from Export Backup below, which produces an encrypted, still-ciphertext
  // bundle meant only for restoring onto another device.
  // Chatterbox Pro entitlement — read-only here. Purchase happens on the web
  // client: Apple and Google require their own in-app purchase for digital
  // goods sold inside an app, so this screen reports status and points to
  // the website rather than selling.
  useEffect(() => {
    if (!user?.uid) return;
    return listenEntitlement(user.uid, setEntitlement);
  }, [user?.uid]);
  const isPro = isProActive(entitlement);

  const proStatusText = (() => {
    if (!isPro) return `${t('pro.pitch')} ${t('pro.manageOnWeb')}`;
    if (entitlement?.status === 'past_due') return t('pro.pastDue');
    const date = entitlement ? new Date(entitlement.currentPeriodEnd).toLocaleDateString() : '';
    if (entitlement?.cancelAtPeriodEnd) return t('pro.endsOn', {date});
    return entitlement ? t('pro.renewsOn', {date}) : t('pro.active');
  })();

  const handleDownloadData = useCallback(async () => {
    if (!user?.uid) return;
    setExportingData(true);
    setExportDataError(null);
    try {
      const data = await exportUserData(user.uid);
      const filename = `chatterbox-data-${new Date().toISOString().slice(0, 10)}.json`;
      await shareTextFile(filename, JSON.stringify(data, null, 2));
    } catch (error) {
      reportError(error, 'download_my_data_failed');
      setExportDataError(t('profile.alerts.downloadDataFailedBody'));
      Alert.alert(t('profile.alerts.downloadDataFailedTitle'), t('profile.alerts.downloadDataFailedBody'));
    } finally {
      setExportingData(false);
    }
  }, [t, user?.uid]);

  const openImport = useCallback(() => {
    setImportVisible(true);
  }, []);

  const openFeedback = useCallback(() => {
    setFeedbackVisible(true);
  }, []);

  const handleCopyExport = useCallback(() => {
    Clipboard.setString(exportText);
    Alert.alert(t('profile.alerts.copiedTitle'), t('profile.alerts.copiedBody'));
  }, [exportText, t]);

  const handleImport = useCallback(async () => {
    try {
      await decryptedImportAll(importText.trim(), importPassphrase);
      setImportText('');
      setImportPassphrase('');
      setImportVisible(false);
      Alert.alert(t('profile.alerts.importSuccessTitle'), t('profile.alerts.importSuccessBody'));
    } catch (error) {
      // A wrong passphrase and a tampered payload both land here — Poly1305
      // rejects rather than returning garbage, so we can say so specifically.
      reportError(error, 'import_backup_failed');
      Alert.alert(t('profile.alerts.importFailedTitle'), t('profile.alerts.importFailedBody'));
    }
  }, [importText, importPassphrase, t]);

  const handleSendFeedback = useCallback(async () => {
    if (!user?.uid) return;
    const trimmed = feedbackText.trim();
    if (!trimmed) return;
    try {
      await submitFeedback({
        userId: user.uid,
        email: user.email,
        message: trimmed,
      });
      await trackEvent('feedback_submitted');
      setFeedbackText('');
      setFeedbackVisible(false);
      Alert.alert(t('profile.alerts.feedbackSuccessTitle'), t('profile.alerts.feedbackSuccessBody'));
    } catch (error) {
      reportError(error, 'feedback_submit_failed');
      Alert.alert(t('profile.alerts.feedbackFailedTitle'), t('profile.alerts.feedbackFailedBody'));
    }
  }, [feedbackText, user?.email, user?.uid, t]);

  return (
    <GlassScreen style={styles.container} textureSeed="profile">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <GlassView style={[styles.profileCard, {borderColor: colors.glassBorder}]}>
        <View style={[styles.profileSection, {borderBottomColor: colors.border}]}>
          <View style={[styles.avatar, {backgroundColor: colors.primary}]}>
            <Text style={[styles.avatarText, {color: colors.textOnPrimary}]}>{profileInitial}</Text>
          </View>
          <Text style={[styles.name, {color: colors.text}]}>{user?.displayName || t('profile.defaultName')}</Text>
          <Text style={[styles.email, {color: colors.textSecondary}]}>{user?.email}</Text>
          <View style={[styles.memberBadge, {backgroundColor: colors.primaryLight}]}>
            <Text style={[styles.memberBadgeText, {color: colors.primary}]}>{t('profile.memberBadge')}</Text>
          </View>
        </View>
      </GlassView>

      <View style={styles.section}>
        {SHOW_NATIVE_ONLY_FEATURES && (
        <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>{t('profile.voiceDiaryTitle')}</Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            {t('profile.voiceDiaryDescription')}
          </Text>
          {voiceStatusUrl ? (
            <View style={styles.vsActiveRow}>
              <TouchableOpacity
                style={[styles.vsPlayBtn, {backgroundColor: colors.primary}]}
                onPress={vsPlaying ? handleVsStop : handleVsPlay}>
                <Text style={[styles.vsPlayBtnText, {color: colors.textOnPrimary}]}>
                  {vsPlaying ? t('profile.voiceDiaryStop') : t('profile.voiceDiaryPlay', {seconds: voiceStatusDuration})}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.vsPlayBtn, {backgroundColor: colors.danger}]}
                onPress={handleVsRemove}>
                <Text style={[styles.vsPlayBtnText, {color: colors.textOnDanger}]}>
                  {t('profile.voiceDiaryRemove')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.focusBtn, {backgroundColor: colors.primary}]}
              onPress={() => setVsModalVisible(true)}>
              <Text style={[styles.focusBtnText, {color: colors.textOnPrimary}]}>{t('profile.recordVoiceDiary')}</Text>
            </TouchableOpacity>
          )}
        </GlassView>
        )}

        <GlassView style={[styles.shortcutsCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.shortcutsTitle, {color: colors.textSecondary}]}>{t('profile.shortcutsTitle')}</Text>
          <View style={styles.shortcutsRow}>
            <TouchableOpacity style={[styles.shortcutItem, {backgroundColor: colors.surface}]} onPress={() => navigation.navigate('Chats', {screen: 'Bookmarks'})}>
              <Icon name="bookmark" size={24} color={colors.text} style={styles.shortcutIcon} />
              <Text style={[styles.shortcutLabel, {color: colors.text}]}>{t('profile.shortcutSaved')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.shortcutItem, {backgroundColor: colors.surface}]} onPress={() => navigation.navigate('Chats', {screen: 'RecoveryPhrase'})}>
              <Icon name="key" size={24} color={colors.text} style={styles.shortcutIcon} />
              <Text style={[styles.shortcutLabel, {color: colors.text}]}>{t('profile.shortcutRecovery', 'Recovery Phrase')}</Text>
            </TouchableOpacity>
          </View>
        </GlassView>

        <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>
            {t('profile.visibilityTitle')}
          </Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            {t('profile.visibilityDescription')}
          </Text>
          {visibilityLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.visibilityLoader} />
          ) : (
            <View style={styles.visibilityOptions}>
              {visibilityOptions.map(option => {
                const selected = profileVisibility === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.visibilityOption,
                      {
                        backgroundColor: selected ? colors.primary : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => updateVisibility(option)}>
                    <Text
                      style={[
                        styles.visibilityOptionText,
                        {color: selected ? '#fff' : colors.text},
                      ]}>
                      {t(`profile.visibility.${option}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </GlassView>
       <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>
            {t('profile.languageTitle')}
          </Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            {t('profile.languageDescription')}
          </Text>
          <TouchableOpacity
            style={[styles.languageSelector, {backgroundColor: colors.surface, borderColor: colors.border}]}
            onPress={() => setLanguageModalVisible(true)}>
            <Text style={[styles.languageCurrentNative, {color: colors.text}]}>
              {currentLanguage.nativeLabel}
            </Text>
            <Text style={[styles.languageCurrentLabel, {color: colors.textSecondary}]}>
              {currentLanguage.label}
            </Text>
            <Text style={[styles.languageArrow, {color: colors.textSecondary}]}>{'>'}</Text>
          </TouchableOpacity>
        </GlassView>
        {/* Only the three controls whose values something actually reads. The
            store also carries watermark, auto-lock and screenshot-alert flags
            that nothing consults; giving those a switch would put a control on
            screen that changes nothing, which is the bug this section exists
            to stop repeating. */}
        <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>{t('profile.privacyTitle')}</Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            {t('profile.privacyDescription')}
          </Text>
          {PRIVACY_TOGGLES.map(toggle => {
            const on = privacy[toggle.key];
            return (
              <TouchableOpacity
                key={toggle.key}
                accessibilityRole="switch"
                accessibilityState={{checked: on}}
                accessibilityLabel={t(toggle.title)}
                accessibilityHint={t(toggle.hint)}
                style={[styles.privacyRow, {borderColor: colors.border}]}
                onPress={() => handlePrivacyToggle(toggle.key)}>
                <View style={styles.privacyRowText}>
                  <Text style={[styles.privacyRowTitle, {color: colors.text}]}>{t(toggle.title)}</Text>
                  <Text style={[styles.privacyRowHint, {color: colors.textSecondary}]}>{t(toggle.hint)}</Text>
                </View>
                {/* Green fill for on, hairline for off — the same signal the
                    visibility selectors above already use, so the row reads as
                    a control rather than a label. */}
                <Text
                  style={[
                    styles.privacyState,
                    {
                      backgroundColor: on ? colors.primary : 'transparent',
                      borderColor: on ? colors.primary : colors.border,
                      color: on ? colors.textOnPrimary : colors.textSecondary,
                    },
                  ]}>
                  {on ? t('profile.privacyOn') : t('profile.privacyOff')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </GlassView>
        <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>{t('tutorial.settingsTitle')}</Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            {t('tutorial.settingsDescription')}
          </Text>
          <TouchableOpacity style={[styles.focusBtn, {backgroundColor: colors.primary}]} onPress={() => startTutorial()}>
            <Text style={[styles.focusBtnText, {color: colors.textOnPrimary}]}>{t('tutorial.replay')}</Text>
          </TouchableOpacity>
        </GlassView>
        {SHOW_NATIVE_ONLY_FEATURES && (
        <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>
            Focus Mode
          </Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            Auto-reply to messages while you're busy
          </Text>
          {focusEnabled ? (
            <View>
              <View style={[styles.focusActiveBar, {backgroundColor: `${colors.success}20`}]}>
                <Text style={[styles.focusActiveText, {color: colors.success}]}>
                  Active until {focusUntil ? new Date(focusUntil).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '—'}
                </Text>
              </View>
              {focusAutoReply ? (
                <Text style={[styles.focusReplyPreview, {color: colors.textSecondary}]}>
                  Auto-reply: "{focusAutoReply}"
                </Text>
              ) : null}
              <TouchableOpacity
                style={[styles.focusBtn, {backgroundColor: colors.danger}]}
                onPress={handleDisableFocus}>
                <Text style={[styles.focusBtnText, {color: colors.textOnDanger}]}>Disable Focus Mode</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.focusBtn, {backgroundColor: colors.primary}]}
              onPress={() => setFocusModalVisible(true)}>
              <Text style={[styles.focusBtnText, {color: colors.textOnPrimary}]}>Enable Focus Mode</Text>
            </TouchableOpacity>
          )}
        </GlassView>
        )}
        <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>
            {t('aiConsent.settingsTitle')}
          </Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            {aiAllowed ? t('aiConsent.settingsOn') : t('aiConsent.settingsOff')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.focusBtn, {backgroundColor: aiAllowed ? colors.danger : colors.primary}]}
            onPress={async () => {
              if (aiAllowed) {
                await revokeAiConsent();
                setAiAllowed(false);
                Alert.alert(t('aiConsent.settingsTitle'), t('aiConsent.turnedOff'));
              } else {
                await grantAiConsent();
                setAiAllowed(true);
              }
            }}>
            <Text style={styles.focusBtnText}>
              {aiAllowed ? t('aiConsent.turnOff') : t('aiConsent.turnOn')}
            </Text>
          </TouchableOpacity>
        </GlassView>
        <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>
            {t('linkPreview.settingsTitle')}
          </Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            {previewsOn ? t('linkPreview.settingsOn') : t('linkPreview.settingsOff')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.focusBtn, {backgroundColor: previewsOn ? colors.danger : colors.primary}]}
            onPress={() => {
              setLinkPreviewEnabled(!previewsOn);
              setPreviewsOn(!previewsOn);
              if (previewsOn) {
                Alert.alert(t('linkPreview.settingsTitle'), t('linkPreview.turnedOff'));
              }
            }}>
            <Text style={styles.focusBtnText}>
              {previewsOn ? t('linkPreview.turnOff') : t('linkPreview.turnOn')}
            </Text>
          </TouchableOpacity>
        </GlassView>
        <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>
            {t('pro.title')}
            {isPro ? <Text style={{color: colors.primary}}>{`  ${t('pro.badge')}`}</Text> : null}
          </Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            {proStatusText}
          </Text>
        </GlassView>
        <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.visibilityTitle, {color: colors.text}]}>
            {t('profile.account.downloadDataTitle')}
          </Text>
          <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
            {t('profile.account.downloadDataDesc')}
          </Text>
          <TouchableOpacity
            style={[styles.focusBtn, {backgroundColor: colors.primary}, exportingData && {opacity: 0.5}]}
            disabled={exportingData}
            onPress={handleDownloadData}>
            {exportingData ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={[styles.focusBtnText, {color: colors.textOnPrimary}]}>{t('profile.account.downloadDataButton')}</Text>
            )}
          </TouchableOpacity>
          {exportDataError ? (
            <Text style={{color: colors.danger, fontSize: 12.5, marginTop: 8}}>{exportDataError}</Text>
          ) : null}
        </GlassView>
        {feedbackEnabled ? (
          <TouchableOpacity
            style={[styles.buttonSecondary, {backgroundColor: colors.primary}]}
            onPress={openFeedback}>
            <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('profile.buttons.feedback')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.buttonSecondary, {backgroundColor: colors.primary}]}
          onPress={handleExport}>
          <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('profile.buttons.export')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buttonSecondary, {backgroundColor: colors.primary}]}
          onPress={openImport}>
          <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('profile.buttons.import')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buttonSecondary, {backgroundColor: colors.surface}]}
          onPress={() => navigation.navigate('Chats', {screen: 'PrivacyPolicy'})}>
          <Text style={[styles.buttonText, {color: colors.textOnPrimary}, {color: colors.text}]}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buttonSecondary, {backgroundColor: colors.surface}]}
          onPress={() => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordVisible(true);
          }}>
          <Text style={[styles.buttonText, {color: colors.text}]}>
            {t('profile.buttons.changePassword')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, {backgroundColor: colors.danger}]} onPress={handleSignOut}>
          <Text style={[styles.buttonText, {color: colors.textOnDanger}]}>
            {t('profile.buttons.signOut')}
          </Text>
        </TouchableOpacity>
        {/* Kept visually apart from the routine actions above: this one is
            irreversible, so it should never sit flush against sign-out. */}
        <TouchableOpacity
          style={[styles.buttonSecondary, {borderWidth: 1, borderColor: colors.danger, marginTop: 24}]}
          onPress={handleDeleteAccount}>
          <Text style={[styles.buttonText, {color: colors.danger}]}>
            {t('profile.buttons.deleteAccount')}
          </Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      {passwordVisible && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setPasswordVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>
              {t('profile.account.changePasswordTitle')}
            </Text>
            <Text style={[styles.modalHint, {color: colors.textSecondary}]}>
              {t('profile.account.changePasswordDescription')}
            </Text>
            <PasswordInput
              style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder, minHeight: 48}]}
              placeholder={t('profile.account.currentPassword')}
              placeholderTextColor={colors.textSecondary}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
            />
            <PasswordInput
              style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder, minHeight: 48}]}
              placeholder={t('profile.account.newPassword')}
              placeholderTextColor={colors.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <PasswordInput
              style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder, minHeight: 48}]}
              placeholder={t('profile.account.confirmPassword')}
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[
                styles.button,
                {backgroundColor: colors.primary},
                (changingPassword || !currentPassword || !newPassword || !confirmPassword) && {opacity: 0.5},
              ]}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              onPress={submitPasswordChange}>
              {changingPassword ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('profile.account.changePasswordTitle')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSecondary, {backgroundColor: colors.surface}]}
              onPress={() => setPasswordVisible(false)}
              disabled={changingPassword}>
              <Text style={[styles.buttonText, {color: colors.text}]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
      )}

      {deleteVisible && (
        <Modal visible animationType="slide" transparent onRequestClose={() => !deleting && setDeleteVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.danger}]}>
              {t('profile.account.deleteTitle')}
            </Text>
            <Text style={[styles.modalHint, {color: colors.textSecondary}]}>
              {t('profile.account.deleteEnterPassword')}
            </Text>
            <PasswordInput
              style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder, minHeight: 48}]}
              placeholder={t('profile.account.currentPassword')}
              placeholderTextColor={colors.textSecondary}
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoCapitalize="none"
              editable={!deleting}
            />
            <TouchableOpacity
              style={[
                styles.button,
                {backgroundColor: colors.danger},
                (deleting || !deletePassword) && {opacity: 0.5},
              ]}
              disabled={deleting || !deletePassword}
              onPress={() => runDeletion(deletePassword)}>
              {deleting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('profile.account.deleteConfirm')}</Text>
              )}
            </TouchableOpacity>
            {deleting ? (
              <Text style={[styles.modalHint, {color: colors.textSecondary, textAlign: 'center'}]}>
                {t('profile.account.deleting')}
              </Text>
            ) : (
              <TouchableOpacity
                style={[styles.buttonSecondary, {backgroundColor: colors.surface}]}
                onPress={() => setDeleteVisible(false)}>
                <Text style={[styles.buttonText, {color: colors.text}]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            )}
          </SafeAreaView>
        </Modal>
      )}

      {exportVisible && (
        <Modal visible animationType="slide">
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>{t('profile.modals.exportTitle')}</Text>
            {exportText ? (
              <TextInput
                style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder}]}
                value={exportText}
                multiline
                editable={false}
              />
            ) : (
              <>
                <Text style={[styles.modalHint, {color: colors.textSecondary}]}>
                  {t('profile.modals.exportPassphraseHint', {min: MIN_BACKUP_PASSPHRASE_LENGTH})}
                </Text>
                <TextInput
                  style={[styles.passphraseInput, {color: colors.text, borderColor: colors.glassBorder}]}
                  value={exportPassphrase}
                  onChangeText={setExportPassphrase}
                  placeholder={t('profile.modals.passphrasePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}
            <View style={styles.modalActions}>
              {exportText ? (
                <TouchableOpacity
                  style={[styles.modalButton, {backgroundColor: colors.primary}]}
                  onPress={handleCopyExport}>
                  <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('common.copy')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.modalButton, {backgroundColor: colors.primary, opacity: exporting ? 0.6 : 1}]}
                  disabled={exporting}
                  onPress={handleGenerateExport}>
                  <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                    {exporting ? t('profile.modals.working') : t('profile.modals.encryptBackup')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => setExportVisible(false)}>
                <Text style={[styles.modalButtonText, {color: colors.text}]}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {importVisible && (
        <Modal visible animationType="slide">
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>{t('profile.modals.importTitle')}</Text>
            <TextInput
              style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder}]}
              value={importText}
              onChangeText={setImportText}
              placeholder={t('profile.modals.importPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <TextInput
              style={[styles.passphraseInput, {color: colors.text, borderColor: colors.glassBorder}]}
              value={importPassphrase}
              onChangeText={setImportPassphrase}
              placeholder={t('profile.modals.passphrasePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}]}
                onPress={handleImport}>
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('common.import')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => setImportVisible(false)}>
                <Text style={[styles.modalButtonText, {color: colors.text}]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {focusModalVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setFocusModalVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>Enable Focus Mode</Text>
            <Text style={[styles.focusLabel, {color: colors.textSecondary}]}>Duration (minutes)</Text>
            <View style={styles.focusDurationRow}>
              {[15, 30, 60, 120].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.focusDurationChip,
                    {
                      backgroundColor: focusDuration === String(m) ? colors.primary : colors.surface,
                      borderColor: focusDuration === String(m) ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setFocusDuration(String(m))}>
                  <Text
                    style={[
                      styles.focusDurationText,
                      {color: focusDuration === String(m) ? '#fff' : colors.text},
                    ]}>
                    {m < 60 ? `${m}m` : `${m / 60}h`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.focusLabel, {color: colors.textSecondary}]}>Auto-Reply Message</Text>
            <TextInput
              style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder, maxHeight: 120}]}
              value={focusMessage}
              onChangeText={setFocusMessage}
              placeholder="I'm busy right now..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}]}
                onPress={handleEnableFocus}>
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>Enable</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => setFocusModalVisible(false)}>
                <Text style={[styles.modalButtonText, {color: colors.text}]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {vsModalVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setVsModalVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>{t('profile.recordVoiceDiary')}</Text>
            <Text style={[styles.focusLabel, {color: colors.textSecondary}]}>
              {t('profile.voiceDiaryModalDescription')}
            </Text>
            <View style={styles.vsRecordArea}>
              <Text style={[styles.vsTimer, {color: colors.text}]}>{vsRecordedDuration}s</Text>
              {!vsRecording ? (
                <TouchableOpacity
                  style={[styles.vsRecordBtn, {backgroundColor: colors.danger}]}
                  onPress={handleVsStartRecording}>
                  <Text style={[styles.vsRecordBtnText, {color: colors.textOnDanger}]}>
                    {t('profile.voiceDiaryRecordButton')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.vsRecordBtn, {backgroundColor: colors.primary}]}
                  onPress={handleVsStopRecording}>
                  <Text style={[styles.vsRecordBtnText, {color: colors.textOnPrimary}]}>{t('profile.voiceDiaryStop')}</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {backgroundColor: colors.primary},
                  !vsRecordedUri && {opacity: 0.5},
                ]}
                onPress={handleVsSave}
                disabled={!vsRecordedUri}>
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('profile.voiceDiarySave')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => {
                  if (vsRecording) handleVsStopRecording();
                  setVsModalVisible(false);
                  setVsRecordedUri(null);
                  setVsRecordedDuration(0);
                }}>
                <Text style={[styles.modalButtonText, {color: colors.text}]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {languageModalVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setLanguageModalVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>{t('profile.languageTitle')}</Text>
            <TextInput
              style={[styles.languageSearchInput, {color: colors.text, borderColor: colors.glassBorder, backgroundColor: colors.surface}]}
              value={languageSearch}
              onChangeText={setLanguageSearch}
              placeholder={t('chatList.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
            />
            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
              {filteredLanguages.map(lang => {
                const isSelected = lang.code === currentLanguage.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.languageItem,
                      {
                        backgroundColor: isSelected ? colors.primary + '18' : 'transparent',
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleLanguageChange(lang.code)}>
                    <View style={styles.languageItemContent}>
                      <Text style={[styles.languageItemNative, {color: isSelected ? colors.primary : colors.text}]}>
                        {lang.nativeLabel}
                      </Text>
                      <Text style={[styles.languageItemLabel, {color: colors.textSecondary}]}>
                        {lang.label}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={[styles.languageCheck, {backgroundColor: colors.primary}]}>
                        <Icon name="check" size={14} color={colors.textOnPrimary} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: colors.surface, marginTop: 14}]}
              onPress={() => { setLanguageModalVisible(false); setLanguageSearch(''); }}>
              <Text style={[styles.modalButtonText, {color: colors.text}]}>{t('common.close')}</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
      )}

      {feedbackVisible && (
        <Modal visible animationType="slide">
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>{t('profile.modals.feedbackTitle')}</Text>
            <TextInput
              style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder}]}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder={t('profile.modals.feedbackPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}]}
                onPress={handleSendFeedback}>
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('common.send')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => setFeedbackVisible(false)}>
                <Text style={[styles.modalButtonText, {color: colors.text}]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  privacyRowText: {flex: 1},
  privacyRowTitle: {fontSize: 14, fontFamily: bodyWeight('600')},
  privacyRowHint: {fontSize: 12, marginTop: 2, lineHeight: 16},
  privacyState: {
    minWidth: 54,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: radius.sm,
    textAlign: 'center',
    fontFamily: monoFont,
    fontSize: 11,
    letterSpacing: 1,
    // Android clips a Text's background to the text box without this.
    overflow: 'hidden',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  profileCard: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    marginTop: 12,
    overflow: 'hidden',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  avatarText: {
    fontSize: 38,
    fontFamily: bodyWeight('800'),
    color: '#fff',
  },
  name: {
    fontSize: 20,
    fontFamily: fonts.display.bold,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  email: {
    fontSize: 15,
    lineHeight: 20,
  },
  memberBadge: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 2,
  },
  memberBadgeText: {
    fontSize: 12,
    fontFamily: bodyWeight('700'),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  section: {
    padding: 20,
    gap: 12,
  },
  shortcutsCard: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  shortcutsTitle: {fontSize: 11, fontFamily: bodyWeight('700'), letterSpacing: 0.5, marginBottom: 12},
  shortcutsRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 12},
  shortcutItem: {
    flex: 1,
    borderRadius: 2,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutIcon: {fontSize: 24, marginBottom: 6},
  shortcutLabel: {fontSize: 12, fontFamily: bodyWeight('600')},
  visibilityCard: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  visibilityTitle: {
    fontSize: 16,
    fontFamily: bodyWeight('700'),
    marginBottom: 4,
  },
  visibilityDescription: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  visibilityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityOption: {
    flex: 1,
    borderRadius: 2,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
  },
  visibilityOptionText: {
    fontSize: 13,
    fontFamily: bodyWeight('700'),
  },
  visibilityLoader: {
    paddingVertical: 8,
  },
  buttonSecondary: {
    borderRadius: 2,
    paddingVertical: 16,
    alignItems: 'center',
  },
  button: {
    borderRadius: 2,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: bodyWeight('700'),
    letterSpacing: 0.2,
  },
  modalContainer: {
    flex: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: bodyWeight('700'),
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  modalInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    padding: 16,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  modalHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  passphraseInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 2,
    alignItems: 'center',
  },
  modalButtonText: {
    fontFamily: bodyWeight('700'),
    fontSize: 16,
  },
  focusActiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 2,
    gap: 8,
    marginBottom: 8,
  },
  focusActiveText: {
    fontSize: 15,
    fontFamily: bodyWeight('700'),
  },
  focusReplyPreview: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  focusBtn: {
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: 'center',
  },
  focusBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: bodyWeight('700'),
  },
  focusLabel: {
    fontSize: 14,
    fontFamily: bodyWeight('600'),
    marginBottom: 8,
    marginTop: 8,
  },
  focusDurationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  focusDurationChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  focusDurationText: {
    fontSize: 14,
    fontFamily: bodyWeight('700'),
  },
  vsActiveRow: {
    flexDirection: 'row',
    gap: 10,
  },
  vsPlayBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: 'center',
  },
  vsPlayBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: bodyWeight('700'),
  },
  vsRecordArea: {
    alignItems: 'center',
    paddingVertical: 30,
    flex: 1,
    justifyContent: 'center',
  },
  vsTimer: {
    fontSize: 48,
    fontFamily: bodyWeight('200'),
    marginBottom: 20,
  },
  vsRecordBtn: {
    width: 80,
    height: 80,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsRecordBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: bodyWeight('700'),
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 2,
    borderWidth: 1,
  },
  languageCurrentNative: {
    fontSize: 16,
    fontFamily: bodyWeight('700'),
    flex: 1,
  },
  languageCurrentLabel: {
    fontSize: 13,
    marginEnd: 8,
  },
  languageArrow: {
    fontSize: 18,
    fontFamily: bodyWeight('600'),
  },
  languageSearchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  languageList: {
    flex: 1,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 2,
    borderWidth: 1,
    marginBottom: 6,
  },
  languageItemContent: {
    flex: 1,
  },
  languageItemNative: {
    fontSize: 16,
    fontFamily: bodyWeight('700'),
    marginBottom: 2,
  },
  languageItemLabel: {
    fontSize: 12,
  },
  languageCheck: {
    width: 26,
    height: 26,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageCheckText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: bodyWeight('800'),
  },
});

