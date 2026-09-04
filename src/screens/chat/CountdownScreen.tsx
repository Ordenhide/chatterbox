import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  FlatList,
  Platform,
  useColorScheme,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {useAuth} from '../../contexts/AuthContext';
import {useArtifactCrypto} from '../../hooks/useArtifactCrypto';
import {getColors} from '../../theme/colors';
import {
  createCountdown,
  deleteCountdown,
  rsvpCountdown,
  listenCountdowns,
} from '../../services/countdown';
import {SharedCountdown} from '../../types';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';
import {bodyWeight} from '../../theme/typography';

const EMOJI_OPTIONS = ['\u{1F389}', '\u{1F382}', '\u2708\uFE0F', '\u{1F3B5}', '\u{1F4C5}', '\u{1F31F}', '\u{1F37B}', '\u{1F3C6}'];

function formatRemaining(targetDate: number): string {
  const diff = targetDate - Date.now();
  if (diff <= 0) return '';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function CountdownTicker({targetDate}: {targetDate: number}) {
  const colors = getColors(useColorScheme());
  const [remaining, setRemaining] = useState(() => formatRemaining(targetDate));

  useEffect(() => {
    const id = setInterval(() => setRemaining(formatRemaining(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const passed = targetDate <= Date.now();

  return (
    <Text
      style={[
        styles.countdownText,
        {color: passed ? colors.textSecondary : colors.primary},
      ]}>
      {passed ? 'Event passed!' : remaining}
    </Text>
  );
}

export default function CountdownScreen() {
  const route = useRoute();
  const chatId = (route.params as any)?.chatId as string;
  const {user} = useAuth();
  const crypto = useArtifactCrypto(chatId);
  const colors = getColors(useColorScheme());
  const [countdowns, setCountdowns] = useState<SharedCountdown[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    if (!chatId) return;
    return listenCountdowns(chatId, setCountdowns, crypto);
  }, [chatId, crypto]);

  const openModal = useCallback(() => {
    setTitle('');
    setEmoji(EMOJI_OPTIONS[0]);
    setDateStr('');
    setTimeStr('');
    setModalVisible(true);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!chatId || !user) return;
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Missing title', 'Please enter a title for the countdown.');
      return;
    }
    const parsed = new Date(`${dateStr}T${timeStr || '00:00'}`);
    if (isNaN(parsed.getTime())) {
      Alert.alert('Invalid date', 'Please enter a valid date (YYYY-MM-DD).');
      return;
    }
    try {
      await createCountdown(
        chatId,
        {
          title: trimmed,
          targetDate: parsed.getTime(),
          emoji,
          createdBy: user.uid,
          createdByName: user.displayName || user.email || 'User',
        },
        crypto,
      );
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to create countdown.');
    }
    // crypto starts inert and resolves a round trip later; leaving it out
    // means a countdown created after it resolved is still written in the
    // clear, because the inert sealer returns null.
  }, [chatId, user, title, emoji, dateStr, timeStr, crypto]);

  const handleDelete = useCallback(
    (item: SharedCountdown) => {
      Alert.alert('Delete Countdown', `Remove "${item.title}"?`, [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCountdown(chatId, item.id).catch(() => undefined),
        },
      ]);
    },
    [chatId],
  );

  const handleRsvp = useCallback(
    (countdownId: string, status: 'going' | 'maybe' | 'skip') => {
      if (!user?.uid) return;
      rsvpCountdown(chatId, countdownId, user.uid, status).catch(() => undefined);
    },
    [chatId, user?.uid],
  );

  const renderItem = useCallback(
    ({item}: {item: SharedCountdown}) => {
      const myRsvp = user?.uid ? item.rsvps?.[user.uid] : undefined;
      return (
        <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
          <View style={styles.cardHeader}>
            <Text style={styles.emojiLabel}>{item.emoji || '\u{1F389}'}</Text>
            <Text style={[styles.cardTitle, {color: colors.text}]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          <CountdownTicker targetDate={item.targetDate} />
          <View style={styles.rsvpRow}>
            {(['going', 'maybe', 'skip'] as const).map(status => {
              const active = myRsvp === status;
              const label = status.charAt(0).toUpperCase() + status.slice(1);
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.rsvpBtn,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleRsvp(item.id, status)}>
                  <Text
                    style={[
                      styles.rsvpLabel,
                      {color: active ? colors.textOnPrimary : colors.text},
                    ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {user?.uid === item.createdBy && (
            <TouchableOpacity
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              onPress={() => handleDelete(item)}
              style={styles.deleteBtn}>
              <Text style={[styles.deleteBtnText, {color: colors.danger}]}>Delete</Text>
            </TouchableOpacity>
          )}
        </GlassView>
      );
    },
    [colors, user?.uid, handleRsvp, handleDelete],
  );

  return (
    <GlassScreen style={styles.container} textureSeed={chatId}>
      {countdowns.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{'\u{1F570}\uFE0F'}</Text>
          <Text style={[styles.emptyTitle, {color: colors.text}]}>No Countdowns</Text>
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            Tap + to create a shared countdown for the group.
          </Text>
        </View>
      ) : (
        <FlatList
          data={countdowns}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, {backgroundColor: colors.primary}]}
        onPress={openModal}>
        <Text style={[styles.fabText, {color: colors.textOnPrimary}]}>+</Text>
      </TouchableOpacity>

      {modalVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={[styles.modalContainer, {backgroundColor: colors.backdrop}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>New Countdown</Text>
            <TextInput
              style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
              placeholder="Title"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>Emoji</Text>
            <View style={styles.emojiRow}>
              {EMOJI_OPTIONS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[
                    styles.emojiChip,
                    {
                      backgroundColor: emoji === e ? colors.primaryLight : colors.surface,
                      borderColor: emoji === e ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setEmoji(e)}>
                  <Text style={styles.emojiChipText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>Date</Text>
            <TextInput
              style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              value={dateStr}
              onChangeText={setDateStr}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />
            <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>Time (optional)</Text>
            <TextInput
              style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
              placeholder="HH:MM"
              placeholderTextColor={colors.textSecondary}
              value={timeStr}
              onChangeText={setTimeStr}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}]}
                onPress={handleCreate}>
                <Text style={[styles.modalButtonText, {color: colors.textOnPrimary}]}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalButtonTextDark, {color: colors.text}]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  list: {padding: 16, paddingBottom: 100},
  card: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  emojiLabel: {fontSize: 24, marginEnd: 10},
  cardTitle: {fontSize: 17, fontFamily: bodyWeight('700'), flex: 1},
  countdownText: {fontSize: 22, fontFamily: bodyWeight('800'), marginBottom: 12},
  rsvpRow: {flexDirection: 'row', gap: 8},
  rsvpBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
  },
  rsvpLabel: {fontSize: 13, fontFamily: bodyWeight('700')},
  deleteBtn: {marginTop: 10, alignSelf: 'flex-end'},
  deleteBtnText: {fontSize: 13, fontFamily: bodyWeight('600')},
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {fontSize: 48, marginBottom: 16},
  emptyTitle: {fontSize: 20, fontFamily: bodyWeight('700'), marginBottom: 8},
  emptyText: {fontSize: 14, textAlign: 'center', lineHeight: 20},
  fab: {
    position: 'absolute',
    bottom: 32,
    end: 24,
    width: 56,
    height: 56,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  fabText: {fontSize: 28, color: '#fff', fontFamily: bodyWeight('600'), marginTop: -2},
  modalContainer: {flex: 1, padding: 20},
  modalTitle: {fontSize: 20, fontFamily: bodyWeight('700'), marginBottom: 18},
  sectionLabel: {fontSize: 13, fontFamily: bodyWeight('600'), marginBottom: 6, marginTop: 4},
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  emojiRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiChipText: {fontSize: 22},
  modalActions: {flexDirection: 'row', gap: 12, marginTop: 8},
  modalButton: {flex: 1, paddingVertical: 14, borderRadius: 2, alignItems: 'center'},
  modalButtonText: {color: '#fff', fontSize: 16, fontFamily: bodyWeight('700')},
  modalButtonTextDark: {fontSize: 16, fontFamily: bodyWeight('700')},
});
