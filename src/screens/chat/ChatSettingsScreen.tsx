import React, {useEffect, useMemo, useState} from 'react';
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
  deleteChat,
  exportChat,
  importChat,
  toggleMuteChat,
  setChatTheme,
  setChatName,
  setChatWallpaper,
  getChat,
} from '../../services/firebaseChat';
import {getColors} from '../../theme/colors';
import Clipboard from '@react-native-clipboard/clipboard';
import {removeCachedChat, removeOutboxForChat} from '../../services/offlineCache';
import {setDraft} from '../../services/drafts';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';
import {createChatPet, getChatPet} from '../../services/chatPet';
import {setChatLockPIN, removeChatLock, isChatLocked} from '../../services/appLock';
import {setChatExpiryPolicy, getExpiryOptions} from '../../services/messageExpiry';
import {ChatPet, SoundscapeId} from '../../types';
import {SHOW_NATIVE_ONLY_FEATURES} from '../../config/parity';
import {doc, getFirestore, setDoc} from '@react-native-firebase/firestore';

const THEME_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', '#5AC8FA'];
const SOUNDSCAPES: {id: SoundscapeId; label: string; icon: string}[] = [
  {id: 'none', label: 'Off', icon: '\uD83D\uDD07'},
  {id: 'rain', label: 'Rain', icon: '\uD83C\uDF27\uFE0F'},
  {id: 'ocean', label: 'Ocean', icon: '\uD83C\uDF0A'},
  {id: 'forest', label: 'Forest', icon: '\uD83C\uDF32'},
  {id: 'cafe', label: 'Caf\u00E9', icon: '\u2615'},
  {id: 'campfire', label: 'Fire', icon: '\uD83D\uDD25'},
  {id: 'lofi', label: 'Lo-fi', icon: '\uD83C\uDFB5'},
  {id: 'thunder', label: 'Thunder', icon: '\u26A1'},
  {id: 'wind', label: 'Wind', icon: '\uD83C\uDF2C\uFE0F'},
];
const PET_SPECIES: {id: ChatPet['species']; icon: string; label: string}[] = [
  {id: 'plant', icon: '\uD83C\uDF31', label: 'Plant'},
  {id: 'cat', icon: '\uD83D\uDC31', label: 'Cat'},
  {id: 'dog', icon: '\uD83D\uDC36', label: 'Dog'},
  {id: 'bunny', icon: '\uD83D\uDC30', label: 'Bunny'},
  {id: 'fox', icon: '\uD83E\uDD8A', label: 'Fox'},
];
const WALLPAPER_COLORS = [
  null,
  '#FFE5E5', '#E5F0FF', '#E5FFE8', '#FFF5E5', '#F0E5FF',
  '#FFE5F3', '#E5FFFE', '#F5F5DC', '#E8E8E8', '#2C2C3E',
  '#1A1A2E', '#0F3460',
];

export default function ChatSettingsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const {t} = useTranslation();
  const chatId = (route.params as any)?.chatId as string;
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const [muted, setMuted] = useState(false);
  const [themeColor, setThemeColor] = useState('#007AFF');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [soundscape, setSoundscape] = useState<SoundscapeId>('none');
  const [hasPet, setHasPet] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [expiryHours, setExpiryHours] = useState(0);

  useEffect(() => {
    if (!chatId || !user) return;
    const load = async () => {
      try {
        const chat = await getChat(chatId);
        setMuted(!!chat?.mutedBy?.includes(user.uid));
        setThemeColor(chat?.themeBy?.[user.uid] || '#007AFF');
        setCustomName(chat?.nameBy?.[user.uid] || '');
        setWallpaper(chat?.wallpaperBy?.[user.uid] || null);
        setSoundscape((chat as any)?.soundscape || 'none');
        setExpiryHours((chat as any)?.messageExpiry || 0);
        setChatLocked(isChatLocked(chatId));
        const pet = await getChatPet(chatId);
        setHasPet(!!pet);
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

  const handleThemeSelect = async (color: string) => {
    if (!chatId || !user) return;
    try {
      await setChatTheme(chatId, user.uid, color);
      setThemeColor(color);
    } catch (err) {
      if (__DEV__) {
        console.warn('ChatSettingsScreen: failed to set theme', err);
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

  const handleDeleteChat = async () => {
    if (!chatId || !user) return;
    Alert.alert(
      t('chatSettings.alerts.deleteTitle'),
      t('chatSettings.alerts.deleteBody'),
      [
        {text: t('chatSettings.alerts.deleteCancel'), style: 'cancel'},
        {
          text: t('chatSettings.alerts.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChat(chatId);
              await removeCachedChat(user.uid, chatId);
              await removeOutboxForChat(user.uid, chatId);
              await setDraft(user.uid, chatId, '');
              navigation.goBack();
            } catch (err) {
              if (__DEV__) {
                console.warn('ChatSettingsScreen: failed to delete chat', err);
              }
              Alert.alert(t('chatSettings.alerts.deleteFailedTitle'), t('chatSettings.alerts.deleteFailedBody'));
            }
          },
        },
      ],
    );
  };

  const handleWallpaperSelect = async (wp: string | null) => {
    if (!chatId || !user) return;
    try {
      await setChatWallpaper(chatId, user.uid, wp);
      setWallpaper(wp);
    } catch (err) {
      if (__DEV__) {
        console.warn('ChatSettingsScreen: failed to set wallpaper', err);
      }
    }
  };

  const wallpaperDots = useMemo(
    () =>
      WALLPAPER_COLORS.map((wp, idx) => (
        <TouchableOpacity
          key={wp || 'none'}
          style={[
            styles.themeDot,
            {backgroundColor: wp || '#fff', borderWidth: 1, borderColor: colors.border},
            wallpaper === wp && [styles.themeDotSelected, {borderColor: colors.text}],
            idx === 0 && !wallpaper && [styles.themeDotSelected, {borderColor: colors.text}],
          ]}
          onPress={() => handleWallpaperSelect(wp)}>
          {idx === 0 ? <Text style={{fontSize: 12}}>{'✕'}</Text> : null}
        </TouchableOpacity>
      )),
    [wallpaper, colors.text, colors.border],
  );

  const themeDots = useMemo(
    () =>
      THEME_COLORS.map(color => (
        <TouchableOpacity
          key={color}
          style={[
            styles.themeDot,
            {backgroundColor: color},
            themeColor === color && [styles.themeDotSelected, {borderColor: colors.text}],
          ]}
          onPress={() => handleThemeSelect(color)}
        />
      )),
    [themeColor, colors.text],
  );

  return (
    <GlassScreen style={styles.container}>
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
        <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('chatSettings.theme')}</Text>
        <View style={styles.themeRow}>{themeDots}</View>
      </GlassView>

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('chatSettings.recipientName')}</Text>
        <TouchableOpacity style={styles.row} onPress={() => setNameModalVisible(true)}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>
            {customName ? t('chatSettings.nameWithValue', {name: customName}) : t('chatSettings.setCustomName')}
          </Text>
        </TouchableOpacity>
      </GlassView>

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Wallpaper</Text>
        <View style={styles.wallpaperRow}>{wallpaperDots}</View>
      </GlassView>

      {SHOW_NATIVE_ONLY_FEATURES && (
      <>
      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Soundscape</Text>
        <View style={styles.wallpaperRow}>
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
              <Text style={{fontSize: 14}}>{s.icon}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </GlassView>

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Chat Pet</Text>
        {hasPet ? (
          <Text style={[styles.rowLabel, {color: colors.textSecondary}]}>Your chat already has a pet! Check the chat screen.</Text>
        ) : (
          <View style={styles.wallpaperRow}>
            {PET_SPECIES.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.themeDot, {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border}]}
                onPress={() => {
                  Alert.alert('Adopt a Pet', `Adopt a ${p.label} for this chat?`, [
                    {text: 'Cancel', style: 'cancel'},
                    {text: 'Adopt!', onPress: async () => {
                      await createChatPet(chatId, p.id, p.label);
                      setHasPet(true);
                    }},
                  ]);
                }}>
                <Text style={{fontSize: 20}}>{p.icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </GlassView>
      </>
      )}

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Features</Text>
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('Whiteboard' as never, {chatId} as never)}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>Whiteboard</Text>
        </TouchableOpacity>
      </GlassView>

      <GlassView style={[styles.section, {borderColor: colors.glassBorder}]}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>{'\uD83D\uDD12'} Security</Text>
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
        <View style={styles.wallpaperRow}>
          {getExpiryOptions().map(opt => (
            <TouchableOpacity
              key={opt.hours}
              style={[
                styles.themeDot,
                {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, width: 'auto' as any, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6},
                expiryHours === opt.hours && {borderColor: colors.primary, backgroundColor: colors.primary + '20'},
              ]}
              onPress={async () => {
                setExpiryHours(opt.hours);
                await setChatExpiryPolicy(chatId, opt.hours);
              }}>
              <Text style={[{fontSize: 12, fontWeight: '600'}, {color: expiryHours === opt.hours ? colors.primary : colors.text}]}>
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
        <TouchableOpacity style={styles.row} onPress={handleDeleteChat}>
          <Text style={[styles.rowLabel, {color: colors.danger}]}>{t('chatSettings.deleteChat')}</Text>
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
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 14,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  wallpaperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  themeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  themeDotSelected: {
    borderWidth: 2,
  },
  modalContainer: {
    flex: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
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
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontWeight: '600',
  },
  clearNameButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  clearNameText: {
    fontSize: 13,
  },
});

