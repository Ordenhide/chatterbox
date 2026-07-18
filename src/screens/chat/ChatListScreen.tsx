import React, {memo, useCallback, useMemo, useRef, useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ActionSheetIOS,
  Platform,
  Alert,
  useColorScheme,
  FlatList,
} from 'react-native';
import {useAuth} from '../../contexts/AuthContext';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {ChatRoom} from '../../types';
import {getDrafts} from '../../services/drafts';
import {getCachedChats, setCachedChats} from '../../services/offlineCache';
import {useNetworkStatus} from '../../hooks/useNetworkStatus';
import {
  listenChatsForUser,
  getUsersByIds,
  togglePinChat,
} from '../../services/firebaseChat';
import {getColors} from '../../theme/colors';
import GlassView from '../../components/GlassView';
import GlassScreen from '../../components/GlassScreen';
import {reportError} from '../../services/telemetry';
import {isDecoyMode} from '../../services/appLock';

type ChatListItemProps = {
  id: string;
  displayName?: string;
  name?: string;
  isPinned?: boolean;
  unreadCount?: number;
  draft?: string;
  isTyping?: boolean;
  lastMessage?: ChatRoom['lastMessage'];
  timeLabel?: string;
  avatarText?: string;
  avatarColor: string;
  onPress: () => void;
  onLongPress: () => void;
  textColor: string;
  textSecondary: string;
  warningColor: string;
  dangerColor: string;
  cardBackground: string;
  cardBorder: string;
};

const ChatListItem = memo(
  ({
    displayName,
    name,
    isPinned,
    unreadCount,
    draft,
    isTyping,
    lastMessage,
    timeLabel,
    avatarText,
    avatarColor,
    onPress,
    onLongPress,
    textColor,
    textSecondary,
    warningColor,
    dangerColor,
    cardBackground,
    cardBorder,
  }: ChatListItemProps) => (
    <TouchableOpacity style={styles.chatItem} onPress={onPress} onLongPress={onLongPress}>
      <GlassView blur={false} style={[styles.card, {backgroundColor: cardBackground, borderColor: cardBorder}]}>
        <View style={[styles.avatar, {backgroundColor: avatarColor}]}>
          <Text style={styles.avatarText}>{avatarText || '?'}</Text>
        </View>
        <View style={styles.chatContent}>
          <View style={styles.chatTitleRow}>
            <View style={styles.titleGroup}>
              <Text style={[styles.chatName, {color: textColor}]} numberOfLines={1}>
                {displayName || name}
              </Text>
              {isPinned ? <Text style={[styles.pinLabel, {color: textSecondary}]}>Pinned</Text> : null}
            </View>
            <View style={styles.metaGroup}>
              {timeLabel ? <Text style={[styles.timeText, {color: textSecondary}]}>{timeLabel}</Text> : null}
              {unreadCount ? (
                <View style={[styles.unreadBadge, {backgroundColor: dangerColor}]}>
                  <Text style={styles.unreadText}>{unreadCount}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {draft ? (
            <Text style={[styles.draftText, {color: warningColor}]} numberOfLines={1}>
              {isTyping ? 'Typing…' : `Draft: ${draft}`}
            </Text>
          ) : lastMessage ? (
            <Text style={[styles.lastMessage, {color: textSecondary}]} numberOfLines={1}>
              {lastMessage.text ||
                (lastMessage.moment
                  ? '[Moment]'
                  : lastMessage.image
                  ? '[Photo]'
                  : lastMessage.video
                  ? '[Video]'
                  : lastMessage.audio
                  ? '[Voice]'
                  : lastMessage.file
                  ? '[File]'
                  : '')}
            </Text>
          ) : null}
        </View>
      </GlassView>
    </TouchableOpacity>
  ),
);

export default function ChatListScreen() {
  const [chats, setChats] = useState<
    (ChatRoom & {
      unreadCount?: number;
      draft?: string;
      draftUpdatedAt?: number;
      isPinned?: boolean;
      isTyping?: boolean;
      displayName?: string;
    })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const {user} = useAuth();
  const navigation = useNavigation();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();
  const rawChatsRef = useRef<ChatRoom[]>([]);
  const chatsSignatureRef = useRef<string>('');
  const {isOffline} = useNetworkStatus();
  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCacheRef = useRef<ChatRoom[] | null>(null);

  const scheduleChatCacheWrite = useCallback(
    (nextChats: ChatRoom[]) => {
      pendingCacheRef.current = nextChats;
      if (cacheWriteTimeoutRef.current) return;
      cacheWriteTimeoutRef.current = setTimeout(() => {
        const payload = pendingCacheRef.current;
        pendingCacheRef.current = null;
        cacheWriteTimeoutRef.current = null;
        if (!payload || !user) return;
        setCachedChats(user.uid, payload).catch(error => reportError(error, 'cache_chats'));
      }, 600);
    },
    [user],
  );

  const loadChats = async (userChats: ChatRoom[]) => {
    if (!user) return;

    try {
      const otherIds = Array.from(
        new Set(
          userChats
            .map(chat => chat.participants.find(id => id !== user.uid))
            .filter((id): id is string => !!id),
        ),
      );
      const [usersById, drafts] = await Promise.all([
        getUsersByIds(otherIds),
        getDrafts(user.uid),
      ]);
      const now = Date.now();
      const toMillis = (value: any) =>
        value?.toDate ? value.toDate().getTime() : new Date(value).getTime();

      const signature = userChats
        .map(chat => {
          const otherId = chat.participants.find(id => id !== user.uid);
          const typingAt = otherId ? chat.typingBy?.[otherId] || 0 : 0;
          const lastMessageTime = chat.lastMessage?.createdAt
            ? toMillis(chat.lastMessage.createdAt as any)
            : toMillis(chat.createdAt);
          const updatedAtTime = chat.updatedAt ? toMillis(chat.updatedAt as any) : lastMessageTime;
          const draftUpdatedAt = drafts[chat.id]?.updatedAt || 0;
          const unreadCount = chat.unreadCountBy?.[user.uid] || 0;
          const pinnedFlag = chat.pinnedBy?.includes(user.uid) ? 1 : 0;
          return `${chat.id}:${updatedAtTime}:${lastMessageTime}:${unreadCount}:${draftUpdatedAt}:${pinnedFlag}:${typingAt}`;
        })
        .sort()
        .join('|');
      if (signature === chatsSignatureRef.current) {
        setLoading(false);
        return;
      }
      chatsSignatureRef.current = signature;

      const enriched = userChats.map(chat => {
        const draftEntry = drafts[chat.id];
        const draft = draftEntry?.text || '';
        const draftUpdatedAt = draftEntry?.updatedAt;
        const isPinned = chat.pinnedBy?.includes(user.uid) || false;
        const unreadCount = chat.unreadCountBy?.[user.uid] || 0;
        const otherId = chat.participants.find(id => id !== user.uid);
        const otherUser = otherId ? usersById[otherId] : null;
        const customName = chat.nameBy?.[user.uid] || '';
        const displayName =
          customName || otherUser?.displayName || otherUser?.email || chat.name || 'Chat';
        const typingAt = otherId ? chat.typingBy?.[otherId] || 0 : 0;
        const isTyping = typingAt ? now - typingAt < 3000 : false;
        return {
          ...chat,
          unreadCount,
          draft,
          draftUpdatedAt,
          isPinned,
          isTyping,
          displayName,
        };
      });

      enriched.sort((a, b) => {
        // Pinned chats always float to the top
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        // Use the most recent timestamp available:
        // updatedAt > lastMessage.createdAt > chat.createdAt
        const getLatestTime = (chat: typeof a): number => {
          const candidates: number[] = [];
          if (chat.updatedAt) {
            const t = toMillis(chat.updatedAt as any);
            if (Number.isFinite(t)) candidates.push(t);
          }
          if (chat.lastMessage?.createdAt) {
            const t = toMillis(chat.lastMessage.createdAt as any);
            if (Number.isFinite(t)) candidates.push(t);
          }
          if (chat.draftUpdatedAt) {
            const t = typeof chat.draftUpdatedAt === 'number' ? chat.draftUpdatedAt : toMillis(chat.draftUpdatedAt);
            if (Number.isFinite(t)) candidates.push(t);
          }
          if (candidates.length > 0) {
            return Math.max(...candidates);
          }
          const fallback = toMillis(chat.createdAt);
          return Number.isFinite(fallback) ? fallback : 0;
        };
        return getLatestTime(b) - getLatestTime(a);
      });
      setChats(enriched);
      scheduleChatCacheWrite(enriched);
      setLoading(false);
    } catch (error) {
      reportError(error, 'loadChats');
      if (__DEV__) {
        console.error('Error loading chats:', error);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadCached = async () => {
      const cached = await getCachedChats(user.uid);
      if (!active) return;
      if (cached.length) {
        setChats(cached as any);
        setLoading(false);
      }
    };
    loadCached();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (cacheWriteTimeoutRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current);
        cacheWriteTimeoutRef.current = null;
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const unsubscribe = listenChatsForUser(user.uid, chatsSnapshot => {
        rawChatsRef.current = chatsSnapshot;
        loadChats(chatsSnapshot);
      });
      return () => {
        unsubscribe();
      };
    }, [user]),
  );

  const createNewChat = () => {
    navigation.navigate('NewChat' as never);
  };

  const onLongPress = (chat: ChatRoom) => {
    if (!user) return;

    const actions = [
      {
        label: chat.pinnedBy?.includes(user.uid) ? t('chatList.unpin') : t('chatList.pin'),
        onPress: () => togglePinChat(chat.id, user.uid),
      },
    ];

    if (Platform.OS === 'ios') {
      const options = [t('common.cancel'), ...actions.map(a => a.label)];
      ActionSheetIOS.showActionSheetWithOptions(
        {options, cancelButtonIndex: 0},
        index => {
          if (index > 0) {
            actions[index - 1].onPress();
          }
        },
      );
      return;
    }

    Alert.alert(t('chatList.actionsTitle'), '', [
      ...actions.map(a => ({text: a.label, onPress: a.onPress})),
      {text: t('common.cancel'), style: 'cancel'},
    ]);
  };

  const filteredChats = useMemo(() => {
    if (isDecoyMode()) return [];
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter(chat => (chat.displayName || '').toLowerCase().includes(query));
  }, [chats, searchQuery]);

  const formatChatTime = (value: any) => {
    const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    }
    return date.toLocaleDateString([], {month: 'short', day: 'numeric'});
  };

  const getInitials = (value?: string) => {
    if (!value) return '?';
    const parts = value.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const second = parts.length > 1 ? parts[1][0] : '';
    return (first + second).toUpperCase();
  };

  const getAvatarColor = (seed: string) => {
    const palette = ['#7C5CFF', '#4B7BEC', '#20BF6B', '#F7B731', '#EB3B5A', '#45AAF2'];
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) % palette.length;
    }
    return palette[hash] || palette[0];
  };

  if (loading) {
    return (
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <GlassScreen style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, {color: colors.text}]}>{t('chatList.title')}</Text>
        <TouchableOpacity style={[styles.newChatButton, {backgroundColor: colors.primary}]} onPress={createNewChat}>
          <Text style={styles.newChatText}>{t('common.new')}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[
          styles.searchInput,
          {
            borderColor: colors.glassBorder,
            color: colors.text,
            backgroundColor: colors.surface,
            borderWidth: Platform.OS === 'ios' ? 0 : 1,
          },
        ]}
        placeholder={t('chatList.searchPlaceholder')}
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      <FlatList
        data={filteredChats}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <ChatListItem
            id={item.id}
            displayName={item.displayName}
            name={item.name}
            isPinned={item.isPinned}
            unreadCount={item.unreadCount}
            draft={item.draft}
            isTyping={item.isTyping}
            lastMessage={item.lastMessage}
            timeLabel={formatChatTime(item.lastMessage?.createdAt || item.createdAt)}
            avatarText={getInitials(item.displayName || item.name)}
            avatarColor={getAvatarColor(item.displayName || item.name || item.id)}
            onPress={() =>
              navigation.navigate('Chat' as never, {
                chatId: item.id,
                chatName: item.displayName || item.name,
              } as never)
            }
            onLongPress={() => onLongPress(item)}
            textColor={colors.text}
            textSecondary={colors.textSecondary}
            warningColor={colors.warning}
            dangerColor={colors.danger}
            cardBackground={colors.surface}
            cardBorder={colors.glassBorder}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {isOffline ? t('chatList.offlineEmpty') : t('chatList.empty')}
          </Text>
        }
      />
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  newChatButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  newChatText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  searchInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 0,
    marginHorizontal: 20,
    marginBottom: 14,
    height: 40,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 2,
  },
  listContent: {
    paddingBottom: 28,
    paddingTop: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  chatContent: {
    flex: 1,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaGroup: {
    alignItems: 'flex-end',
    gap: 6,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  lastMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  draftText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    paddingTop: 60,
  },
});

