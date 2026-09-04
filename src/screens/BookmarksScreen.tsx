import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
  FlatList,
  Platform,
} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {getColors} from '../theme/colors';
import {listenBookmarks, removeBookmark} from '../services/bookmarks';
import {BookmarkedMessage} from '../types';
import GlassScreen from '../components/GlassScreen';
import GlassView from '../components/GlassView';
import {useNavigation} from '@react-navigation/native';

export default function BookmarksScreen() {
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const navigation = useNavigation<any>();
  const [bookmarks, setBookmarks] = useState<BookmarkedMessage[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    return listenBookmarks(user.uid, setBookmarks);
  }, [user?.uid]);

  const handleRemove = useCallback(
    (bookmark: BookmarkedMessage) => {
      if (!user?.uid) return;
      Alert.alert('Remove Bookmark', 'Remove this saved message?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeBookmark(user.uid, bookmark.id).catch(() => undefined),
        },
      ]);
    },
    [user?.uid],
  );

  const handleNavigateToChat = useCallback(
    (chatId: string) => {
      navigation.navigate('Chats', {
        screen: 'Chat',
        params: {chatId},
      });
    },
    [navigation],
  );

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
  };

  const renderItem = useCallback(
    ({item}: {item: BookmarkedMessage}) => (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleNavigateToChat(item.chatId)}
        onLongPress={() => handleRemove(item)}>
        <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.senderName, {color: colors.primary}]}>
              {item.senderName || 'Unknown'}
            </Text>
            <Text style={[styles.date, {color: colors.textSecondary}]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.messageText, {color: colors.text}]} numberOfLines={4}>
            {item.text || (item.image ? '[Image]' : item.audio ? '[Voice]' : '[Message]')}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.tapHint, {color: colors.textSecondary}]}>
              Tap to open chat
            </Text>
            <TouchableOpacity
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              onPress={() => handleRemove(item)}>
              <Text style={[styles.removeBtn, {color: colors.danger}]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </GlassView>
      </TouchableOpacity>
    ),
    [colors, handleNavigateToChat, handleRemove],
  );

  return (
    <GlassScreen style={styles.container} textureSeed="bookmarks">
      {bookmarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            No bookmarks yet
          </Text>
          <Text style={[styles.emptyHint, {color: colors.textSecondary}]}>
            Long-press a message in any chat and tap "Bookmark" to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
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
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapHint: {
    fontSize: 12,
  },
  removeBtn: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
