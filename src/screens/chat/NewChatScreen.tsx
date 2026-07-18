import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import {useAuth} from '../../contexts/AuthContext';
import {createChat, getChatsForUser, getUserByEmail} from '../../services/firebaseChat';
import {useNavigation} from '@react-navigation/native';
import {getColors} from '../../theme/colors';
import {reportError} from '../../services/telemetry';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';

export default function NewChatScreen() {
  const {t} = useTranslation();
  const {user} = useAuth();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [chatName, setChatName] = useState('');
  const [loading, setLoading] = useState(false);
  const colors = getColors(useColorScheme());

  const handleCreateChat = async () => {
    if (!user) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert(t('common.error'), t('newChat.errors.enterEmail'));
      return;
    }

    setLoading(true);
    try {
      const otherUser = await getUserByEmail(trimmedEmail);

      if (!otherUser) {
        Alert.alert(
          t('newChat.errors.userNotFoundTitle'),
          t('newChat.errors.userNotFoundBody'),
        );
        return;
      }
      if (otherUser.uid === user.uid) {
        Alert.alert(t('common.error'), t('newChat.errors.selfChat'));
        return;
      }

      const existingChats = await getChatsForUser(user.uid);
      const existing = existingChats.find(chat => {
        const participants = chat.participants || [];
        return (
          participants.includes(user.uid) &&
          participants.includes(otherUser.uid) &&
          participants.length === 2
        );
      });

      if (existing) {
        navigation.navigate('Chat' as never, {
          chatId: existing.id,
          chatName: existing.name,
        } as never);
        return;
      }

      const displayName =
        chatName.trim() || otherUser.displayName || otherUser.email;

      const chatId = await createChat([user.uid, otherUser.uid], displayName);

      navigation.navigate('Chat' as never, {
        chatId,
        chatName: displayName,
      } as never);
    } catch (error: any) {
      reportError(error, 'create_chat_failed');
      if (__DEV__) {
        console.error('Failed to create chat:', error);
      }
      const message = error instanceof Error ? error.message : t('newChat.errors.createFailed');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassScreen style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
        <Text style={[styles.heading, {color: colors.text}]}>{t('newChat.heading')}</Text>
        <Text style={[styles.headingSub, {color: colors.textSecondary}]}>
          {t('newChat.subheading')}
        </Text>
        <GlassView style={[styles.formCard, {borderColor: colors.glassBorder}]}>
          <Text style={[styles.label, {color: colors.textSecondary}]}>{t('newChat.recipientEmail')}</Text>
          <TextInput
            style={[
              styles.input,
              {backgroundColor: colors.inputBackground, color: colors.text},
            ]}
            placeholder={t('newChat.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={[styles.label, {color: colors.textSecondary}]}>{t('newChat.chatNameLabel')}</Text>
          <TextInput
            style={[
              styles.input,
              {backgroundColor: colors.inputBackground, color: colors.text},
            ]}
            placeholder={t('newChat.chatNamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={chatName}
            onChangeText={setChatName}
          />

          <TouchableOpacity
            style={[
              styles.button,
              {backgroundColor: colors.primary},
              loading && styles.buttonDisabled,
            ]}
            onPress={handleCreateChat}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? t('newChat.creating') : t('newChat.startChat')}
            </Text>
          </TouchableOpacity>
        </GlassView>

        <Text style={[styles.helpText, {color: colors.textSecondary}]}>
          {t('newChat.helpText')}
        </Text>
        </View>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  headingSub: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 24,
  },
  formCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 18,
    fontSize: 16,
    borderWidth: 0,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
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
  helpText: {
    marginTop: 20,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

