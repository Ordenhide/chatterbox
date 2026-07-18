import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, TextInput, useColorScheme} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {getColors} from '../theme/colors';
import GlassScreen from '../components/GlassScreen';
import GlassView from '../components/GlassView';
import {useNavigation} from '@react-navigation/native';
import {
  isAppLockEnabled,
  setAppLockPIN,
  disableAppLock,
  isBiometricsEnabled,
  setBiometricsEnabled,
  isBiometricsAvailable,
  setDecoyPIN,
  getDecoyPIN,
} from '../services/appLock';
import {
  isScreenshotProtectionEnabled,
  setScreenshotProtection,
  applyScreenshotProtection,
  getScreenshotAlertEnabled,
  setScreenshotAlert,
  isStealthMode,
  setStealthMode,
  isExifStrippingEnabled,
  setExifStripping,
  isWatermarkEnabled,
  setWatermark,
  isLinkPreviewEnabled,
  setLinkPreviewEnabled,
  isNotificationContentHidden,
  setNotificationContentHidden,
  getAutoLockDelay,
  setAutoLockDelay,
} from '../services/privacyGuard';
import {getDeadManSwitch, setDeadManSwitch, checkInDeadMan} from '../services/messageExpiry';
import {doc, getFirestore, onSnapshot} from '@react-native-firebase/firestore';

function computeScore(s: {
  appLock: boolean;
  biometrics: boolean;
  screenshot: boolean;
  stealth: boolean;
  exif: boolean;
  watermark: boolean;
  linkPreviewOff: boolean;
  deadMan: boolean;
  decoy: boolean;
  screenshotAlert: boolean;
}) {
  let score = 0;
  if (s.appLock) score += 15;
  if (s.biometrics) score += 10;
  if (s.screenshot) score += 10;
  if (s.stealth) score += 15;
  if (s.exif) score += 10;
  if (s.watermark) score += 5;
  if (s.linkPreviewOff) score += 5;
  if (s.deadMan) score += 10;
  if (s.decoy) score += 10;
  if (s.screenshotAlert) score += 10;
  return score;
}

export default function PrivacyDashboardScreen() {
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const navigation = useNavigation();

  const [appLock, setAppLock] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [screenshot, setScreenshot] = useState(false);
  const [ssAlert, setSsAlert] = useState(false);
  const [stealth, setStealth] = useState(false);
  const [exif, setExif] = useState(false);
  const [wm, setWm] = useState(false);
  const [linkPreview, setLinkPreview] = useState(true);
  const [deadMan, setDeadMan] = useState(false);
  const [deadManDays, setDeadManDays] = useState(90);
  const [decoySet, setDecoySet] = useState(false);
  const [hideNotifContent, setHideNotifContent] = useState(false);
  const [autoLockDelay, setAutoLockDelayState] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<{
    deviceName?: string;
    platform?: string;
    sessionClaimedAt?: Date;
    sessionHeartbeatAt?: Date;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [bioAvail, dms, decoyPin] = await Promise.all([
        isBiometricsAvailable(),
        getDeadManSwitch(),
        getDecoyPIN(),
      ]);
      if (!active) return;
      setAppLock(isAppLockEnabled());
      setBiometrics(isBiometricsEnabled());
      setBioAvailable(bioAvail);
      setScreenshot(isScreenshotProtectionEnabled());
      setSsAlert(getScreenshotAlertEnabled());
      setStealth(isStealthMode());
      setExif(isExifStrippingEnabled());
      setWm(isWatermarkEnabled());
      setLinkPreview(isLinkPreviewEnabled());
      setHideNotifContent(isNotificationContentHidden());
      setAutoLockDelayState(getAutoLockDelay());
      setDeadMan(dms.enabled);
      setDeadManDays(dms.days);
      setDecoySet(decoyPin !== null);
    };
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirestore();
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      const data = snap.data() as any;
      if (!data) return;
      const claimed = data.sessionClaimedAt?.toDate?.() ?? null;
      const heartbeat = data.sessionHeartbeatAt?.toDate?.() ?? null;
      setSessionInfo({
        deviceName: data.deviceInfo?.deviceName ?? undefined,
        platform: data.deviceInfo?.platform ?? undefined,
        sessionClaimedAt: claimed,
        sessionHeartbeatAt: heartbeat,
      });
    });
    return () => unsub();
  }, [user?.uid]);

  const score = computeScore({
    appLock,
    biometrics,
    screenshot,
    stealth,
    exif,
    watermark: wm,
    linkPreviewOff: !linkPreview,
    deadMan,
    decoy: decoySet,
    screenshotAlert: ssAlert,
  });

  const scoreColor = score >= 70 ? colors.success : score >= 40 ? colors.warning : colors.danger;
  const scoreLabel = score >= 70 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Improvement';

  const toggleAppLock = useCallback((val: boolean) => {
    if (val) {
      Alert.prompt('Set PIN', 'Enter a 4-digit PIN to lock the app', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Set',
          onPress: async (pin?: string) => {
            if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
              Alert.alert('Invalid', 'PIN must be exactly 4 digits.');
              return;
            }
            await setAppLockPIN(pin);
            setAppLock(true);
          },
        },
      ], 'plain-text', '', 'number-pad');
    } else {
      disableAppLock().then(() => {
        setAppLock(false);
        setBiometrics(false);
      });
    }
  }, []);

  const toggleBiometrics = useCallback((val: boolean) => {
    setBiometricsEnabled(val);
    setBiometrics(val);
  }, []);

  const handleDecoyPIN = useCallback(() => {
    Alert.prompt('Decoy PIN', 'Enter a 4-digit decoy PIN (must differ from your real PIN)', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Set',
        onPress: async (pin?: string) => {
          if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            Alert.alert('Invalid', 'PIN must be exactly 4 digits.');
            return;
          }
          await setDecoyPIN(pin);
          setDecoySet(true);
        },
      },
    ], 'plain-text', '', 'number-pad');
  }, []);

  const toggleStealth = useCallback(async (val: boolean) => {
    if (!user?.uid) return;
    setStealth(val);
    await setStealthMode(val, user.uid);
  }, [user?.uid]);

  const toggleScreenshot = useCallback((val: boolean) => {
    setScreenshotProtection(val);
    applyScreenshotProtection(val);
    setScreenshot(val);
  }, []);

  const toggleHideNotifContent = useCallback((val: boolean) => {
    setNotificationContentHidden(val);
    setHideNotifContent(val);
  }, []);

  const handleAutoLockDelay = useCallback((seconds: number) => {
    setAutoLockDelay(seconds);
    setAutoLockDelayState(seconds);
  }, []);

  const toggleSsAlert = useCallback((val: boolean) => {
    setScreenshotAlert(val);
    setSsAlert(val);
  }, []);

  const toggleExif = useCallback((val: boolean) => {
    setExifStripping(val);
    setExif(val);
  }, []);

  const toggleWatermark = useCallback((val: boolean) => {
    setWatermark(val);
    setWm(val);
  }, []);

  const toggleLinkPreview = useCallback((val: boolean) => {
    setLinkPreviewEnabled(val);
    setLinkPreview(val);
  }, []);

  const toggleDeadMan = useCallback(async (val: boolean) => {
    setDeadMan(val);
    await setDeadManSwitch(val, deadManDays);
  }, [deadManDays]);

  const selectDeadManDays = useCallback(async (days: number) => {
    setDeadManDays(days);
    if (deadMan) {
      await setDeadManSwitch(true, days);
    }
  }, [deadMan]);

  const handleCheckIn = useCallback(async () => {
    await checkInDeadMan();
    Alert.alert('Checked In', 'Dead man\'s switch timer has been reset.');
  }, []);

  const renderToggle = (label: string, value: boolean, onToggle: (v: boolean) => void, subtitle?: string) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLabel}>
        <Text style={[styles.toggleText, {color: colors.text}]}>{label}</Text>
        {subtitle ? <Text style={[styles.toggleSubtitle, {color: colors.textSecondary}]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{false: colors.inputBackground, true: colors.primary}}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <GlassScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <GlassView style={[styles.scoreCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.scoreLabel, {color: colors.textSecondary}]}>Privacy Score</Text>
          <Text style={[styles.scoreNumber, {color: scoreColor}]}>{score}</Text>
          <Text style={[styles.scoreMax, {color: colors.textSecondary}]}>/ 100</Text>
          <View style={[styles.scoreBadge, {backgroundColor: scoreColor + '20'}]}>
            <Text style={[styles.scoreBadgeText, {color: scoreColor}]}>{scoreLabel}</Text>
          </View>
        </GlassView>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>App Lock</Text>
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            {renderToggle('App Lock', appLock, toggleAppLock)}
            {appLock && bioAvailable ? renderToggle('Biometrics', biometrics, toggleBiometrics) : null}
            {appLock ? (
              <>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLabel}>
                    <Text style={[styles.toggleText, {color: colors.text}]}>Auto-Lock Timer</Text>
                    <Text style={[styles.toggleSubtitle, {color: colors.textSecondary}]}>Lock after returning from background</Text>
                  </View>
                </View>
                <View style={styles.daysRow}>
                  {([
                    {label: 'Immediately', value: 0},
                    {label: '1 min', value: 60},
                    {label: '5 min', value: 300},
                    {label: '15 min', value: 900},
                  ] as const).map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: autoLockDelay === opt.value ? colors.primary : colors.surface,
                          borderColor: autoLockDelay === opt.value ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => handleAutoLockDelay(opt.value)}>
                      <Text style={[styles.dayChipText, {color: autoLockDelay === opt.value ? '#fff' : colors.text}]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: colors.primaryLight}]} onPress={handleDecoyPIN}>
                  <Text style={[styles.actionBtnText, {color: colors.primary}]}>
                    {decoySet ? 'Change Decoy PIN' : 'Set Decoy PIN'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </GlassView>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>Privacy</Text>
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            {renderToggle('Stealth Mode', stealth, toggleStealth, 'Hide online, typing & read receipts')}
            {renderToggle('Screenshot Protection', screenshot, toggleScreenshot)}
            {renderToggle('Screenshot Alerts', ssAlert, toggleSsAlert)}
            {renderToggle('Strip Photo Metadata', exif, toggleExif)}
            {renderToggle('Invisible Watermark', wm, toggleWatermark)}
            {renderToggle('Disable Link Previews', !linkPreview, v => toggleLinkPreview(!v))}
            {renderToggle('Hide Notification Content', hideNotifContent, toggleHideNotifContent, 'Show generic alerts instead of message content')}
          </GlassView>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>Account Safety</Text>
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            {renderToggle('Dead Man\'s Switch', deadMan, toggleDeadMan, `Wipe data after ${deadManDays} days of inactivity`)}
            {deadMan ? (
              <>
                <View style={styles.daysRow}>
                  {[30, 60, 90].map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: deadManDays === d ? colors.primary : colors.surface,
                          borderColor: deadManDays === d ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => selectDeadManDays(d)}>
                      <Text style={[styles.dayChipText, {color: deadManDays === d ? '#fff' : colors.text}]}>
                        {d} days
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: colors.success + '18'}]} onPress={handleCheckIn}>
                  <Text style={[styles.actionBtnText, {color: colors.success}]}>Check In Now</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: colors.primaryLight}]} onPress={() => {}}>
              <Text style={[styles.actionBtnText, {color: colors.primary}]}>Trusted Contacts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: colors.primaryLight}]}
              onPress={() => navigation.navigate('SecureVault' as never)}>
              <Text style={[styles.actionBtnText, {color: colors.primary}]}>Secure Vault</Text>
            </TouchableOpacity>
          </GlassView>
        </View>
        {sessionInfo ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>Account Activity</Text>
            <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
              <View style={styles.sessionRow}>
                <Text style={[styles.sessionLabel, {color: colors.textSecondary}]}>Device</Text>
                <Text style={[styles.sessionValue, {color: colors.text}]}>
                  {sessionInfo.deviceName ?? 'Unknown Device'}
                  {sessionInfo.platform ? ` (${sessionInfo.platform})` : ''}
                </Text>
              </View>
              <View style={styles.sessionRow}>
                <Text style={[styles.sessionLabel, {color: colors.textSecondary}]}>Session Started</Text>
                <Text style={[styles.sessionValue, {color: colors.text}]}>
                  {sessionInfo.sessionClaimedAt
                    ? sessionInfo.sessionClaimedAt.toLocaleString()
                    : '—'}
                </Text>
              </View>
              <View style={styles.sessionRow}>
                <Text style={[styles.sessionLabel, {color: colors.textSecondary}]}>Last Activity</Text>
                <Text style={[styles.sessionValue, {color: colors.text}]}>
                  {sessionInfo.sessionHeartbeatAt
                    ? sessionInfo.sessionHeartbeatAt.toLocaleString()
                    : '—'}
                </Text>
              </View>
            </GlassView>
          </View>
        ) : null}
      </ScrollView>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  scoreCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 28,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -2,
  },
  scoreMax: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: -4,
    marginBottom: 12,
  },
  scoreBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  scoreBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  toggleLabel: {
    flex: 1,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sessionRow: {
    paddingVertical: 10,
  },
  sessionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  sessionValue: {
    fontSize: 15,
    fontWeight: '500',
  },
});
