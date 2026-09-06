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
import PasswordInput from '../../components/PasswordInput';
import SocialSignInButtons from '../../components/SocialSignInButtons';
import Cascade from '../../components/Cascade';
import {bodyWeight, fonts, terminal} from '../../theme/typography';
import {checkPasswordStrength} from '../../services/passwordPolicy';

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

    const strength = checkPasswordStrength(password);
    if (strength !== 'ok') {
      const messageKey = {
        'too-short': 'auth.errors.passwordMin',
        'too-common': 'auth.errors.passwordTooCommon',
        'too-simple': 'auth.errors.passwordTooSimple',
      }[strength];
      Alert.alert(t('common.error'), t(messageKey));
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

  // A marker no translation contains, so the split is unambiguous.
  const [termsBefore, termsAfter] = t('auth.signup.terms', {policy: '\u0000'}).split('\u0000');

  return (
    <GlassScreen style={styles.container} textureSeed="signup">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <Cascade index={0}>
            <Text style={[styles.title, {color: colors.text}]}>{t('auth.signup.title')}</Text>
            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
              {t('auth.signup.subtitle')}
            </Text>
          </Cascade>

          <Cascade index={1}>
          <GlassView style={[styles.panel, {borderColor: colors.glassBorder}]}>
          <TextInput
            style={[
              styles.input,
              {color: colors.text, borderColor: colors.border},
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
              {color: colors.text, borderColor: colors.border},
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
              {color: colors.text, borderColor: colors.border},
            ]}
            placeholder={t('auth.signup.passwordPlaceholder')}
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
            onPress={handleSignUp}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>{t('common.signUp')}</Text>
            )}
          </TouchableOpacity>
        </GlassView>
        </Cascade>

        <Cascade index={2}>
          <SocialSignInButtons />
        </Cascade>

        <Cascade index={3}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.goBack()}>
            <Text style={[styles.linkText, {color: colors.textSecondary}]}>
              {t('auth.signup.hasAccount')}{' '}
              <Text style={[styles.linkTextBold, {color: colors.primary}]}>{t('common.signIn')}</Text>
            </Text>
          </TouchableOpacity>
          <Text style={[styles.termsText, {color: colors.textSecondary}]}>
            {/* Split on the slot rather than concatenating a prefix: the link
                sits mid-sentence in some languages and at the end in others,
                and only the translation knows which. */}
            {termsBefore}
            <Text
              style={[styles.termsLink, {color: colors.primary}]}
              onPress={() => (navigation as any).navigate('PrivacyPolicy')}>
              {t('auth.signup.privacyPolicy')}
            </Text>
            {termsAfter}
          </Text>
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
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 44,
    lineHeight: 22,
  },
  panel: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
    marginBottom: 16,
  },
  input: {
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    letterSpacing: 0.4,
    // Ruled, not filled. On a black ground a surface tint is either invisible
    // or heavy enough to compete with what is typed into it; an edge states
    // the field without spending contrast.
    borderWidth: 1,
  },
  eyebrow: {...terminal.micro, textAlign: 'center', marginBottom: 6},
  button: {
    borderRadius: 2,
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
    fontFamily: bodyWeight('700'),
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
    fontFamily: bodyWeight('700'),
  },
  termsText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: bodyWeight('600'),
  },
});

