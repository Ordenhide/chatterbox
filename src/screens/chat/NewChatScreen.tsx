/**
 * Starting a conversation, without a directory to search.
 *
 * This screen used to take an email address. That worked because `users` held
 * a plaintext, indexed email for every account and any signed-in client could
 * query it — which also meant anyone could turn a person into the list of
 * conversations they were in. Invite links replaced it (services/invites.ts).
 *
 * What is left here is the *second* thing that box did: getting several people
 * into one group. Those people all already have a one-to-one chat with you, so
 * their uids are in documents this client is holding anyway. No lookup runs;
 * the list is a projection (services/contacts.ts), not a query.
 *
 * Picking exactly one person opens the chat you already have with them, since
 * having that chat is what put them on this list.
 */
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useAuth} from '../../contexts/AuthContext';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';
import {contactsFromChats, type Contact} from '../../services/contacts';
import {openIntroductions} from '../../services/introductions';
import {createChat, getChatsForUser} from '../../services/firebaseChat';
import {MAX_GROUP_MEMBERS} from '../../services/e2ee';
import {reportError} from '../../services/telemetry';
import {getColors} from '../../theme/colors';
import type {ChatRoom} from '../../types';
import {bodyWeight, terminal} from '../../theme/typography';

export default function NewChatScreen() {
  const {t} = useTranslation();
  const {user} = useAuth();
  const navigation = useNavigation<any>();
  const colors = getColors(useColorScheme());

  const [chats, setChats] = useState<ChatRoom[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [chatName, setChatName] = useState('');
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      getChatsForUser(user.uid)
        .then(async found => {
          if (cancelled) return;
          setChats(found);
          // The names people sealed into their chats with you, so this picker
          // calls them what the chat list calls them.
          const introduced = await openIntroductions(found, user.uid);
          if (!cancelled) setContacts(contactsFromChats(found, user.uid, introduced));
        })
        .catch(error => {
          reportError(error, 'new_chat_load_contacts_failed');
          if (!cancelled) setChats([]);
        });
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  const toggle = (uid: string) => {
    setSelected(prev => {
      if (prev.includes(uid)) return prev.filter(id => id !== uid);
      // You occupy one of the seats, so only cap-1 others fit.
      if (prev.length >= MAX_GROUP_MEMBERS - 1) {
        Alert.alert(t('common.error'), t('newChat.errors.groupFull', {max: MAX_GROUP_MEMBERS}));
        return prev;
      }
      return [...prev, uid];
    });
  };

  const handleStart = async () => {
    if (!user || creating || selected.length === 0) return;

    // One person means the chat that put them on this list. Making a second
    // one would split the history across two threads for no reason.
    if (selected.length === 1) {
      const existing = (chats || []).find(chat => {
        const p = chat.participants || [];
        return p.length === 2 && p.includes(user.uid) && p.includes(selected[0]);
      });
      if (existing) {
        navigation.replace('Chat', {
          chatId: existing.id,
          chatName: existing.nameBy?.[user.uid] || existing.name,
        });
        return;
      }
    }

    setCreating(true);
    try {
      const picked = contacts.filter(c => selected.includes(c.uid));
      const name = chatName.trim() || picked.map(c => c.label).join(', ');
      const chatId = await createChat([user.uid, ...selected], name);
      navigation.replace('Chat', {chatId, chatName: name});
    } catch (error) {
      reportError(error, 'create_chat_failed');
      Alert.alert(t('common.error'), t('newChat.errors.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <GlassScreen style={styles.container} textureSeed="new-chat">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.heading, {color: colors.text}]}>{t('newChat.heading')}</Text>
          <Text style={[styles.headingSub, {color: colors.textSecondary}]}>
            {t('newChat.subheading')}
          </Text>

          <TouchableOpacity
            style={[styles.inviteButton, {backgroundColor: colors.primary}]}
            accessibilityRole="button"
            onPress={() => navigation.navigate('Invite')}>
            <Text style={[styles.inviteButtonText, {color: colors.textOnPrimary}]}>
              {t('newChat.invite')}
            </Text>
          </TouchableOpacity>

          <GlassView style={[styles.formCard, {borderColor: colors.glassBorder}]}>
            <Text style={[styles.label, {color: colors.textSecondary}]}>
              {t('newChat.groupLabel')}
            </Text>

            {chats === null ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : contacts.length === 0 ? (
              <Text style={[styles.empty, {color: colors.textSecondary}]}>
                {t('newChat.noContacts')}
              </Text>
            ) : (
              <>
                <Text style={[styles.hint, {color: colors.textSecondary}]}>
                  {t('newChat.groupHint')}
                </Text>
                <View style={styles.chipRow}>
                  {contacts.map(contact => {
                    const on = selected.includes(contact.uid);
                    return (
                      <TouchableOpacity
                        key={contact.uid}
                        style={[
                          styles.chip,
                          {
                            borderColor: on ? colors.primary : colors.glassBorder,
                            backgroundColor: on ? colors.primary : 'transparent',
                          },
                        ]}
                        accessibilityRole="checkbox"
                        accessibilityState={{checked: on}}
                        onPress={() => toggle(contact.uid)}>
                        <Text
                          style={[
                            styles.chipText,
                            {color: on ? colors.textOnPrimary : colors.text},
                          ]}>
                          {contact.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {selected.length > 1 && (
                  <>
                    <Text style={[styles.label, {color: colors.textSecondary}]}>
                      {t('newChat.chatNameLabel')}
                    </Text>
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
                  </>
                )}

                <TouchableOpacity
                  style={[
                    styles.button,
                    {backgroundColor: colors.primary},
                    (creating || selected.length === 0) && styles.buttonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{disabled: creating || selected.length === 0}}
                  disabled={creating || selected.length === 0}
                  onPress={handleStart}>
                  {creating ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>
                      {selected.length > 1 ? t('newChat.startGroup') : t('newChat.openChat')}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </GlassView>

          <Text style={[styles.helpText, {color: colors.textSecondary}]}>
            {t('newChat.helpText')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32},
  heading: {
    fontSize: 24,
    fontFamily: bodyWeight('800'),
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  headingSub: {fontSize: 15, lineHeight: 21, marginBottom: 20},
  inviteButton: {borderRadius: 2, paddingVertical: 16, alignItems: 'center', marginBottom: 24},
  inviteButtonText: {fontSize: 16, fontFamily: bodyWeight('700'), letterSpacing: 0.3},
  formCard: {borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, padding: 20},
  label: {...terminal.label, marginBottom: 8},
  hint: {fontSize: 13, lineHeight: 18, marginBottom: 14},
  empty: {fontSize: 14, lineHeight: 20},
  loader: {marginVertical: 12},
  input: {
    borderRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 18,
    fontSize: 16,
    borderWidth: 0,
  },
  button: {borderRadius: 2, paddingVertical: 17, alignItems: 'center', marginTop: 4},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18},
  chip: {borderWidth: 1, borderRadius: 2, paddingHorizontal: 12, paddingVertical: 8},
  chipText: {fontSize: 13, fontFamily: bodyWeight('600')},
  buttonDisabled: {opacity: 0.4},
  buttonText: {fontSize: 17, fontFamily: bodyWeight('700'), letterSpacing: 0.3},
  helpText: {marginTop: 20, fontSize: 13, textAlign: 'center', lineHeight: 18},
});
