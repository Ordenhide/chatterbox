import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {getColors, monoFont, radius} from '../theme/colors';
import {getBooleanFlag} from '../services/featureFlags';
import {submitFeedback} from '../services/feedback';
import {reportError} from '../services/errorLog';
import {useFocusEffect} from '@react-navigation/native';
import {doc, getFirestore, onSnapshot} from '../services/firebase/firestore';
import GlassView from '../components/GlassView';
import GlassScreen from '../components/GlassScreen';
import Icon from '../components/Icon';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import i18n, {LANGUAGES} from '../i18n';
import {applyLayoutDirection} from '../i18n/rtl';
import {PRIVACY_TOGGLES, type PrivacyKey} from '../services/privacyToggles';
import {startTutorial} from '../services/tutorial';
import {SHOW_AI_FEATURES} from '../config/launch';
import {useNavigation} from '@react-navigation/native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {
  deleteAccount,
  type AccountActionError,
} from '../services/account';
import {exportUserData} from '../services/dataExport';
import {checkForUpdate} from '../services/updateCheck';
import {grantAiConsent, hasAiConsent, revokeAiConsent} from '../services/aiConsent';
import {isLinkPreviewEnabled, setLinkPreviewEnabled} from '../services/privacyGuard';
import {
  disableAppLock,
  isAppLockEnabled,
  isBiometricsAvailable,
  isBiometricsEnabled,
  setAppLockPIN,
  setBiometricsEnabled,
} from '../services/appLock';
import {shareTextFile} from '../utils/shareFile';
import {guardDocSnapshot} from '../services/snapshotGuard';
import {bodyWeight, fonts} from '../theme/typography';

export default function ProfileScreen() {
  const {user, signOut} = useAuth();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();
  // Change-password / delete-account flows.
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [deleting, setDeleting] = useState(false);
  // Backups are encrypted under a passphrase the user chooses; it is never
  // persisted, so losing it means losing the backup.
  const [exportingData, setExportingData] = useState(false);
  // The app lock. Four digits minimum is the service's floor, not a UI
  // preference: scrypt makes each guess cost ~100ms, and below four digits
  // the keyspace is small enough that the cost stops mattering.
  const [lockEnabled, setLockEnabled] = useState(() => isAppLockEnabled());
  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [lockPin, setLockPin] = useState('');
  const [lockConfirm, setLockConfirm] = useState('');
  const [lockError, setLockError] = useState('');
  const [biometricsOn, setBiometricsOn] = useState(() => isBiometricsEnabled());
  const [biometricsUsable, setBiometricsUsable] = useState(false);
  const [exportDataError, setExportDataError] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
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
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  const vsRecorderRef = useRef(new AudioRecorderPlayer());
  const db = useMemo(() => getFirestore(), []);
  const navigation = useNavigation<any>();

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

  useEffect(() => {
    let active = true;
    isBiometricsAvailable()
      .then(available => {
        if (active) setBiometricsUsable(available);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const saveLockPin = useCallback(async () => {
    if (lockPin.length < 4) {
      setLockError(t('profile.appLock.tooShort'));
      return;
    }
    if (lockPin !== lockConfirm) {
      setLockError(t('profile.appLock.mismatch'));
      return;
    }
    try {
      await setAppLockPIN(lockPin);
      setLockEnabled(true);
      setLockModalVisible(false);
      setLockPin('');
      setLockConfirm('');
      setLockError('');
    } catch (error) {
      reportError(error, 'app_lock_set_failed');
      setLockError(t('errors.generic'));
    }
  }, [lockPin, lockConfirm, t]);

  const removeLock = useCallback(() => {
    Alert.alert(t('profile.appLock.removeTitle'), t('profile.appLock.removeBody'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await disableAppLock();
          setLockEnabled(false);
          // Pointless on its own, and misleading left on: the switch would
          // read "unlock with biometrics" with nothing to unlock.
          setBiometricsEnabled(false);
          setBiometricsOn(false);
        },
      },
    ]);
  }, [t]);

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
    return user?.displayName?.[0]?.toUpperCase() || 'U';
  }, [user?.displayName]);

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
        // The profile document is still listened to, but nothing on this
        // screen reads a field from it any more — focus mode and the voice
        // diary were the two that did. Kept as a live subscription so the
        // screen still reacts to the document disappearing (account deleted
        // on another device), which the error handler below covers.
        guardDocSnapshot('listen_profile', () => {}),
        error => {
          reportError(error, 'profile_listener');
          if (__DEV__) {
            console.error('profile listener failed:', error);
          }
        },
      );
      return () => unsub();
    }, [user?.uid, db]),
  );

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

  // Matched case-insensitively after trimming: the word is a deliberate
  // speed bump, not a password, and failing someone for a stray space or an
  // autocapitalised keyboard would only teach them to paste it.
  const deleteConfirmed =
    deleteWord.trim().toUpperCase() === t('profile.account.deleteConfirmWord').toUpperCase();

  const accountErrorMessage = useCallback(
    (reason: AccountActionError | undefined) =>
      reason === 'no-device-key'
        ? t('profile.account.deleteNoKey')
        : reason === 'too-many-requests'
        ? t('profile.account.tooManyRequests')
        : t('profile.account.genericError'),
    [t],
  );

  const runDeletion = useCallback(
    async () => {
      setDeleting(true);
      try {
        const report = await deleteAccount();
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
            ? accountErrorMessage((error as any).reason)
            : t('profile.account.deleteFailed'),
        );
      }
    },
    [accountErrorMessage, t],
  );

  /**
   * Two-step confirmation: an explicit summary of what is destroyed, then a
   * word typed by hand. The action is irreversible and cannot be undone by
   * support — the data is genuinely gone, not flagged — so a single tap must
   * never be enough to trigger it.
   *
   * It used to ask for the account password at the second step. There is no
   * password any more, and asking the user to retype the recovery phrase
   * would be asking for a secret this device is already holding — see
   * reauthenticate in services/account.ts.
   */
  const handleDeleteAccount = useCallback(() => {
    Alert.alert(t('profile.account.deleteTitle'), t('profile.account.deleteWhatHappens'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('profile.account.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          setDeleteWord('');
          setDeleteVisible(true);
        },
      },
    ]);
  }, [t]);

  // "Download my data": a human-readable, decrypted copy of the account's
  // Firestore data (profile, conversations, moments, social graph), distinct
  // from Export Backup below, which produces an encrypted, still-ciphertext
  // bundle meant only for restoring onto another device.
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

  // Android only: this app isn't on Google Play, so nothing updates it in the
  // background — the one request this sends happens because this button was
  // tapped, never on a timer or at launch. See src/services/updateCheck.ts.
  const handleCheckForUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      const result = await checkForUpdate();
      if (result.status === 'update-available') {
        Alert.alert(
          t('profile.alerts.checkUpdatesAvailableTitle'),
          t('profile.alerts.checkUpdatesAvailableBody', {version: result.versionName}),
          [
            {text: t('common.cancel'), style: 'cancel'},
            {
              text: t('profile.alerts.checkUpdatesAvailableOpenButton'),
              onPress: () => {
                Linking.openURL('https://chatterbox.app/#download').catch(() => {});
              },
            },
          ],
        );
      } else if (result.status === 'up-to-date') {
        Alert.alert(t('profile.alerts.checkUpdatesUpToDateTitle'), t('profile.alerts.checkUpdatesUpToDateBody'));
      } else {
        Alert.alert(t('profile.alerts.checkUpdatesFailedTitle'), t('profile.alerts.checkUpdatesFailedBody'));
      }
    } finally {
      setCheckingUpdate(false);
    }
  }, [t]);

  const openFeedback = useCallback(() => {
    setFeedbackVisible(true);
  }, []);

  const handleSendFeedback = useCallback(async () => {
    if (!user?.uid) return;
    const trimmed = feedbackText.trim();
    if (!trimmed) return;
    try {
      await submitFeedback({userId: user.uid, message: trimmed});
      setFeedbackText('');
      setFeedbackVisible(false);
      Alert.alert(t('profile.alerts.feedbackSuccessTitle'), t('profile.alerts.feedbackSuccessBody'));
    } catch (error) {
      reportError(error, 'feedback_submit_failed');
      Alert.alert(t('profile.alerts.feedbackFailedTitle'), t('profile.alerts.feedbackFailedBody'));
    }
  }, [feedbackText, user?.uid, t]);

  return (
    <GlassScreen style={styles.container} textureSeed="profile">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <GlassView style={[styles.profileCard, {borderColor: colors.glassBorder}]}>
        <View style={[styles.profileSection, {borderBottomColor: colors.border}]}>
          <View style={[styles.avatar, {backgroundColor: colors.primary}]}>
            <Text style={[styles.avatarText, {color: colors.textOnPrimary}]}>{profileInitial}</Text>
          </View>
          <Text style={[styles.name, {color: colors.text}]}>{user?.displayName || t('profile.defaultName')}</Text>
          {/* The account's address used to be shown here. It is now the derived
              login handle — thirty-two hex characters at a .invalid domain —
              so this line rendered a fake email address on the one screen a
              user checks to find out what their account is, directly under a
              privacy policy that says there is no email address. Nothing
              replaces it: the name and the badge already say who this is. */}
          <View style={[styles.memberBadge, {backgroundColor: colors.primaryLight}]}>
            <Text style={[styles.memberBadgeText, {color: colors.primary}]}>{t('profile.memberBadge')}</Text>
          </View>
        </View>
      </GlassView>

      <View style={styles.section}>

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
            {/* The only way to read the policy from inside the app used to be
                the link on the sign-up screen — so once you had an account,
                the document describing what the app does with your messages
                was unreachable from it. */}
            <TouchableOpacity
              style={[styles.shortcutItem, {backgroundColor: colors.surface}]}
              onPress={() => navigation.navigate('Chats', {screen: 'PrivacyPolicy'})}>
              <Icon name="shield" size={24} color={colors.text} style={styles.shortcutIcon} />
              <Text style={[styles.shortcutLabel, {color: colors.text}]}>
                {t('profile.shortcutPrivacy')}
              </Text>
            </TouchableOpacity>
          </View>
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
        {SHOW_AI_FEATURES && (
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
        )}
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
        {Platform.OS === 'android' ? (
          <GlassView style={[styles.visibilityCard, {borderColor: colors.glassBorder}]}>
            <Text style={[styles.visibilityTitle, {color: colors.text}]}>
              {t('profile.account.checkUpdatesTitle')}
            </Text>
            <Text style={[styles.visibilityDescription, {color: colors.textSecondary}]}>
              {t('profile.account.checkUpdatesDesc')}
            </Text>
            <TouchableOpacity
              style={[styles.focusBtn, {backgroundColor: colors.primary}, checkingUpdate && {opacity: 0.5}]}
              disabled={checkingUpdate}
              onPress={handleCheckForUpdate}>
              {checkingUpdate ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={[styles.focusBtnText, {color: colors.textOnPrimary}]}>
                  {t('profile.account.checkUpdatesButton')}
                </Text>
              )}
            </TouchableOpacity>
          </GlassView>
        ) : null}
        <TouchableOpacity
          style={[styles.buttonSecondary, {backgroundColor: lockEnabled ? colors.surface : colors.primary}]}
          onPress={() => (lockEnabled ? removeLock() : setLockModalVisible(true))}>
          <Text
            style={[
              styles.buttonText,
              {color: lockEnabled ? colors.text : colors.textOnPrimary},
            ]}>
            {lockEnabled ? t('profile.buttons.appLockOff') : t('profile.buttons.appLock')}
          </Text>
        </TouchableOpacity>
        {lockEnabled && biometricsUsable ? (
          <View style={[styles.privacyRow, {borderTopColor: colors.glassBorder}]}>
            <View style={styles.privacyRowText}>
              <Text style={[styles.privacyRowTitle, {color: colors.text}]}>
                {t('profile.appLock.biometrics')}
              </Text>
            </View>
            <Switch
              value={biometricsOn}
              onValueChange={(next: boolean) => {
                setBiometricsEnabled(next);
                setBiometricsOn(next);
              }}
            />
          </View>
        ) : null}
        {feedbackEnabled ? (
          <TouchableOpacity
            style={[styles.buttonSecondary, {backgroundColor: colors.primary}]}
            onPress={openFeedback}>
            <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('profile.buttons.feedback')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.buttonSecondary, {backgroundColor: colors.surface}]}
          onPress={() => navigation.navigate('Chats', {screen: 'PrivacyPolicy'})}>
          <Text style={[styles.buttonText, {color: colors.textOnPrimary}, {color: colors.text}]}>
            {t('privacy.title')}
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

      {deleteVisible && (
        <Modal visible animationType="slide" transparent onRequestClose={() => !deleting && setDeleteVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.danger}]}>
              {t('profile.account.deleteTitle')}
            </Text>
            <Text style={[styles.modalHint, {color: colors.textSecondary}]}>
              {t('profile.account.deleteTypeWord', {word: t('profile.account.deleteConfirmWord')})}
            </Text>
            <TextInput
              style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder, minHeight: 48}]}
              placeholder={t('profile.account.deleteConfirmWord')}
              placeholderTextColor={colors.textSecondary}
              value={deleteWord}
              onChangeText={setDeleteWord}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />
            <TouchableOpacity
              style={[
                styles.button,
                {backgroundColor: colors.danger},
                (deleting || !deleteConfirmed) && {opacity: 0.5},
              ]}
              disabled={deleting || !deleteConfirmed}
              onPress={runDeletion}>
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

      {lockModalVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setLockModalVisible(false)}>
          <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>{t('profile.appLock.setTitle')}</Text>
            <Text style={{color: colors.textSecondary, fontSize: 13, marginBottom: 16}}>
              {t('profile.appLock.hint')}
            </Text>
            <TextInput
              style={[styles.passphraseInput, {color: colors.text, borderColor: colors.glassBorder}]}
              value={lockPin}
              onChangeText={text => {
                setLockError('');
                setLockPin(text.replace(/\D/g, ''));
              }}
              placeholder={t('profile.appLock.pin')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={12}
              autoComplete="off"
              autoCorrect={false}
              importantForAutofill="no"
            />
            <TextInput
              style={[styles.passphraseInput, {color: colors.text, borderColor: colors.glassBorder}]}
              value={lockConfirm}
              onChangeText={text => {
                setLockError('');
                setLockConfirm(text.replace(/\D/g, ''));
              }}
              placeholder={t('profile.appLock.confirm')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={12}
              autoComplete="off"
              autoCorrect={false}
              importantForAutofill="no"
            />
            {lockError ? (
              <Text style={{color: colors.danger, fontSize: 13, marginTop: 4}}>{lockError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}]}
                onPress={saveLockPin}>
                <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('common.save')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => {
                  setLockModalVisible(false);
                  setLockPin('');
                  setLockConfirm('');
                  setLockError('');
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
              placeholder={t('profile.languageSearchPlaceholder')}
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
            {/* `flex: 0` deliberately. `modalButton` carries `flex: 1` because
                it was written for a row of buttons that share the width; used
                alone in a column it takes an equal share of the *height*
                instead, and here it claimed 893px next to the list's 820. With
                two languages the list still fit and nobody noticed; with
                fifteen it cut off at Français and left a third of the screen
                blank below the button. */}
            <TouchableOpacity
              style={[styles.modalButton, {flex: 0, backgroundColor: colors.surface, marginTop: 14}]}
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

