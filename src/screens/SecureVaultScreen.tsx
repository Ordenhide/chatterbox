import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  useColorScheme,
} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {getColors} from '../theme/colors';
import GlassScreen from '../components/GlassScreen';
import GlassView from '../components/GlassView';
import {getVaultItems, addVaultItem, removeVaultItem, clearVault} from '../services/secureVault';
import {VaultItem} from '../types';

const TYPE_ICONS: Record<VaultItem['type'], string> = {
  photo: '\u{1F4F7}',
  file: '\u{1F4C4}',
  note: '\u{1F4DD}',
};

export default function SecureVaultScreen() {
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const [items, setItems] = useState<VaultItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [addType, setAddType] = useState<VaultItem['type'] | null>(null);
  const [name, setName] = useState('');
  const [uri, setUri] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const loadItems = useCallback(async () => {
    const data = await getVaultItems();
    setItems(data);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = useCallback((item: VaultItem) => {
    Alert.alert('Delete Item', `Remove "${item.name}" from vault?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeVaultItem(item.id);
          setItems(prev => prev.filter(i => i.id !== item.id));
        },
      },
    ]);
  }, []);

  const handleClearAll = useCallback(() => {
    if (items.length === 0) return;
    Alert.alert('Clear Vault', 'Remove all items from your secure vault? This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearVault();
          setItems([]);
        },
      },
    ]);
  }, [items.length]);

  const openAddModal = useCallback(() => {
    setAddType(null);
    setName('');
    setUri('');
    setNoteContent('');
    setModalVisible(true);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!addType || !name.trim()) return;
    const item: Omit<VaultItem, 'id' | 'createdAt'> = {
      type: addType,
      name: name.trim(),
    };
    if (addType === 'note') {
      item.note = noteContent;
    } else {
      item.uri = uri.trim() || undefined;
    }
    const created = await addVaultItem(item);
    setItems(prev => [created, ...prev]);
    setModalVisible(false);
  }, [addType, name, uri, noteContent]);

  const formatDate = useCallback((ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
  }, []);

  const renderItem = useCallback(({item}: {item: VaultItem}) => (
    <GlassView style={[styles.itemCard, {borderColor: colors.glassBorder}]}>
      <View style={styles.itemRow}>
        <Text style={styles.itemIcon}>{TYPE_ICONS[item.type]}</Text>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, {color: colors.text}]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.itemDate, {color: colors.textSecondary}]}>{formatDate(item.createdAt)}</Text>
          {item.type === 'note' && item.note ? (
            <Text style={[styles.itemNote, {color: colors.textSecondary}]} numberOfLines={2}>{item.note}</Text>
          ) : null}
        </View>
        <TouchableOpacity style={[styles.deleteBtn, {backgroundColor: colors.danger + '18'}]} onPress={() => handleDelete(item)}>
          <Text style={[styles.deleteBtnText, {color: colors.danger}]}>X</Text>
        </TouchableOpacity>
      </View>
    </GlassView>
  ), [colors, formatDate, handleDelete]);

  const keyExtractor = useCallback((item: VaultItem) => item.id, []);

  const ListEmpty = useCallback(() => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{'\u{1F512}'}</Text>
      <Text style={[styles.emptyText, {color: colors.textSecondary}]}>Your vault is empty</Text>
    </View>
  ), [colors.textSecondary]);

  return (
    <GlassScreen>
      <View style={styles.header}>
        <Text style={[styles.title, {color: colors.text}]}>Secure Vault</Text>
        {items.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={[styles.clearText, {color: colors.danger}]}>Clear All</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmpty}
      />
      <TouchableOpacity style={[styles.fab, {backgroundColor: colors.primary}]} onPress={openAddModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {modalVisible ? (
        <Modal visible animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>Add to Vault</Text>

            {!addType ? (
              <View style={styles.typeButtons}>
                {(['photo', 'file', 'note'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, {backgroundColor: colors.primaryLight, borderColor: colors.border}]}
                    onPress={() => setAddType(t)}>
                    <Text style={styles.typeBtnIcon}>{TYPE_ICONS[t]}</Text>
                    <Text style={[styles.typeBtnLabel, {color: colors.text}]}>
                      Add {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.formArea}>
                <Text style={[styles.formLabel, {color: colors.textSecondary}]}>Name</Text>
                <TextInput
                  style={[styles.input, {color: colors.text, borderColor: colors.glassBorder, backgroundColor: colors.surface}]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Item name"
                  placeholderTextColor={colors.textSecondary}
                />
                {addType === 'note' ? (
                  <>
                    <Text style={[styles.formLabel, {color: colors.textSecondary}]}>Note</Text>
                    <TextInput
                      style={[styles.input, styles.noteInput, {color: colors.text, borderColor: colors.glassBorder, backgroundColor: colors.surface}]}
                      value={noteContent}
                      onChangeText={setNoteContent}
                      placeholder="Write your note..."
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      textAlignVertical="top"
                    />
                  </>
                ) : (
                  <>
                    <Text style={[styles.formLabel, {color: colors.textSecondary}]}>URI</Text>
                    <TextInput
                      style={[styles.input, {color: colors.text, borderColor: colors.glassBorder, backgroundColor: colors.surface}]}
                      value={uri}
                      onChangeText={setUri}
                      placeholder="file:// or content:// path"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="none"
                    />
                  </>
                )}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.formBtn, {backgroundColor: colors.primary}, !name.trim() && {opacity: 0.5}]}
                    onPress={handleAdd}
                    disabled={!name.trim()}>
                    <Text style={styles.formBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formBtn, {backgroundColor: colors.surface}]}
                    onPress={() => setAddType(null)}>
                    <Text style={[styles.formBtnTextAlt, {color: colors.text}]}>Back</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.closeBtn, {backgroundColor: colors.surface}]}
              onPress={() => setModalVisible(false)}>
              <Text style={[styles.closeBtnText, {color: colors.text}]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      ) : null}
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  clearText: {
    fontSize: 15,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    flexGrow: 1,
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemDate: {
    fontSize: 12,
    marginTop: 2,
  },
  itemNote: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '400',
    marginTop: -2,
  },
  modalContainer: {
    flex: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  typeButtons: {
    gap: 12,
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  typeBtnIcon: {
    fontSize: 26,
  },
  typeBtnLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  formArea: {
    flex: 1,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  },
  noteInput: {
    height: 160,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  formBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  formBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  formBtnTextAlt: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
