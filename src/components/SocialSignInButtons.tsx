import React, {useState} from 'react';
import {Text, TouchableOpacity, StyleSheet, View, Alert, ActivityIndicator, useColorScheme} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../contexts/AuthContext';
import {getColors} from '../theme/colors';
import Icon from './Icon';

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

/** The Google/Phone sign-in row shared by LoginScreen and SignUpScreen —
 * both attach to the same account, so there's nothing sign-in-specific vs
 * sign-up-specific about the buttons themselves. */
export default function SocialSignInButtons() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const {signInWithGoogle} = useAuth();
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

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, {backgroundColor: colors.glassBorder}]} />
        <Text style={[styles.dividerText, {color: colors.textSecondary}]}>
          {t('auth.social.divider')}
        </Text>
        <View style={[styles.dividerLine, {backgroundColor: colors.glassBorder}]} />
      </View>

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
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 15,
    gap: 10,
  },
  buttonIcon: {
    marginRight: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
