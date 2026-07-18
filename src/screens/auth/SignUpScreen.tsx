import React, {useState} from 'react';
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
import GlassView from '../../components/GlassView';
import GlassScreen from '../../components/GlassScreen';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const {signUp} = useAuth();
  const navigation = useNavigation();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();

  const handleSignUp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();

    if (!normalizedEmail || !password) {
      Alert.alert(t('common.error'), t('auth.errors.missingEmailPassword'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.errors.passwordMin'));
      return;
    }

    setLoading(true);
    try {
      await signUp(normalizedEmail, password, normalizedDisplayName || undefined);
    } catch (error: any) {
      Alert.alert(t('auth.errors.signUpFailed'), error.message || t('auth.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassScreen style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <Text style={[styles.title, {color: colors.text}]}>{t('auth.signup.title')}</Text>
          <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
            {t('auth.signup.subtitle')}
          </Text>

          <GlassView style={[styles.panel, {borderColor: colors.glassBorder}]}>
          <TextInput
            style={[
              styles.input,
              {backgroundColor: colors.surface, color: colors.text, borderColor: colors.glassBorder},
            ]}
            placeholder={t('auth.signup.displayNamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />

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

          <TextInput
            style={[
              styles.input,
              {backgroundColor: colors.surface, color: colors.text, borderColor: colors.glassBorder},
            ]}
            placeholder={t('auth.signup.passwordPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[
              styles.button,
              {backgroundColor: colors.primary},
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSignUp}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('common.signUp')}</Text>
            )}
          </TouchableOpacity>
        </GlassView>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.goBack()}>
          <Text style={[styles.linkText, {color: colors.textSecondary}]}>
            {t('auth.signup.hasAccount')}{' '}
            <Text style={[styles.linkTextBold, {color: colors.primary}]}>{t('common.signIn')}</Text>
          </Text>
        </TouchableOpacity>
        <Text style={[styles.termsText, {color: colors.textSecondary}]}>
          By creating an account you agree to our{' '}
          <Text
            style={[styles.termsLink, {color: colors.primary}]}
            onPress={() => (navigation as any).navigate('PrivacyPolicy')}>
            Privacy Policy
          </Text>
        </Text>
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
    fontSize: 36,
    fontWeight: '800',
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
  termsText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  termsLink: {
    fontWeight: '600',
  },
});

