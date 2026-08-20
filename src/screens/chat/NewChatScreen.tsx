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
import {MAX_GROUP_MEMBERS} from '../../services/e2ee';
import type {User} from '../../types';
import {useNavigation} from '@react-navigation/native';
import {getColors} from '../../theme/colors';
import {reportError} from '../../services/telemetry';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';

export default function NewChatScreen() {
  const {t} = useTranslation();
  const {user} = useAuth();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [chatName, setChatName] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  // People queued for the new chat. One makes a 1:1, more makes a group —
  // there is no separate "create group" mode to pick up front.
  const [invitees, setInvitees] = useState<User[]>([]);
  const colors = getColors(useColorScheme());

  /** Resolves the typed email to an account and queues it. */
  const handleAddInvitee = async () => {
    if (!user) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert(t('common.error'), t('newChat.errors.enterEmail'));
      return;
    }
    // The signed-in user occupies one of the seats, so only cap-1 others fit.
    if (invitees.length >= MAX_GROUP_MEMBERS - 1) {
      Alert.alert(t('common.error'), t('newChat.errors.groupFull', {max: MAX_GROUP_MEMBERS}));
      return;
    }

    setAdding(true);
    try {
      const otherUser = await getUserByEmail(trimmedEmail);
      if (!otherUser) {
        Alert.alert(t('newChat.errors.userNotFoundTitle'), t('newChat.errors.userNotFoundBody'));
        return;
      }
      if (otherUser.uid === user.uid) {
        Alert.alert(t('common.error'), t('newChat.errors.selfChat'));
        return;
      }
      if (invitees.some(i => i.uid === otherUser.uid)) {
        Alert.alert(t('common.error'), t('newChat.errors.alreadyAdded'));
        return;
      }
      setInvitees(prev => [...prev, otherUser]);
      setEmail('');
    } catch (error) {
      reportError(error, 'new_chat_add_invitee_failed');
      Alert.alert(t('common.error'), t('newChat.errors.createFailed'));
    } finally {
      setAdding(false);
    }
  };

  const handleCreateChat = async () => {
    if (!user) return;
    if (invitees.length === 0) {
      Alert.alert(t('common.error'), t('newChat.errors.enterEmail'));
      return;
    }

    setLoading(true);
    try {
      const otherUser = invitees[0];
      const isGroup = invitees.length > 1;

      // Only 1:1 chats are de-duplicated. Two groups with the same members are
      // legitimately different conversations (different topics, different
      // names), so reusing one would be wrong.
      if (!isGroup) {
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
          navigation.navigate('Chat', {
            chatId: existing.id,
            chatName: existing.name,
          });
          return;
        }
      }

      const displayName =
        chatName.trim() ||
        (isGroup
          ? invitees.map(i => i.displayName || i.email).join(', ')
          : otherUser.displayName || otherUser.email);

      const chatId = await createChat(
        [user.uid, ...invitees.map(i => i.uid)],
        displayName,
      );

      navigation.navigate('Chat', {
        chatId,
        chatName: displayName,
      });
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
            onSubmitEditing={handleAddInvitee}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.addButton, {borderColor: colors.primary}, adding && styles.buttonDisabled]}
            onPress={handleAddInvitee}
            disabled={adding}>
            <Text style={[styles.addButtonText, {color: colors.primary}]}>
              {adding ? t('newChat.adding') : t('newChat.addPerson')}
            </Text>
          </TouchableOpacity>

          {invitees.length > 0 && (
            <View style={styles.chipRow}>
              {invitees.map(person => (
                <TouchableOpacity
                  key={person.uid}
                  style={[styles.chip, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}
                  onPress={() => setInvitees(prev => prev.filter(p => p.uid !== person.uid))}
                  accessibilityLabel={t('newChat.removePerson', {
                    name: person.displayName || person.email,
                  })}>
                  <Text style={[styles.chipText, {color: colors.text}]}>
                    {person.displayName || person.email} ✕
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

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
              {loading ? t('newChat.creating') : invitees.length > 1 ? t('newChat.startGroup') : t('newChat.startChat')}
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
  addButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: {fontSize: 14, fontWeight: '600'},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14},
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {fontSize: 13, fontWeight: '600'},
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

