import React, {useMemo, useState} from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  useColorScheme,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {useAuth} from '../../contexts/AuthContext';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getColors} from '../../theme/colors';
import GlassView from '../../components/GlassView';
import GlassScreen from '../../components/GlassScreen';
import Cascade from '../../components/Cascade';
import {bodyWeight, fonts} from '../../theme/typography';
import {newAccountSeed, seedToPhrase} from '../../services/anonymousIdentity';
import {secureRandomBytes} from '../../services/crypto';

const CONFIRM_WORDS = 3;

/**
 * Picks which words the user is asked to type back.
 *
 * From the CSPRNG rather than Math.random — not because an attacker cares
 * which three words are asked for, but because this must not be the one place
 * in the app that reaches for a weak random source. The next person to copy a
 * line out of a screen that handles a recovery phrase should not find one.
 *
 * The modulo below is biased toward the low indices (256 is not a multiple of
 * 24) and that is fine: this picks which words to ask about, not any part of
 * the key. It loops until it has three distinct indices, which terminates
 * because the phrase is always far longer than the number asked for.
 */
function pickConfirmIndices(count: number, total: number): number[] {
  const chosen = new Set<number>();
  while (chosen.size < count) {
    chosen.add(secureRandomBytes(1)[0] % total);
  }
  return [...chosen].sort((a, b) => a - b);
}

/**
 * Creating an account is being handed a phrase and proving you kept it.
 *
 * Nothing is created until the second step passes, and that ordering is the
 * whole design. The phrase *is* the account: there is no reset email and
 * nobody to ask, so an account created before its phrase was written down is
 * an account already lost — and no later screen could detect that or repair
 * it. The three words asked back are the cheapest evidence that the phrase
 * left this screen with the user rather than being tapped past.
 */
export default function SignUpScreen() {
  // Generated once, on first render, and held for the life of the screen.
  // Backing out and coming in again hands out a different phrase rather than
  // resurrecting one the user has already been shown.
  const seed = useMemo(() => newAccountSeed(), []);
  const phrase = useMemo(() => seedToPhrase(seed), [seed]);
  const words = useMemo(() => phrase.split(' '), [phrase]);
  const confirmIndices = useMemo(() => pickConfirmIndices(CONFIRM_WORDS, words.length), [words]);

  const [step, setStep] = useState<'show' | 'confirm'>('show');
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const {createAccount} = useAuth();
  const navigation = useNavigation();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();

  const confirmed = confirmIndices.every(
    i => (typed[i] ?? '').trim().toLowerCase() === words[i],
  );

  const handleCopy = () => {
    Clipboard.setString(phrase);
    Alert.alert(t('auth.phrase.newTitle'), t('auth.phrase.copied'));
  };

  const handleCreate = async () => {
    if (!confirmed) {
      Alert.alert(t('auth.phrase.confirmTitle'), t('auth.phrase.confirmWrong'));
      return;
    }
    setLoading(true);
    try {
      await createAccount(phrase, displayName.trim() || undefined);
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
            <Text style={[styles.title, {color: colors.text}]}>
              {step === 'show' ? t('auth.phrase.newTitle') : t('auth.phrase.confirmTitle')}
            </Text>
            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
              {step === 'show' ? t('auth.phrase.newBody') : t('auth.phrase.confirmBody')}
            </Text>
          </Cascade>

          {step === 'show' ? (
            <Cascade index={1}>
              <GlassView style={[styles.panel, {borderColor: colors.glassBorder}]}>
                <View style={styles.grid}>
                  {words.map((word, index) => (
                    <View key={index} style={styles.wordCell}>
                      <Text style={[styles.wordIndex, {color: colors.textSecondary}]}>
                        {index + 1}
                      </Text>
                      <Text style={[styles.word, {color: colors.text}]} selectable>
                        {word}
                      </Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    {borderColor: colors.glassBorder, backgroundColor: colors.surface},
                  ]}
                  accessibilityRole="button"
                  onPress={handleCopy}>
                  <Text style={[styles.secondaryButtonText, {color: colors.text}]}>
                    {t('auth.phrase.copy')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, {backgroundColor: colors.primary}]}
                  accessibilityRole="button"
                  onPress={() => setStep('confirm')}>
                  <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                    {t('auth.phrase.written')}
                  </Text>
                </TouchableOpacity>
              </GlassView>
            </Cascade>
          ) : (
            <Cascade index={1}>
              <GlassView style={[styles.panel, {borderColor: colors.glassBorder}]}>
                {confirmIndices.map(index => (
                  <View key={index}>
                    <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>
                      {t('auth.phrase.wordN', {n: index + 1})}
                    </Text>
                    <TextInput
                      style={[styles.input, {color: colors.text, borderColor: colors.border}]}
                      value={typed[index] ?? ''}
                      onChangeText={value => setTyped(prev => ({...prev, [index]: value}))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="off"
                      spellCheck={false}
                      textContentType="none"
                    />
                  </View>
                ))}

                <TextInput
                  style={[styles.input, {color: colors.text, borderColor: colors.border}]}
                  placeholder={t('auth.signup.displayNamePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />

                <TouchableOpacity
                  style={[
                    styles.button,
                    {backgroundColor: colors.primary},
                    // Disabled *and* visibly disabled: without the second half
                    // the button looks tappable, does nothing, and gives no
                    // hint why.
                    confirmed && !loading ? null : styles.buttonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{disabled: !confirmed || loading}}
                  onPress={handleCreate}
                  disabled={!confirmed || loading}>
                  {loading ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                      {t('auth.phrase.create')}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  accessibilityRole="button"
                  onPress={() => setStep('show')}>
                  <Text style={[styles.linkText, {color: colors.primary}]}>
                    {t('auth.phrase.back')}
                  </Text>
                </TouchableOpacity>
              </GlassView>
            </Cascade>
          )}

          <Cascade index={2}>
            <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
              <Text style={[styles.linkText, {color: colors.textSecondary}]}>
                {t('auth.signup.hasAccount')}{' '}
                <Text style={[styles.linkTextBold, {color: colors.primary}]}>
                  {t('common.signIn')}
                </Text>
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
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 21,
  },
  panel: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordCell: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 5,
    gap: 8,
  },
  wordIndex: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    // Fixed width so the words stay in a column instead of stepping right by
    // a character once the numbering reaches double digits.
    width: 18,
    textAlign: 'right',
  },
  word: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  fieldLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
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
  button: {
    borderRadius: 2,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButton: {
    borderRadius: 2,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: bodyWeight('700'),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 17,
    fontFamily: bodyWeight('700'),
    letterSpacing: 0.3,
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  linkTextBold: {
    fontFamily: bodyWeight('700'),
  },
  termsText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 18,
  },
  termsLink: {
    fontFamily: bodyWeight('700'),
  },
});
