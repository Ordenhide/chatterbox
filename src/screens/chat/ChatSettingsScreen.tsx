import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  useColorScheme,
  ScrollView,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../contexts/AuthContext';
import {
  leaveAndClearOwnContent,
  exportChat,
  importChat,
  toggleMuteChat,
  setChatName,
  getChat,
  addChatMembers,
  leaveChat,
  getUserByEmail,
  getUsersByIds,
  GroupFullError,
} from '../../services/firebaseChat';
import {MAX_GROUP_MEMBERS} from '../../services/e2ee';
import {getColors} from '../../theme/colors';
import Clipboard from '@react-native-clipboard/clipboard';
import {removeCachedChat, removeOutboxForChat} from '../../services/offlineCache';
import {setDraft} from '../../services/drafts';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';
import Icon, {type IconName} from '../../components/Icon';
import {changePetSpecies, createChatPet, getChatPet} from '../../services/chatPet';
import {setChatLockPIN, removeChatLock, isChatLocked} from '../../services/appLock';
import {setChatExpiryPolicy, getExpiryOptions} from '../../services/messageExpiry';
import {ChatPet, SoundscapeId} from '../../types';
import {SHOW_NATIVE_ONLY_FEATURES, SHOW_CHAT_PET} from '../../config/parity';
import {doc, getFirestore, setDoc} from '../../services/firebase/firestore';
import {bodyWeight, terminal} from '../../theme/typography';

const SOUNDSCAPES: {id: SoundscapeId; label: string; icon: IconName}[] = [
  {id: 'none', label: 'Off', icon: 'muteSpeaker'},
  {id: 'rain', label: 'Rain', icon: 'rain'},
  {id: 'ocean', label: 'Ocean', icon: 'oceanWave'},
  {id: 'forest', label: 'Forest', icon: 'forest'},
  {id: 'cafe', label: 'Caf\u00E9', icon: 'coffee'},
  {id: 'campfire', label: 'Fire', icon: 'flame'},
  {id: 'lofi', label: 'Lo-fi', icon: 'music'},
  {id: 'thunder', label: 'Thunder', icon: 'lightning'},
  {id: 'wind', label: 'Wind', icon: 'wind'},
];
const PET_SPECIES: {id: ChatPet['species']; icon: IconName; label: string}[] = [
  {id: 'plant', icon: 'seedling', label: 'Plant'},
  {id: 'cat', icon: 'cat', label: 'Cat'},
  {id: 'dog', icon: 'dog', label: 'Dog'},
  {id: 'bunny', icon: 'rabbit', label: 'Bunny'},
  {id: 'fox', icon: 'fox', label: 'Fox'},
];

export default function ChatSettingsScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const {t} = useTranslation();
  const chatId = (route.params as any)?.chatId as string;
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const [muted, setMuted] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [soundscape, setSoundscape] = useState<SoundscapeId>('none');
  const [pet, setPet] = useState<ChatPet | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [expiryHours, setExpiryHours] = useState(0);

  useEffect(() => {
    if (!chatId || !user) return;
    const load = async () => {
      try {
        const chat = await getChat(chatId);
        setMuted(!!chat?.mutedBy?.includes(user.uid));
        setCustomName(chat?.nameBy?.[user.uid] || '');
        setSoundscape((chat as any)?.soundscape || 'none');
        setExpiryHours((chat as any)?.messageExpiry || 0);
        setChatLocked(isChatLocked(chatId));
        setPet(await getChatPet(chatId));

        const participants = chat?.participants || [];
        setMembers(participants);
        const profiles = await getUsersByIds(participants);
        setMemberNames(
          Object.fromEntries(
            participants.map(uid => [
              uid,
              profiles[uid]?.displayName || profiles[uid]?.email || uid.slice(0, 6),
            ]),
          ),
        );
      } catch (err) {
        if (__DEV__) {
          console.warn('ChatSettingsScreen: failed to load chat', err);
        }
      }
    };
    load();
  }, [chatId, user]);

  const handleToggleMute = async () => {
    if (!chatId || !user) return;
    try {
      await toggleMuteChat(chatId, user.uid);
      setMuted(prev => !prev);
    } catch (err) {
      if (__DEV__) {
        console.warn('ChatSettingsScreen: failed to toggle mute', err);
      }
      Alert.alert(t('common.error'), t('errors.generic'));
    }
  };

  const handleSaveName = async () => {
    if (!chatId || !user) return;
    try {
      const trimmed = customName.trim();
      await setChatName(chatId, user.uid, trimmed ? trimmed : null);
      setNameModalVisible(false);
    } catch (err) {
      if (__DEV__) {
        console.warn('ChatSettingsScreen: failed to save name', err);
      }
      Alert.alert(t('common.error'), t('errors.generic'));
    }
  };

  const handleExport = async () => {
    if (!chatId) return;
    try {
      const payload = await exportChat(chatId);
      setExportText(JSON.stringify(payload, null, 2));
      setExportModalVisible(true);
    } catch (err) {
      if (__DEV__) {
        console.warn('ChatSettingsScreen: failed to export chat', err);
      }
      Alert.alert(t('common.error'), t('errors.generic'));
    }
  };

  const handleImport = async () => {
    if (!chatId) return;
    try {
      const payload = JSON.parse(importText);
      await importChat(chatId, payload);
      setImportText('');
      setImportModalVisible(false);
      Alert.alert(t('chatSettings.alerts.importSuccessTitle'), t('chatSettings.alerts.importSuccessBody'));
    } catch (err) {
      Alert.alert(t('chatSettings.alerts.invalidJsonTitle'), t('chatSettings.alerts.invalidJsonBody'));
    }
  };

  const handlePruneMedia = async () => {
    if (!chatId) return;
    Alert.alert(t('chatSettings.alerts.cleanupTitle'), t('chatSettings.alerts.cleanupBody'), [
      {text: t('chatSettings.alerts.cleanupCancel'), style: 'cancel'},
      {
        text: t('chatSettings.alerts.cleanupRemove'),
        style: 'destructive',
        onPress: async () => {
          Alert.alert(t('chatSettings.alerts.cleanupNotSupportedTitle'), t('chatSettings.alerts.cleanupNotSupportedBody'));
        },
      },
    ]);
  };

  // Named for what it does now. The old "delete the whole chat for everyone"
  // was not something the rules permit — see leaveAndClearOwnContent — so the
  // dialog below says what actually happens instead of what used to be
  // promised. New i18n keys rather than edited ones, so the translations of
  // the old (untrue) wording fall back to English until they are redone.
  const handleLeaveAndClear = async () => {
    if (!chatId || !user) return;
    Alert.alert(
      t('chatSettings.alerts.leaveClearTitle'),
      t('chatSettings.alerts.leaveClearBody'),
      [
        {text: t('chatSettings.alerts.deleteCancel'), style: 'cancel'},
        {
          text: t('chatSettings.alerts.leaveClearConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveAndClearOwnContent(chatId, user.uid);
              await removeCachedChat(user.uid, chatId);
              await removeOutboxForChat(user.uid, chatId);
              await setDraft(user.uid, chatId, '');
              navigation.goBack();
            } catch (err) {
              if (__DEV__) {
                console.warn('ChatSettingsScreen: failed to leave chat', err);
              }
              Alert.alert(
                t('chatSettings.alerts.leaveClearFailedTitle'),
                t('chatSettings.alerts.leaveClearFailedBody'),
              );
            }
          },
        },
      ],
    );
  };




  const handleAddMember = async () => {
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    if (members.length >= MAX_GROUP_MEMBERS) {
      Alert.alert(t('common.error'), t('members.full', {max: MAX_GROUP_MEMBERS}));
      return;
    }
    setAddingMember(true);
    try {
      const person = await getUserByEmail(email);
      if (!person) {
        Alert.alert(t('common.error'), t('newChat.errors.userNotFoundBody'));
        return;
      }
      if (members.includes(person.uid)) {
        Alert.alert(t('common.error'), t('newChat.errors.alreadyAdded'));
        return;
      }
      await addChatMembers(chatId, [person.uid]);
      setMembers(prev => [...prev, person.uid]);
      setMemberNames(prev => ({
        ...prev,
        [person.uid]: person.displayName || person.email || person.uid.slice(0, 6),
      }));
      setMemberEmail('');
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof GroupFullError
          ? t('members.full', {max: MAX_GROUP_MEMBERS})
          : t('newChat.errors.createFailed'),
      );
    } finally {
      setAddingMember(false);
    }
  };

  const handleLeaveChat = () => {
    if (!user) return;
    Alert.alert(t('members.leaveConfirmTitle'), t('members.leaveConfirmBody'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('members.leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveChat(chatId, user.uid);
            navigation.goBack();
          } catch {
            Alert.alert(t('common.error'), t('newChat.errors.createFailed'));
          }
        },
      },
    ]);
  };

  return (
    <GlassScreen style={styles.container} textureSeed={chatId}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('chatSettings.notifications')}</Text>
        <TouchableOpacity style={styles.row} onPress={handleToggleMute}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>
            {muted ? t('chatSettings.unmuteChat') : t('chatSettings.muteChat')}
          </Text>
        </TouchableOpacity>
      </GlassView>

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        {/* Theming is account-wide and lives in the Store. What sat here was
            a second palette — six iOS system colours — that matched neither
            the catalog nor the web client's own third one, so a chat themed
            here and the same chat themed from the Store disagreed. */}
        <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('chatSettings.theme')}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.navigate('Store')}>
          <Text style={[styles.storeHint, {color: colors.primary}]}>
            {`${t('store.themeMovedHint')} ${t('store.openStore')} →`}
          </Text>
        </TouchableOpacity>
      </GlassView>

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('chatSettings.recipientName')}</Text>
        <TouchableOpacity style={styles.row} onPress={() => setNameModalVisible(true)}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>
            {customName ? t('chatSettings.nameWithValue', {name: customName}) : t('chatSettings.setCustomName')}
          </Text>
        </TouchableOpacity>
      </GlassView>


      {SHOW_NATIVE_ONLY_FEATURES && (
      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Soundscape</Text>
        <View style={styles.optionRow}>
          {SOUNDSCAPES.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.themeDot,
                {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border},
                soundscape === s.id && [styles.themeDotSelected, {borderColor: colors.primary}],
              ]}
              onPress={async () => {
                setSoundscape(s.id);
                try {
                  const db = getFirestore();
                  await setDoc(doc(db, 'chats', chatId), {soundscape: s.id}, {merge: true});
                } catch { /* ignore */ }
              }}>
              <Icon name={s.icon} size={14} color={colors.text} />
            </TouchableOpacity>
          ))}
        </View>
      </GlassView>
      )}

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>
          {t('members.title', {count: members.length})}
        </Text>
        {members.map(uid => (
          <View key={uid} style={styles.row}>
            <Text style={[styles.rowLabel, {color: colors.text}]}>
              {memberNames[uid] || uid.slice(0, 6)}
              {uid === user?.uid ? t('members.you') : ''}
            </Text>
          </View>
        ))}

        <TextInput
          style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
          placeholder={t('members.addPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={memberEmail}
          onChangeText={setMemberEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.row, addingMember && {opacity: 0.5}]}
          disabled={addingMember}
          onPress={handleAddMember}>
          <Text style={[styles.rowLabel, {color: colors.primary}]}>
            {addingMember ? t('members.adding') : t('members.add')}
          </Text>
        </TouchableOpacity>

        {/* Only yourself — the rules reject removing anyone else, since there
            are no admin roles yet. */}
        <TouchableOpacity style={styles.row} onPress={handleLeaveChat}>
          <Text style={[styles.rowLabel, {color: colors.danger}]}>{t('members.leave')}</Text>
        </TouchableOpacity>
      </GlassView>

      {SHOW_CHAT_PET && (
      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Chat Pet</Text>
        <Text style={[styles.rowLabel, {color: colors.textSecondary}]}>
          {pet ? `${pet.name} · Lv.${pet.level} — tap a species to change it, anytime` : 'Adopt a pet for this chat'}
        </Text>
        <View style={styles.optionRow}>
          {PET_SPECIES.map(p => {
            const isCurrent = pet?.species === p.id;
            return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.themeDot,
                {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border},
                isCurrent && [styles.themeDotSelected, {borderColor: colors.primary}],
              ]}
              onPress={() => {
                if (isCurrent) return;
                if (!pet) {
                  Alert.alert('Adopt a Pet', `Adopt a ${p.label} for this chat?`, [
                    {text: 'Cancel', style: 'cancel'},
                    {text: 'Adopt!', onPress: async () => {
                      setPet(await createChatPet(chatId, p.id, p.label));
                    }},
                  ]);
                  return;
                }
                Alert.alert('Change Pet', `Change your pet to a ${p.label}? It keeps its level and progress.`, [
                  {text: 'Cancel', style: 'cancel'},
                  {text: 'Change', onPress: async () => {
                    await changePetSpecies(chatId, p.id, p.label);
                    setPet(prev => (prev ? {...prev, species: p.id, name: p.label} : prev));
                  }},
                ]);
              }}>
              <Icon name={p.icon} size={20} color={colors.text} />
            </TouchableOpacity>
            );
          })}
        </View>
      </GlassView>
      )}

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Features</Text>
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('Whiteboard', {chatId})}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>Whiteboard</Text>
        </TouchableOpacity>
      </GlassView>

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Security</Text>
        {SHOW_NATIVE_ONLY_FEATURES && (
        <TouchableOpacity
          style={styles.row}
          onPress={() => {
            if (chatLocked) {
              Alert.alert('Remove Lock', 'Remove PIN lock from this chat?', [
                {text: 'Cancel', style: 'cancel'},
                {text: 'Remove', style: 'destructive', onPress: async () => {
                  await removeChatLock(chatId);
                  setChatLocked(false);
                }},
              ]);
            } else {
              Alert.prompt('Set Chat PIN', 'Enter a 4-digit PIN to lock this chat', async (pin) => {
                if (pin && pin.length >= 4) {
                  await setChatLockPIN(chatId, pin);
                  setChatLocked(true);
                }
              }, 'secure-text');
            }
          }}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>
            Chat Lock: {chatLocked ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
        )}
        <Text style={[styles.sectionTitle, {color: colors.text, marginTop: 12}]}>Message Expiry</Text>
        <View style={styles.optionRow}>
          {getExpiryOptions().map(opt => (
            <TouchableOpacity
              key={opt.hours}
              style={[
                styles.themeDot,
                {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, width: 'auto' as any, borderRadius: 2, paddingHorizontal: 10, paddingVertical: 6},
                expiryHours === opt.hours && {borderColor: colors.primary, backgroundColor: colors.primary + '20'},
              ]}
              onPress={async () => {
                setExpiryHours(opt.hours);
                await setChatExpiryPolicy(chatId, opt.hours);
              }}>
              <Text style={[{fontSize: 12, fontFamily: bodyWeight('600')}, {color: expiryHours === opt.hours ? colors.primary : colors.text}]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </GlassView>

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('chatSettings.data')}</Text>
        <TouchableOpacity style={styles.row} onPress={handleExport}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>{t('chatSettings.exportChat')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => setImportModalVisible(true)}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>{t('chatSettings.importChat')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={handlePruneMedia}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>{t('chatSettings.cleanupMedia')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={handleLeaveAndClear}>
          <Text style={[styles.rowLabel, {color: colors.danger}]}>{t('chatSettings.leaveAndClear')}</Text>
        </TouchableOpacity>
      </GlassView>

      {exportModalVisible && (
        <Modal visible animationType="slide">
          <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>{t('chatSettings.exportModalTitle')}</Text>
            <TextInput
              style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder}]}
              value={exportText}
              multiline
              editable={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}]}
                onPress={() => {
                  Clipboard.setString(exportText);
                  Alert.alert(t('chatSettings.alerts.copiedTitle'), t('chatSettings.alerts.copiedBody'));
                }}>
                <Text style={[styles.modalButtonText, {color: colors.textOnPrimary}]}>{t('chatSettings.copy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => setExportModalVisible(false)}>
                <Text style={[styles.modalButtonText, {color: colors.text}]}>{t('chatSettings.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {importModalVisible && (
        <Modal visible animationType="slide">
        <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>{t('chatSettings.importModalTitle')}</Text>
          <TextInput
            style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder}]}
            value={importText}
            onChangeText={setImportText}
            placeholder={t('chatSettings.pasteJsonPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: colors.primary}]}
              onPress={handleImport}>
              <Text style={[styles.modalButtonText, {color: colors.textOnPrimary}]}>{t('chatSettings.import')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: colors.surface}]}
              onPress={() => setImportModalVisible(false)}>
              <Text style={[styles.modalButtonText, {color: colors.text}]}>{t('chatSettings.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      )}

      {nameModalVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setNameModalVisible(false)}>
        <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>{t('chatSettings.editRecipientName')}</Text>
          <TextInput
            style={[styles.modalInput, {color: colors.text, borderColor: colors.glassBorder}]}
            value={customName}
            onChangeText={setCustomName}
            placeholder={t('chatSettings.enterCustomNamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: colors.primary}]}
              onPress={handleSaveName}>
              <Text style={[styles.modalButtonText, {color: colors.textOnPrimary}]}>{t('chatSettings.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: colors.surface}]}
              onPress={() => setNameModalVisible(false)}>
              <Text style={[styles.modalButtonText, {color: colors.text}]}>{t('chatSettings.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.clearNameButton, {borderColor: colors.glassBorder}]}
            onPress={() => {
              setCustomName('');
            }}>
            <Text style={[styles.clearNameText, {color: colors.textSecondary}]}>{t('chatSettings.clearName')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      )}
      </ScrollView>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  section: {
    padding: 16,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginTop: 12,
  },
  sectionTitle: {...terminal.label, marginBottom: 8},
  row: {
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 14,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  themeDot: {
    width: 28,
    height: 28,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeHint: {fontSize: 12.5, fontFamily: bodyWeight('600'), marginTop: 10},
  themeDotSelected: {
    borderWidth: 2,
  },
  modalContainer: {
    flex: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: bodyWeight('600'),
    marginBottom: 12,
  },
  modalInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 2,
    padding: 12,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 2,
    alignItems: 'center',
  },
  modalButtonText: {
    fontFamily: bodyWeight('600'),
  },
  clearNameButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 2,
    borderWidth: 1,
  },
  clearNameText: {
    fontSize: 13,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 10,
  },
});

