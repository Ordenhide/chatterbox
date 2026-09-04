import React, {useState} from 'react';
import {Text, TouchableOpacity, StyleSheet, View, Alert, ActivityIndicator, useColorScheme} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../contexts/AuthContext';
import {isAppleSignInAvailable} from '../services/appleAuth';
import {getColors} from '../theme/colors';
import Icon from './Icon';
import {bodyWeight} from '../theme/typography';

/** Google's official "G" logomark — required as-is (not recolored to match
 * the app's monochrome Icon.tsx set) by Google's Sign-In branding
 * guidelines. */
function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </Svg>
  );
}

/** Apple's logomark. Like Google's above, it is reproduced as specified
 * rather than restyled to match the app's icon set — Apple's Human Interface
 * Guidelines treat the mark and the wording ("Sign in with Apple") as fixed,
 * and a review can be failed for altering either. */
function AppleLogo({color}: {color: string}) {
  return (
    <Svg width={20} height={20} viewBox="0 0 384 512">
      <Path
        fill={color}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  );
}

/** The Google/Phone sign-in row shared by LoginScreen and SignUpScreen —
 * both attach to the same account, so there's nothing sign-in-specific vs
 * sign-up-specific about the buttons themselves. */
export default function SocialSignInButtons() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const {signInWithGoogle, signInWithApple} = useAuth();
  const navigation = useNavigation<any>();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.errors.generic'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      await signInWithApple();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.errors.generic'));
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, {backgroundColor: colors.glassBorder}]} />
        <Text style={[styles.dividerText, {color: colors.textSecondary}]}>
          {t('auth.social.divider')}
        </Text>
        <View style={[styles.dividerLine, {backgroundColor: colors.glassBorder}]} />
      </View>

      {isAppleSignInAvailable() && (
        <TouchableOpacity
          style={[styles.button, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}
          onPress={handleAppleSignIn}
          disabled={appleLoading}>
          {appleLoading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <View style={styles.buttonIcon}>
                <AppleLogo color={colors.text} />
              </View>
              <Text style={[styles.buttonText, {color: colors.text}]}>
                {t('auth.social.apple')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}
        onPress={handleGoogleSignIn}
        disabled={googleLoading}>
        {googleLoading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <View style={styles.buttonIcon}>
              <GoogleLogo />
            </View>
            <Text style={[styles.buttonText, {color: colors.text}]}>{t('auth.social.google')}</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}
        onPress={() => navigation.navigate('PhoneAuth')}>
        <Icon name="phone" size={20} color={colors.text} style={styles.buttonIcon} />
        <Text style={[styles.buttonText, {color: colors.text}]}>{t('auth.social.phone')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 13,
    fontFamily: bodyWeight('600'),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 15,
    gap: 10,
  },
  buttonIcon: {
    marginRight: 2,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: bodyWeight('600'),
  },
});
