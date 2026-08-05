import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
import {addTrack, removeTrack, voteTrack, listenPlaylist} from '../../services/playlist';
import {PlaylistItem} from '../../types';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';

export default function PlaylistScreen() {
  const route = useRoute();
  const chatId = (route.params as any)?.chatId as string;
  const {user} = useAuth();
  const crypto = useArtifactCrypto(chatId);
  const colors = getColors(useColorScheme());
  const [tracks, setTracks] = useState<PlaylistItem[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!chatId) return;
    const unsub = listenPlaylist(chatId, setTracks, crypto);
    return () => unsub();
  }, [chatId, crypto]);

  const sorted = useMemo(
    () => [...tracks].sort((a, b) => b.votes.length - a.votes.length),
    [tracks],
  );

  const handleAdd = useCallback(async () => {
    if (!chatId || !user) return;
    const trimmedTitle = trackTitle.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle || !trimmedUrl) {
      Alert.alert('Missing fields', 'Please enter a title and URL.');
      return;
    }
    try {
      await addTrack(
        chatId,
        {
          url: trimmedUrl,
          title: trimmedTitle,
          artist: artist.trim() || undefined,
          addedBy: user.uid,
          addedByName: user.displayName || user.email || 'User',
        },
        crypto,
      );
      setTrackTitle('');
      setArtist('');
      setUrl('');
      setAddVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to add track.');
    }
  }, [chatId, user, trackTitle, artist, url]);

  const handleVote = useCallback(
    async (trackId: string) => {
      if (!chatId || !user) return;
      try {
        await voteTrack(chatId, trackId, user.uid);
      } catch {
        Alert.alert('Error', 'Failed to vote.');
      }
    },
    [chatId, user],
  );

  const handleRemove = useCallback(
    (trackId: string) => {
      Alert.alert('Remove Track', 'Are you sure?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            removeTrack(chatId, trackId).catch(() =>
              Alert.alert('Error', 'Failed to remove track.'),
            ),
        },
      ]);
    },
    [chatId],
  );

  const renderItem = useCallback(
    ({item}: {item: PlaylistItem}) => {
      const voted = user ? item.votes.includes(user.uid) : false;
      return (
        <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
          <View style={styles.cardRow}>
            <View style={styles.cardInfo}>
              <Text style={[styles.trackTitle, {color: colors.text}]}>{item.title}</Text>
              {item.artist ? (
                <Text style={[styles.trackArtist, {color: colors.textSecondary}]}>
                  {item.artist}
                </Text>
              ) : null}
              <Text style={[styles.addedBy, {color: colors.textSecondary}]}>
                Added by {item.addedByName || item.addedBy.substring(0, 8)}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                {backgroundColor: voted ? colors.primary : colors.primaryLight},
              ]}
              onPress={() => handleVote(item.id)}>
              <Text style={[styles.voteText, {color: voted ? '#fff' : colors.primary}]}>
                ▲ {item.votes.length}
              </Text>
            </TouchableOpacity>
          </View>
          {user?.uid === item.addedBy && (
            <TouchableOpacity onPress={() => handleRemove(item.id)} style={styles.removeBtn}>
              <Text style={[styles.removeText, {color: colors.danger}]}>Remove</Text>
            </TouchableOpacity>
          )}
        </GlassView>
      );
    },
    [colors, user, handleVote, handleRemove],
  );

  return (
    <GlassScreen style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            No tracks yet
          </Text>
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
            <Text style={[styles.modalTitle, {color: colors.text}]}>Add Track</Text>
            <TextInput
              style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
              placeholder="Title"
              placeholderTextColor={colors.textSecondary}
              value={trackTitle}
              onChangeText={setTrackTitle}
            />
            <TextInput
              style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
              placeholder="Artist (optional)"
              placeholderTextColor={colors.textSecondary}
              value={artist}
              onChangeText={setArtist}
            />
            <TextInput
              style={[styles.input, {color: colors.text, borderColor: colors.glassBorder}]}
              placeholder="URL"
              placeholderTextColor={colors.textSecondary}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, {backgroundColor: colors.primary}]}
                onPress={handleAdd}>
                <Text style={styles.modalButtonText}>Add</Text>
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
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  cardRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  cardInfo: {flex: 1, marginRight: 12},
  trackTitle: {fontSize: 15, fontWeight: '700'},
  trackArtist: {fontSize: 13, marginTop: 2},
  addedBy: {fontSize: 12, marginTop: 4},
  voteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 54,
  },
  voteText: {fontSize: 14, fontWeight: '700'},
  removeBtn: {marginTop: 8, alignSelf: 'flex-end'},
  removeText: {fontSize: 13, fontWeight: '600'},
  emptyText: {textAlign: 'center', marginTop: 60, fontSize: 15},
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
  modalActions: {flexDirection: 'row', gap: 12, marginTop: 8},
  modalButton: {flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center'},
  modalButtonText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  modalButtonTextDark: {fontSize: 16, fontWeight: '700'},
});
