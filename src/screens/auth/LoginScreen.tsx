import React, {useEffect, useState} from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  useColorScheme,
} from 'react-native';
import {useAuth} from '../../contexts/AuthContext';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getColors} from '../../theme/colors';
import {getStringFlag} from '../../services/featureFlags';
import {trackEvent} from '../../services/telemetry';
import GlassView from '../../components/GlassView';
import GlassScreen from '../../components/GlassScreen';
import PasswordInput from '../../components/PasswordInput';
import SocialSignInButtons from '../../components/SocialSignInButtons';
import Cascade from '../../components/Cascade';
import {fonts} from '../../theme/typography';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginVariant, setLoginVariant] = useState<'control' | 'variant_a'>('control');
  const {signIn, resetPassword} = useAuth();
  const navigation = useNavigation();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();

  useEffect(() => {
    let active = true;
    const loadVariant = async () => {
      const variant = await getStringFlag('login_experiment_variant', 'control');
      const normalized = variant === 'variant_a' ? 'variant_a' : 'control';
      if (!active) return;
      setLoginVariant(normalized);
      trackEvent('experiment_exposed', {name: 'login_experiment', variant: normalized}).catch(
        () => undefined,
      );
    };
    loadVariant();
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      Alert.alert(t('common.error'), t('auth.errors.missingFields'));
      return;
    }

    setLoading(true);
    try {
      await signIn(normalizedEmail, password);
    } catch (error: any) {
      Alert.alert(t('auth.errors.loginFailed'), error.message || t('auth.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert(t('auth.reset.title'), t('auth.reset.enterEmail'));
      return;
    }
    try {
      await resetPassword(normalizedEmail);
      Alert.alert(t('auth.reset.emailSentTitle'), t('auth.reset.emailSentBody'));
    } catch (error: any) {
      Alert.alert(t('auth.reset.failedTitle'), error.message || t('auth.reset.failedBody'));
    }
  };

  return (
    <GlassScreen style={styles.container} textureSeed="login">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <Cascade index={0}>
            <Text style={[styles.title, {color: colors.text}]}>{t('app.name')}</Text>
            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
              {loginVariant === 'variant_a'
                ? t('auth.login.subtitleVariant')
                : t('auth.login.subtitleDefault')}
            </Text>
          </Cascade>

          <Cascade index={1}>
          <GlassView style={[styles.panel, {borderColor: colors.glassBorder}]}>
          <TextInput
            style={[
              styles.input,
              {backgroundColor: colors.surface, color: colors.text, borderColor: colors.glassBorder},
            ]}
            placeholder={t('auth.login.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <PasswordInput
            style={[
              styles.input,
              {backgroundColor: colors.surface, color: colors.text, borderColor: colors.glassBorder},
            ]}
            placeholder={t('auth.login.passwordPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[
              styles.button,
              {backgroundColor: colors.primary},
              loading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {loginVariant === 'variant_a' ? t('common.continue') : t('common.signIn')}
              </Text>
            )}
          </TouchableOpacity>
        </GlassView>
        </Cascade>

        <Cascade index={2}>
          <SocialSignInButtons />
        </Cascade>

        <Cascade index={3}>
          <TouchableOpacity style={styles.linkButton} onPress={handleResetPassword}>
            <Text style={[styles.linkText, {color: colors.textSecondary}]}>
              {t('auth.login.forgotPassword')}{' '}
              <Text style={[styles.linkTextBold, {color: colors.primary}]}>{t('auth.login.reset')}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('SignUp' as never)}>
            <Text style={[styles.linkText, {color: colors.textSecondary}]}>
              {t('auth.login.noAccount')}{' '}
              <Text style={[styles.linkTextBold, {color: colors.primary}]}>{t('common.signUp')}</Text>
            </Text>
          </TouchableOpacity>
        </Cascade>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  title: {
    // Display face. No fontWeight beside it -- the weight lives in the
    // file (see theme/typography.ts).
    fontFamily: fonts.display.bold,
    fontSize: 34,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 44,
    lineHeight: 22,
  },
  panel: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
    marginBottom: 16,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  button: {
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  linkButton: {
    marginTop: 28,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
    lineHeight: 20,
  },
  linkTextBold: {
    fontWeight: '700',
  },
});

