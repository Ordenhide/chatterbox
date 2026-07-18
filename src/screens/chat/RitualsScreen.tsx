import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  FlatList,
  useColorScheme,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {useAuth} from '../../contexts/AuthContext';
import {getColors} from '../../theme/colors';
import {
  createRitual,
  deleteRitual,
  completeRitual,
  listenRituals,
  getRitualPrompts,
} from '../../services/chatRituals';
import {ChatRitual} from '../../types';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';

const SCHEDULES: ChatRitual['schedule'][] = ['daily', 'weekly', 'monthly'];

export default function RitualsScreen() {
  const route = useRoute();
  const chatId = (route.params as any)?.chatId as string;
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const [rituals, setRituals] = useState<ChatRitual[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState<ChatRitual['schedule']>('daily');

  useEffect(() => {
    if (!chatId) return;
    const unsub = listenRituals(chatId, setRituals);
    return () => unsub();
  }, [chatId]);

  const handleAdd = useCallback(async () => {
    if (!chatId || !user) return;
    const trimmedTitle = title.trim();
    const trimmedPrompt = prompt.trim();
    if (!trimmedTitle || !trimmedPrompt) {
      Alert.alert('Missing fields', 'Please enter a title and prompt.');
      return;
    }
    try {
      await createRitual(chatId, {
        chatId,
        title: trimmedTitle,
        prompt: trimmedPrompt,
        schedule,
        time: '09:00',
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'User',
      });
      setTitle('');
      setPrompt('');
      setSchedule('daily');
      setAddVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to create ritual.');
    }
  }, [chatId, user, title, prompt, schedule]);

  const handleComplete = useCallback(
    async (ritualId: string) => {
      if (!chatId) return;
      try {
        await completeRitual(chatId, ritualId);
        Alert.alert('🔥 Streak!', 'Nice — keep it going!');
      } catch {
        Alert.alert('Error', 'Failed to complete ritual.');
      }
    },
    [chatId],
  );

  const handleDelete = useCallback(
    (ritualId: string) => {
      Alert.alert('Delete Ritual', 'Are you sure?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteRitual(chatId, ritualId).catch(() =>
              Alert.alert('Error', 'Failed to delete ritual.'),
            ),
        },
      ]);
    },
    [chatId],
  );

  const renderItem = useCallback(
    ({item}: {item: ChatRitual}) => (
      <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, {color: colors.text}]}>{item.title}</Text>
          <Text style={[styles.streak, {color: colors.warning}]}>
            🔥 {item.streak}
          </Text>
        </View>
        <Text style={[styles.cardPrompt, {color: colors.textSecondary}]}>
          {item.prompt}
        </Text>
        <Text style={[styles.scheduleLabel, {color: colors.primary}]}>
          {item.schedule}
        </Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.completeBtn, {backgroundColor: colors.success}]}
            onPress={() => handleComplete(item.id)}>
            <Text style={styles.completeBtnText}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Text style={[styles.deleteText, {color: colors.danger}]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </GlassView>
    ),
    [colors, handleComplete, handleDelete],
  );

  const suggestedPrompts = getRitualPrompts();

  return (
    <GlassScreen style={styles.container}>
      <FlatList
        data={rituals}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
              No rituals yet
            </Text>
            <Text style={[styles.emptyHint, {color: colors.textSecondary}]}>
              Tap + to create a recurring prompt
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, {backgroundColor: colors.primary}]}
        onPress={() => setAddVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {addVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setAddVisible(false)}>
          <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>New Ritual</Text>
            <TextInput
              style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
              placeholder="Title"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
              placeholder="Prompt"
              placeholderTextColor={colors.textSecondary}
              value={prompt}
              onChangeText={setPrompt}
              multiline
            />

            <View style={styles.scheduleRow}>
              {SCHEDULES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.scheduleChip,
                    {
                      backgroundColor: schedule === s ? colors.primary : colors.surface,
                      borderColor: schedule === s ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSchedule(s)}>
                  <Text
                    style={[
                      styles.scheduleChipText,
                      {color: schedule === s ? '#fff' : colors.text},
                    ]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.suggestedLabel, {color: colors.textSecondary}]}>
              Suggested prompts
            </Text>
            <View style={styles.chipsContainer}>
              {suggestedPrompts.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.promptChip, {backgroundColor: colors.primaryLight}]}
                  onPress={() => setPrompt(p)}>
                  <Text style={[styles.promptChipText, {color: colors.primary}]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}]}
                onPress={handleAdd}>
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.surface}]}
                onPress={() => setAddVisible(false)}>
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
  list: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100},
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8},
  streak: {fontSize: 15, fontWeight: '700'},
  cardPrompt: {fontSize: 14, marginBottom: 6},
  scheduleLabel: {fontSize: 12, fontWeight: '600', textTransform: 'capitalize', marginBottom: 10},
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completeBtn: {paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10},
  completeBtnText: {color: '#fff', fontSize: 14, fontWeight: '700'},
  deleteText: {fontSize: 13, fontWeight: '600'},
  emptyContainer: {alignItems: 'center', marginTop: 60},
  emptyText: {fontSize: 17, fontWeight: '600', marginBottom: 6},
  emptyHint: {fontSize: 14},
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  fabText: {fontSize: 28, color: '#fff', fontWeight: '600', marginTop: -2},
  modalContainer: {flex: 1, padding: 20},
  modalTitle: {fontSize: 20, fontWeight: '700', marginBottom: 18},
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  scheduleRow: {flexDirection: 'row', gap: 10, marginBottom: 20},
  scheduleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  scheduleChipText: {fontSize: 14, fontWeight: '700', textTransform: 'capitalize'},
  suggestedLabel: {fontSize: 13, fontWeight: '600', marginBottom: 10},
  chipsContainer: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24},
  promptChip: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10},
  promptChipText: {fontSize: 13, fontWeight: '600'},
  modalActions: {flexDirection: 'row', gap: 12},
  modalButton: {flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center'},
  modalButtonText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  modalButtonTextDark: {fontSize: 16, fontWeight: '700'},
});
