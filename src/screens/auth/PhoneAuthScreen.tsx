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
import type {ConfirmationResult} from '../../services/firebase/auth';

export default function PhoneAuthScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const {sendPhoneCode, confirmPhoneCode} = useAuth();
  const navigation = useNavigation<any>();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();

  const handleSendCode = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed.startsWith('+') || trimmed.length < 8) {
      Alert.alert(t('common.error'), t('auth.phone.errors.invalidPhone'));
      return;
    }
    setLoading(true);
    try {
      const result = await sendPhoneCode(trimmed);
      setConfirmation(result);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!confirmation) return;
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      Alert.alert(t('common.error'), t('auth.phone.errors.invalidCode'));
      return;
    }
    setLoading(true);
    try {
      await confirmPhoneCode(confirmation, trimmed);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassScreen style={styles.container} textureSeed="phone-auth">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          {!confirmation ? (
            <>
              <Text style={[styles.title, {color: colors.text}]}>{t('auth.phone.title')}</Text>
              <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
                {t('auth.phone.subtitle')}
              </Text>

              <GlassView style={[styles.panel, {borderColor: colors.glassBorder}]}>
                <TextInput
                  style={[
                    styles.input,
                    {backgroundColor: colors.surface, color: colors.text, borderColor: colors.glassBorder},
                  ]}
                  placeholder={t('auth.phone.phonePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  autoFocus
                />

                <TouchableOpacity
                  style={[
                    styles.button,
                    {backgroundColor: colors.primary},
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleSendCode}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t('auth.phone.sendCode')}</Text>
                  )}
                </TouchableOpacity>
              </GlassView>
            </>
          ) : (
            <>
              <Text style={[styles.title, {color: colors.text}]}>{t('auth.phone.codeTitle')}</Text>
              <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
                {t('auth.phone.codeSubtitle', {phoneNumber: phoneNumber.trim()})}
              </Text>

              <GlassView style={[styles.panel, {borderColor: colors.glassBorder}]}>
                <TextInput
                  style={[
                    styles.input,
                    styles.codeInput,
                    {backgroundColor: colors.surface, color: colors.text, borderColor: colors.glassBorder},
                  ]}
                  placeholder={t('auth.phone.codePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />

                <TouchableOpacity
                  style={[
                    styles.button,
                    {backgroundColor: colors.primary},
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleVerifyCode}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t('auth.phone.verify')}</Text>
                  )}
                </TouchableOpacity>
              </GlassView>

              <TouchableOpacity style={styles.linkButton} onPress={handleSendCode} disabled={loading}>
                <Text style={[styles.linkTextBold, {color: colors.primary}]}>
                  {t('auth.phone.resendCode')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setConfirmation(null);
                  setCode('');
                }}
                disabled={loading}>
                <Text style={[styles.linkText, {color: colors.textSecondary}]}>
                  {t('auth.phone.changeNumber')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={[styles.linkText, {color: colors.textSecondary}]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
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
    fontSize: 32,
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
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
    marginBottom: 16,
  },
  input: {
    borderRadius: 2,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '700',
  },
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
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
    lineHeight: 20,
  },
  linkTextBold: {
    fontSize: 15,
    fontWeight: '700',
  },
});
