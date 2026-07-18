import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  FlatList,
  Image,
  RefreshControl,
} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {getColors} from '../theme/colors';
import {loadMemories} from '../services/memories';
import {MemoryCard} from '../types';
import GlassScreen from '../components/GlassScreen';
import GlassView from '../components/GlassView';
import {useNavigation} from '@react-navigation/native';

const TYPE_CONFIG: Record<MemoryCard['type'], {icon: string; label: string; color: string}> = {
  on_this_day: {icon: '\uD83D\uDCC5', label: 'On This Day', color: '#FF9500'},
  first_message: {icon: '\uD83C\uDF1F', label: 'Where It All Began', color: '#AF52DE'},
  milestone: {icon: '\uD83C\uDFC6', label: 'Milestone', color: '#34C759'},
  most_reacted: {icon: '\uD83D\uDD25', label: 'Fan Favorite', color: '#FF2D55'},
};

export default function MemoriesScreen() {
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const navigation = useNavigation();
  const [memories, setMemories] = useState<MemoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const result = await loadMemories(user.uid);
      setMemories(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetch();
  }, [fetch]);

  const handleNavigate = useCallback(
    (chatId: string) => {
      navigation.navigate('Chats' as never, {screen: 'Chat', params: {chatId}} as never);
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({item}: {item: MemoryCard}) => {
      const cfg = TYPE_CONFIG[item.type];
      return (
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleNavigate(item.chatId)}>
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            <View style={[styles.badge, {backgroundColor: cfg.color + '20'}]}>
              <Text style={styles.badgeIcon}>{cfg.icon}</Text>
              <Text style={[styles.badgeLabel, {color: cfg.color}]}>{cfg.label}</Text>
            </View>
            <Text style={[styles.chatName, {color: colors.primary}]} numberOfLines={1}>
              {item.chatName}
            </Text>
            {item.image ? (
              <Image source={{uri: item.image}} style={styles.memoryImage} resizeMode="cover" />
            ) : null}
            <Text style={[styles.messageText, {color: colors.text}]} numberOfLines={4}>
              {item.text}
            </Text>
            <View style={styles.footer}>
              <Text style={[styles.sender, {color: colors.textSecondary}]}>
                {item.senderName}
              </Text>
              <Text style={[styles.ago, {color: colors.textSecondary}]}>
                {item.agoLabel}
              </Text>
            </View>
            {item.reactionCount ? (
              <Text style={[styles.reactionBadge, {color: cfg.color}]}>
                {item.reactionCount} reaction{item.reactionCount > 1 ? 's' : ''}
              </Text>
            ) : null}
          </GlassView>
        </TouchableOpacity>
      );
    },
    [colors, handleNavigate],
  );

  if (loading) {
    return (
      <GlassScreen style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Searching your memories...
          </Text>
        </View>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen style={styles.container}>
      {memories.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>{'\uD83D\uDCED'}</Text>
          <Text style={[styles.emptyTitle, {color: colors.text}]}>No memories yet</Text>
          <Text style={[styles.emptyHint, {color: colors.textSecondary}]}>
            Keep chatting! Memories surface when you have messages from previous months or years on today's date, highly-reacted messages, and chat milestones.
          </Text>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          windowSize={7}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={[styles.headerTitle, {color: colors.text}]}>Your Memories</Text>
              <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
                Moments worth remembering from your conversations
              </Text>
            </View>
          }
        />
      )}
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40},
  loadingText: {marginTop: 16, fontSize: 15},
  list: {padding: 16, paddingBottom: 32},
  header: {marginBottom: 20, paddingHorizontal: 4},
  headerTitle: {fontSize: 28, fontWeight: '800', letterSpacing: -0.5},
  headerSubtitle: {fontSize: 14, marginTop: 4, lineHeight: 20},
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  badgeIcon: {fontSize: 14, marginRight: 5},
  badgeLabel: {fontSize: 12, fontWeight: '700', letterSpacing: 0.3},
  chatName: {fontSize: 13, fontWeight: '600', marginBottom: 6},
  memoryImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
  },
  messageText: {fontSize: 16, lineHeight: 24, fontWeight: '500'},
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  sender: {fontSize: 12, fontWeight: '600'},
  ago: {fontSize: 12},
  reactionBadge: {fontSize: 12, fontWeight: '700', marginTop: 6},
  emptyIcon: {fontSize: 56, marginBottom: 16},
  emptyTitle: {fontSize: 20, fontWeight: '700', marginBottom: 8},
  emptyHint: {fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 300},
});
