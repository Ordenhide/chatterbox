import React, {memo, useCallback, useMemo, useRef, useState, useEffect} from 'react';
import ListEntrance from '../../components/ListEntrance';
import Cascade from '../../components/Cascade';
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
  toggleHideChat,
} from '../../services/firebaseChat';
import {getColors} from '../../theme/colors';
import {fonts, terminal} from '../../theme/typography';
import CornerBrackets from '../../components/CornerBrackets';
import GlassView from '../../components/GlassView';
import GlassScreen from '../../components/GlassScreen';
import {reportError} from '../../services/telemetry';
import {avatarNeutral, getInitials} from '../../utils/avatar';
import {isDecoyMode} from '../../services/appLock';
import {SHOW_NATIVE_ONLY_FEATURES} from '../../config/parity';
import {isChatHidden, partitionChats, unreadTotal} from '../../services/hiddenChats';
import {
  enrollmentReadiness,
  hasRevealedRecoveryPhrase,
  type EnrollmentReadiness,
} from '../../services/e2eeKeys';
import RecoveryPhraseRevealModal from '../../components/RecoveryPhraseRevealModal';

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
  unreadColor: string;
  unreadTextColor: string;
  bracketColor: string;
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
    unreadColor,
    unreadTextColor,
    bracketColor,
  }: ChatListItemProps) => (
    <TouchableOpacity style={styles.chatItem} onPress={onPress} onLongPress={onLongPress}>
      <GlassView blur={false} style={[styles.card, {backgroundColor: cardBackground, borderColor: cardBorder}]}>
        <View style={[styles.avatar, {borderColor: avatarColor}]}>
          <Text style={[styles.avatarText, {color: textColor}]}>{avatarText || '?'}</Text>
          {/* Inset by 2: at 0 the ticks land on the avatar's own hairline and
              the accent loses the pixel to the border. */}
          {unreadCount ? <CornerBrackets size={6} inset={2} color={bracketColor} /> : null}
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
                <View style={[styles.unreadBadge, {backgroundColor: unreadColor}]}>
                  <Text style={[styles.unreadText, {color: unreadTextColor}]}>{unreadCount}</Text>
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
  // Hidden chats live in a separate view of this same list.
  const [viewingHidden, setViewingHidden] = useState(false);
  const {user} = useAuth();
  const navigation = useNavigation<any>();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const isDark = scheme === 'dark';
  const {t} = useTranslation();
  const rawChatsRef = useRef<ChatRoom[]>([]);
  const chatsSignatureRef = useRef<string>('');
  const {isOffline} = useNetworkStatus();
  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCacheRef = useRef<ChatRoom[] | null>(null);
  const [recoveryModalVisible, setRecoveryModalVisible] = useState(false);
  // The header's E2E badge reports this rather than asserting "encrypted".
  // The screen already resolves it for the restore prompt below, so the badge
  // costs nothing extra and cannot drift from what the prompt decided.
  const [keyState, setKeyState] = useState<EnrollmentReadiness | null>(null);


  useEffect(() => {
    if (!user) return;
    let active = true;
    // The "save your recovery phrase" modal reveals the phrase via
    // getRecoveryPhrase, which *enrolls* this device if it has no key yet.
    // So it may only be opened when enrolling is known to be safe: on a new
    // install for an account that already has a key elsewhere, opening it
    // would mint and publish a fresh keypair and permanently overwrite the
    // key the user might still be able to restore. Offer restore instead.
    // On 'unknown' (couldn't check) do nothing at all rather than guess —
    // this re-runs on the next sign-in.
    enrollmentReadiness(user.uid)
      .then(readiness => {
        if (!active) return;
        setKeyState(readiness);
        if (readiness === 'unknown') return;
        if (readiness === 'needs-restore') {
          Alert.alert(
            'Restore your message history?',
            'This looks like a new device for an account that already has an encryption key. ' +
              'Restore your recovery phrase to keep reading old messages, or continue and start fresh.',
            [
              {text: 'Not now', style: 'cancel'},
              {text: 'Restore', onPress: () => navigation.navigate('RecoveryPhrase')},
            ],
          );
          return;
        }
        // Separate copy from 'needs-restore' because the user's situation is
        // the opposite one: nothing here is new or missing, so "this looks
        // like a new device" would be plainly wrong and would read as the app
        // having lost track of them. This device was enrolled and has been
        // replaced, and saying so is the only way the silence in the thread
        // ("Sealed to another device", over and over) becomes explicable.
        if (readiness === 'superseded') {
          Alert.alert(
            'Your encryption key changed',
            "This device's key was replaced from another device, so messages sent to you since " +
              "then can't be opened here. Enter that device's recovery phrase to read them.",
            [
              {text: 'Not now', style: 'cancel'},
              {text: 'Restore', onPress: () => navigation.navigate('RecoveryPhrase')},
            ],
          );
          return;
        }
        hasRevealedRecoveryPhrase(user.uid)
          .then(revealed => {
            if (active && !revealed) setRecoveryModalVisible(true);
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user, navigation]);

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
          const hiddenFlag = isChatHidden(chat, user.uid) ? 1 : 0;
          return `${chat.id}:${updatedAtTime}:${lastMessageTime}:${unreadCount}:${draftUpdatedAt}:${pinnedFlag}:${hiddenFlag}:${typingAt}`;
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
      try {
        const cached = await getCachedChats(user.uid);
        if (!active) return;
        if (cached.length) setChats(cached as any);
      } catch (error) {
        reportError(error, 'chat_list_cache_read_failed');
      } finally {
        // Unconditionally, and in a finally.
        //
        // This used to clear only when the cache had something in it, which
        // left `loadChats` — and therefore the listener firing — as the only
        // reliable way off the spinner. That was already fragile and then I
        // made it break: bf00165 and 0b7a0b5 both stopped listenChatsForUser
        // delivering in cases where it previously delivered an empty array, so
        // a transient failure or an unsynced first snapshot went from "shows
        // an empty list for a moment" to "sits on a spinner until you leave
        // the tab and come back". Same blank screen the user saw, new cause,
        // mine.
        //
        // Having read local storage is enough to render: the answer may be
        // "no chats", and the empty state is a real answer. A screen must not
        // depend on a network listener to stop looking broken.
        if (active) setLoading(false);
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
    navigation.navigate('NewChat');
  };

  const onLongPress = (chat: ChatRoom) => {
    if (!user) return;

    const hidden = isChatHidden(chat, user.uid);
    const actions = [
      {
        label: chat.pinnedBy?.includes(user.uid) ? t('chatList.unpin') : t('chatList.pin'),
        onPress: () => togglePinChat(chat.id, user.uid),
      },
      {
        label: hidden ? t('chats.recover') : t('chats.hide'),
        onPress: () => {
          toggleHideChat(chat.id, user.uid, hidden).catch(() =>
            Alert.alert(t('common.error'), ''),
          );
        },
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

  const {visible: visibleChats, hidden: hiddenChats} = useMemo(
    () => (user ? partitionChats(chats, user.uid) : {visible: chats, hidden: []}),
    [chats, user],
  );
  const hiddenUnread = useMemo(
    () => (user ? unreadTotal(hiddenChats, user.uid) : 0),
    [hiddenChats, user],
  );

  const filteredChats = useMemo(() => {
    if (SHOW_NATIVE_ONLY_FEATURES && isDecoyMode()) return [];
    const source = viewingHidden ? hiddenChats : visibleChats;
    if (!searchQuery.trim()) return source;
    const query = searchQuery.toLowerCase();
    return source.filter(chat => (chat.displayName || '').toLowerCase().includes(query));
  }, [visibleChats, hiddenChats, viewingHidden, searchQuery]);

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

  // Both moved to utils/avatar so the chat thread can render the same avatar
  // this list does, instead of gifted-chat's own hashed-hue one.
  const getAvatarColor = (seed: string) => avatarNeutral(seed, isDark);

  if (loading) {
    return (
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <GlassScreen style={styles.container} textureSeed="chat-list">
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={[styles.eyebrow, {color: colors.textSecondary}]}>
            {t('chatList.eyebrow')}
          </Text>
          <Text style={[styles.title, {color: colors.text}]}>
            {viewingHidden ? t('chats.hiddenTitle') : t('chatList.title')}
          </Text>
        </View>
        {viewingHidden ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.newChatButton, {backgroundColor: colors.surface}]}
            onPress={() => {
              setViewingHidden(false);
              setSearchQuery('');
            }}>
            <Text style={[styles.newChatText, {color: colors.text}]}>{t('common.close')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.newChatButton, {backgroundColor: colors.primary}]} onPress={createNewChat}>
            <Text style={[styles.newChatText, {color: colors.textOnPrimary}]}>
              {t('common.new')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Reports the key state this device is actually in. Deliberately not a
          fixed "E2E ACTIVE" label: encryption degrades to plaintext when a
          peer has no published key, and a badge that says "encrypted" no
          matter what is worse than no badge — it is the one claim a user
          cannot check for themselves. */}
      <View style={styles.statusStrip}>
        <View
          style={[
            styles.statusDot,
            {backgroundColor: keyState === 'safe' ? colors.primary : colors.warning},
          ]}
        />
        <Text
          style={[
            styles.statusText,
            {color: keyState === 'safe' ? colors.primary : colors.warning},
          ]}>
          {keyState === null
            ? t('chatList.keyChecking')
            : keyState === 'safe'
            ? t('chatList.keyReady')
            : keyState === 'superseded'
            ? t('chatList.keySuperseded')
            : keyState === 'needs-restore'
            ? t('chatList.keyMissing')
            : t('chatList.keyUnverified')}
        </Text>
        <View style={[styles.statusRule, {backgroundColor: colors.separator}]} />
        <Text style={[styles.statusCount, {color: colors.textSecondary}]}>
          {t('chatList.statChats', {count: chats.length})}
        </Text>
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
      {!viewingHidden && hiddenChats.length > 0 && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('chats.hiddenTitle')}
          style={[styles.hiddenEntry, {borderColor: colors.glassBorder}]}
          onPress={() => setViewingHidden(true)}>
          <Text style={[styles.hiddenEntryText, {color: colors.textSecondary}]}>
            {t('chats.hiddenTitle')}
          </Text>
          <Text style={[styles.hiddenEntryCount, {color: colors.textSecondary}]}>
            {hiddenUnread > 0 ? `${hiddenChats.length} · ${hiddenUnread}` : `${hiddenChats.length}`}
          </Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={filteredChats}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({item, index}) => (
          <ListEntrance index={index}>
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
              navigation.navigate('Chat', {
                chatId: item.id,
                chatName: item.displayName || item.name,
              })
            }
            onLongPress={() => onLongPress(item)}
            textColor={colors.text}
            textSecondary={colors.textSecondary}
            warningColor={colors.warning}
            dangerColor={colors.danger}
            cardBackground={colors.surface}
            cardBorder={colors.glassBorder}
            unreadColor={colors.primary}
            unreadTextColor={colors.textOnPrimary}
            bracketColor={colors.primary}
          />
          </ListEntrance>
        )}
        ListEmptyComponent={
          // The first screen a new account lands on, and for a while the only
          // one — the cascade is doing more work here than anywhere else in
          // the app, since there is no content to carry it.
          <Cascade index={0}>
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
              {isOffline ? t('chatList.offlineEmpty') : t('chatList.empty')}
            </Text>
          </Cascade>
        }
      />
      {/* The actual construction from services/e2ee.ts (E2EE_ALG), not a
          decorative string. If someone reads this off the screen to check what
          protects their messages, it has to be the truth. */}
      <View style={[styles.cipherBar, {borderTopColor: colors.separator}]}>
        <Text style={[styles.cipherText, {color: colors.textSecondary}]}>
          {t('chatList.cipherSuite')}
        </Text>
      </View>
      {user && (
        <RecoveryPhraseRevealModal
          visible={recoveryModalVisible}
          userId={user.uid}
          onDone={() => setRecoveryModalVisible(false)}
        />
      )}
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  hiddenEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 2,
    borderWidth: 1,
  },
  hiddenEntryText: {...terminal.label},
  hiddenEntryCount: {fontFamily: fonts.mono.medium, fontSize: 11},
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
  headerTitles: {flex: 1},
  eyebrow: {...terminal.micro, marginBottom: 3},
  title: {
    fontFamily: fonts.display.bold,
    fontSize: 22,
    letterSpacing: 3.5,
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  statusDot: {width: 6, height: 6, borderRadius: 999},
  statusText: {...terminal.micro},
  statusRule: {flex: 1, height: StyleSheet.hairlineWidth},
  statusCount: {...terminal.micro},
  cipherBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  cipherText: {...terminal.micro, fontSize: 7, textAlign: 'center'},
  newChatButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 2,
  },
  newChatText: {...terminal.label},
  searchInput: {
    // No `flex: 1` here. This is a fixed-height field in a *column*, so flex
    // would fight the height below rather than complement it. Legacy Yoga let
    // the explicit height win; Fabric gives the flex line priority, and the
    // field grew to fill the whole screen between the header and the list.
    borderRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...terminal.data,
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
    borderRadius: 2,
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
    width: 44,
    height: 44,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.display.semibold,
    fontSize: 13,
    letterSpacing: 1,
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
    fontFamily: fonts.mono.medium,
    fontSize: 13,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  pinLabel: {...terminal.micro},
  timeText: {fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.5},
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  unreadText: {fontFamily: fonts.display.bold, fontSize: 11},
  lastMessage: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  draftText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  emptyText: {
    ...terminal.label,
    fontSize: 11,
    marginBottom: 8,
    textAlign: 'center',
    paddingTop: 60,
  },
});

