import React, {useRef, useState} from 'react';
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
import Cascade from '../../components/Cascade';
import {bodyWeight, fonts, terminal} from '../../theme/typography';

/**
 * Signing in is typing the recovery phrase, and nothing else.
 *
 * There is no email field and no password field because the account has
 * neither: the 24 words are the whole credential, and the key they encode is
 * adopted in the same step (see AuthContext's signInWithPhrase). That is why
 * this screen has no "restore your messages" follow-up and no way to end up
 * signed in but unable to decrypt.
 */
export default function LoginScreen() {
  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const {signInWithPhrase} = useAuth();
  const navigation = useNavigation();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();
  const inputRef = useRef<TextInput>(null);

  const canSubmit = phrase.trim().length > 0 && !loading;

  const handleSignIn = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await signInWithPhrase(phrase);
    } catch (error: any) {
      Alert.alert(t('auth.errors.loginFailed'), error.message || t('auth.errors.generic'));
    } finally {
      setLoading(false);
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
            <Text style={[styles.eyebrow, {color: colors.textSecondary}]}>
              {t('auth.eyebrow')}
            </Text>
            <Text style={[styles.title, {color: colors.text}]}>{t('app.name')}</Text>
            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
              {t('auth.phrase.signInBody')}
            </Text>
          </Cascade>

          <Cascade index={1}>
            <GlassView style={[styles.panel, {borderColor: colors.glassBorder}]}>
              {/* Uncontrolled: defaultValue, never value. A controlled
                  multiline TextInput round-trips each keystroke out to state
                  and back, and on Fabric iOS the native field is re-committed
                  with the previous value before the update lands — characters
                  revert as fast as they are typed. Same failure as the chat
                  composer and the restore field in RecoveryPhraseScreen.
                  onChangeText still fires, but only to mirror the value out
                  for the button's enabled state. */}
              <TextInput
                ref={inputRef}
                style={[styles.input, {color: colors.text, borderColor: colors.border}]}
                defaultValue=""
                onChangeText={setPhrase}
                placeholder={t('auth.phrase.placeholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                // The phrase is the entire account. Keep it out of the
                // keyboard's learned-word store and out of autofill.
                autoComplete="off"
                spellCheck={false}
                textContentType="none"
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  {backgroundColor: colors.primary},
                  canSubmit ? null : styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityState={{disabled: !canSubmit}}
                onPress={handleSignIn}
                disabled={!canSubmit}>
                {loading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                    {t('common.signIn')}
                  </Text>
                )}
              </TouchableOpacity>
            </GlassView>
          </Cascade>

          <Cascade index={2}>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('SignUp' as never)}>
              <Text style={[styles.linkText, {color: colors.textSecondary}]}>
                {t('auth.login.noAccount')}{' '}
                <Text style={[styles.linkTextBold, {color: colors.primary}]}>
                  {t('common.signUp')}
                </Text>
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
    // Two dozen words need room; one line would hide most of what was pasted.
    minHeight: 120,
    textAlignVertical: 'top',
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
});
