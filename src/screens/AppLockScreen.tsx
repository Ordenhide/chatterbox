/**
 * The lock screen — the thing the privacy policy has promised all along and
 * the app did not have.
 *
 * services/appLock.ts was complete and unreachable: scrypt at the same
 * parameters as the backup passphrase, a CSPRNG salt, a v2-to-v3 upgrade path,
 * and not one caller for setAppLockPIN, verifyPIN, disableAppLock,
 * authenticateWithBiometrics or setBiometricsEnabled. Three readers existed;
 * all three turned out to be prose inside .harmony.ts comments. Meanwhile
 * section 8 of the policy said, in fifteen languages, "Lock the app with a PIN
 * or biometrics."
 *
 * ## Why this overlays rather than replaces
 *
 * Mounted above the app tree, the way ColdOpen is. Replacing the navigator
 * would unmount every open chat on every lock and rebuild it on every unlock —
 * which means re-decrypting a thread to look at it again, and a ratchet
 * envelope does not open twice. Covering it costs nothing and keeps the
 * session intact.
 *
 * ## What it deliberately does not offer
 *
 * No cancel, no "forgot PIN", no attempt counter. The first two would be the
 * lock not locking. The third sounds like hardening and is not: the stored
 * record is scrypt at ~100ms per guess, so throttling in the UI protects
 * nothing an attacker with the device's files would have to go through, while
 * a wipe-after-N-tries hands anyone who picks up the phone a way to destroy
 * the account.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {getColors, radius} from '../theme/colors';
import {fonts, terminal} from '../theme/typography';
import {
  authenticateWithBiometrics,
  isBiometricsAvailable,
  isBiometricsEnabled,
  verifyPIN,
} from '../services/appLock';

export default function AppLockScreen({onUnlocked}: {onUnlocked: () => void}) {
  const {t} = useTranslation();
  const colors = getColors(useColorScheme());
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [checking, setChecking] = useState(false);
  const [biometricsOffered, setBiometricsOffered] = useState(false);
  // One automatic prompt per mount. Without this, a dismissed prompt would be
  // re-raised by the re-render its own dismissal causes.
  const promptedRef = useRef(false);

  const tryBiometrics = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      if (await authenticateWithBiometrics(t('appLock.prompt'))) onUnlocked();
    } finally {
      setChecking(false);
    }
  }, [checking, onUnlocked, t]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isBiometricsEnabled() || !(await isBiometricsAvailable())) return;
      if (!active) return;
      setBiometricsOffered(true);
      if (promptedRef.current) return;
      promptedRef.current = true;
      void tryBiometrics();
    })();
    return () => {
      active = false;
    };
    // Deliberately once per mount: tryBiometrics changes identity with
    // `checking`, and depending on it would re-prompt the moment a prompt
    // resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!pin || checking) return;
    setChecking(true);
    setWrong(false);
    try {
      if (await verifyPIN(pin)) {
        onUnlocked();
        return;
      }
      // Cleared, so a wrong PIN cannot be "corrected" by appending a digit.
      setPin('');
      setWrong(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <Text style={[styles.title, {color: colors.text}]}>{t('appLock.title')}</Text>
      <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
        {t('appLock.subtitle')}
      </Text>

      <TextInput
        style={[styles.pin, {color: colors.text, borderColor: wrong ? colors.danger : colors.glassBorder}]}
        value={pin}
        onChangeText={text => {
          setWrong(false);
          setPin(text.replace(/\D/g, ''));
        }}
        placeholder={t('appLock.pinPlaceholder')}
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        secureTextEntry
        autoFocus={!biometricsOffered}
        // A PIN has no business reaching a keyboard's learned words, a
        // password manager, or a spellchecker.
        autoComplete="off"
        autoCorrect={false}
        importantForAutofill="no"
        onSubmitEditing={submit}
        returnKeyType="go"
        maxLength={12}
        accessibilityLabel={t('appLock.pinPlaceholder')}
      />

      {wrong ? (
        <Text style={[styles.wrong, {color: colors.danger}]}>{t('appLock.wrong')}</Text>
      ) : null}

      <Pressable
        style={[styles.button, {backgroundColor: colors.primary, opacity: pin && !checking ? 1 : 0.5}]}
        disabled={!pin || checking}
        accessibilityRole="button"
        onPress={submit}>
        {checking ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
            {t('appLock.unlock')}
          </Text>
        )}
      </Pressable>

      {biometricsOffered ? (
        <Pressable
          style={styles.biometrics}
          disabled={checking}
          accessibilityRole="button"
          onPress={tryBiometrics}>
          <Text style={[styles.biometricsText, {color: colors.primary}]}>
            {t('appLock.useBiometrics')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    ...terminal.label,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
  },
  pin: {
    width: '100%',
    maxWidth: 260,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fonts.mono.regular,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
  },
  wrong: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    maxWidth: 260,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: fonts.body.semibold,
    fontSize: 15,
  },
  biometrics: {
    marginTop: 22,
    paddingVertical: 8,
  },
  biometricsText: {
    ...terminal.label,
  },
});
