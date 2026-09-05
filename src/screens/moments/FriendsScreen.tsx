import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Platform,
  useColorScheme,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../contexts/AuthContext';
import {getColors} from '../../theme/colors';
import GlassView from '../../components/GlassView';
import GlassScreen from '../../components/GlassScreen';
import {reportError} from '../../services/telemetry';
import {
  acceptFriendRequest,
  declineFriendRequest,
  listenFriendRequests,
  listenOutgoingFriendRequests,
  listenFriends,
  removeFriend,
  sendFriendRequest,
  type SendRequestResult,
} from '../../services/friends';
import {blockUser, listenBlockedByMe, listenBlockedMe, unblockUser} from '../../services/blocks';
import {BlockRecord, Friend, FriendRequest, User} from '../../types';
import {
  createChat,
  getChatsForUser,
  getUserById,
  getUsersByIds,
} from '../../services/firebaseChat';
import {contactsFromChats, uidLabel, type Contact} from '../../services/contacts';
import {bodyWeight, terminal} from '../../theme/typography';

type UserMap = Record<string, User | null>;

export default function FriendsScreen() {
  const {user} = useAuth();
  const navigation = useNavigation<any>();
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [blockedByMe, setBlockedByMe] = useState<BlockRecord[]>([]);
  const [blockedMe, setBlockedMe] = useState<BlockRecord[]>([]);
  const [userMap, setUserMap] = useState<UserMap>({});
  const [targetUid, setTargetUid] = useState('');
  // The people you already have a one-to-one chat with. This is the whole
  // addressable set now that there is no directory to search — and it is
  // derived from chats this client already holds, so nothing is looked up.
  const [contacts, setContacts] = useState<Contact[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.uid) return;
      const unsubFriends = listenFriends(user.uid, setFriends);
      const unsubRequests = listenFriendRequests(user.uid, setRequests);
      const unsubOutgoing = listenOutgoingFriendRequests(user.uid, setOutgoingRequests);
      const unsubBlockedByMe = listenBlockedByMe(user.uid, setBlockedByMe);
      const unsubBlockedMe = listenBlockedMe(user.uid, setBlockedMe);
      return () => {
        unsubFriends();
        unsubRequests();
        unsubOutgoing();
        unsubBlockedByMe();
        unsubBlockedMe();
      };
    }, [user?.uid]),
  );

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      const ids = new Set<string>();
      friends.forEach(friend => {
        friend.userIds.forEach(id => ids.add(id));
      });
      requests.forEach(request => {
        ids.add(request.fromId);
        ids.add(request.toId);
      });
      outgoingRequests.forEach(request => {
        ids.add(request.fromId);
        ids.add(request.toId);
      });
      blockedByMe.forEach(record => ids.add(record.blockedId));
      blockedMe.forEach(record => ids.add(record.blockerId));
      ids.delete(user?.uid || '');
      const missing = Array.from(ids).filter(id => id && !userMap[id]);
      if (!missing.length) return;
      const fetched = await getUsersByIds(missing);
      if (!active) return;
      if (Object.keys(fetched).length) {
        setUserMap(prev => ({...prev, ...fetched}));
      }
    };
    loadUsers();
    return () => {
      active = false;
    };
  }, [friends, requests, outgoingRequests, blockedByMe, blockedMe]);

  const friendIds = useMemo(() => {
    const ids = new Set<string>();
    friends.forEach(friend => {
      friend.userIds.forEach(id => ids.add(id));
    });
    return ids;
  }, [friends]);

  const blockedByMeIds = useMemo(() => new Set(blockedByMe.map(item => item.blockedId)), [blockedByMe]);
  const blockedMeIds = useMemo(() => new Set(blockedMe.map(item => item.blockerId)), [blockedMe]);

  const incomingIds = useMemo(() => new Set(requests.map(req => req.fromId)), [requests]);
  const outgoingIds = useMemo(() => new Set(outgoingRequests.map(req => req.toId)), [outgoingRequests]);

  useEffect(() => {
    if (!user?.uid) return;
    let active = true;
    getChatsForUser(user.uid)
      .then(chats => {
        if (active) setContacts(contactsFromChats(chats, user.uid));
      })
      .catch(error => reportError(error, 'friends_load_contacts_failed'));
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const formatTimestamp = (value: any) => {
    const date = value?.toDate ? value.toDate() : typeof value === 'number' ? new Date(value) : null;
    return date ? date.toLocaleString() : '';
  };

  // Always surface the outcome of a send, so the user knows what happened.
  const notifySendResult = (result: SendRequestResult) => {
    if (result === 'error') {
      Alert.alert(t('friends.alerts.sendFailedTitle'), t('friends.alerts.sendFailedBody'));
    } else if (result === 'friends') {
      Alert.alert(t('friends.alerts.requestSentTitle'), t('friends.alerts.alreadyFriendsBody'));
    } else if (result === 'exists') {
      Alert.alert(t('friends.alerts.requestSentTitle'), t('friends.alerts.alreadyPendingBody'));
    } else if (result === 'sent') {
      Alert.alert(t('friends.alerts.requestSentTitle'), t('friends.alerts.requestSentBody'));
    }
  };

  const handleSendRequestByUid = async () => {
    if (!user?.uid) return;
    const trimmed = targetUid.trim();
    if (!trimmed) return;
    if (blockedByMeIds.has(trimmed) || blockedMeIds.has(trimmed)) {
      Alert.alert(t('friends.alerts.blockedTitle'), t('friends.alerts.blockedSend'));
      return;
    }
    const result = await sendFriendRequest(user.uid, trimmed);
    if (result !== 'error' && result !== 'invalid') setTargetUid('');
    notifySendResult(result);
  };

  const handleStartChat = async (otherId: string) => {
    if (!user?.uid || !otherId) return;
    if (blockedByMeIds.has(otherId) || blockedMeIds.has(otherId)) {
      Alert.alert(t('friends.alerts.blockedTitle'), t('friends.alerts.blockedChat'));
      return;
    }
    try {
      const existingChats = await getChatsForUser(user.uid);
      const existing = existingChats.find(chat => {
        const participants = chat.participants || [];
        return participants.includes(user.uid) && participants.includes(otherId) && participants.length === 2;
      });
      if (existing) {
        navigation.navigate('Chat', {
          chatId: existing.id,
          chatName: existing.name,
        });
        return;
      }
      const otherUser = userMap[otherId] || (await getUserById(otherId));
      const displayName = otherUser?.displayName || t('headers.chat');
      const chatId = await createChat([user.uid, otherId], displayName);
      navigation.navigate('Chat', {
        chatId,
        chatName: displayName,
      });
    } catch (error) {
      reportError(error, 'handleStartChat');
      if (__DEV__) {
        console.error('handleStartChat error:', error);
      }
      Alert.alert(t('friends.alerts.chatFailedTitle'), t('friends.alerts.chatFailedBody'));
    }
  };

  const renderRequest = ({item}: {item: FriendRequest}) => {
    const fromUser = userMap[item.fromId];
    const name = fromUser?.displayName || uidLabel(item.fromId);
    return (
      <GlassView blur={false} style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}>
        <Text style={[styles.cardTitle, {color: colors.text}]}>{name}</Text>
        <Text style={[styles.cardMeta, {color: colors.textSecondary}]}>
          {formatTimestamp(item.createdAt)}
        </Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.primary}]}
            onPress={() => acceptFriendRequest(item.id, user?.uid || '')}>
            <Text style={[styles.actionTextPrimary, {color: colors.textOnPrimary}]}>{t('friends.buttons.accept')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.surface}]}
            onPress={() => declineFriendRequest(item.id, user?.uid || '')}>
            <Text style={[styles.actionText, {color: colors.text}]}>
              {t('friends.buttons.decline')}
            </Text>
          </TouchableOpacity>
        </View>
      </GlassView>
    );
  };

  const renderFriend = ({item}: {item: Friend}) => {
    const otherId = item.userIds.find(id => id !== user?.uid) || '';
    const otherUser = userMap[otherId];
    const name = otherUser?.displayName || uidLabel(otherId);
    return (
      <GlassView blur={false} style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}>
        <Text style={[styles.cardTitle, {color: colors.text}]}>{name}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.primary}]}
            onPress={() => handleStartChat(otherId)}>
            <Text style={[styles.actionTextPrimary, {color: colors.textOnPrimary}]}>{t('friends.buttons.chat')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.surface}]}
            onPress={() =>
              Alert.alert(t('friends.alerts.removeTitle'), t('friends.alerts.removeBody'), [
                {text: t('common.cancel'), style: 'cancel'},
                {
                  text: t('friends.buttons.remove'),
                  style: 'destructive',
                  onPress: () => removeFriend(user?.uid || '', otherId),
                },
              ])
            }>
            <Text style={[styles.actionText, {color: colors.text}]}>
              {t('friends.buttons.remove')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.surface}]}
            onPress={() =>
              Alert.alert(t('friends.alerts.blockTitle'), t('friends.alerts.blockBody'), [
                {text: t('common.cancel'), style: 'cancel'},
                {
                  text: t('friends.buttons.block'),
                  style: 'destructive',
                  onPress: async () => {
                    await blockUser(user?.uid || '', otherId);
                    await removeFriend(user?.uid || '', otherId);
                  },
                },
              ])
            }>
            <Text style={[styles.actionText, {color: colors.text}]}>
              {t('friends.buttons.block')}
            </Text>
          </TouchableOpacity>
        </View>
      </GlassView>
    );
  };

  const renderBlocked = ({item}: {item: BlockRecord}) => {
    const blockedUser = userMap[item.blockedId];
    const name = blockedUser?.displayName || uidLabel(item.blockedId);
    return (
      <GlassView blur={false} style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}>
        <Text style={[styles.cardTitle, {color: colors.text}]}>{name}</Text>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: colors.surface}]}
          onPress={() => unblockUser(user?.uid || '', item.blockedId)}>
          <Text style={[styles.actionText, {color: colors.text}]}>
            {t('friends.buttons.unblock')}
          </Text>
        </TouchableOpacity>
      </GlassView>
    );
  };

  const renderOutgoing = ({item}: {item: FriendRequest}) => {
    const toUser = userMap[item.toId];
    const name = toUser?.displayName || uidLabel(item.toId);
    return (
      <GlassView blur={false} style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}>
        <Text style={[styles.cardTitle, {color: colors.text}]}>
          {t('friends.labels.pending', {name})}
        </Text>
        <Text style={[styles.cardMeta, {color: colors.textSecondary}]}>
          {formatTimestamp(item.createdAt)}
        </Text>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: colors.surface}]}
          onPress={() => declineFriendRequest(item.id, user?.uid || '')}>
          <Text style={[styles.actionText, {color: colors.text}]}>
            {t('friends.buttons.cancel')}
          </Text>
        </TouchableOpacity>
      </GlassView>
    );
  };

  const renderContact = ({item}: {item: Contact}) => {
    const status = friendIds.has(item.uid)
      ? 'friend'
      : incomingIds.has(item.uid)
      ? 'incoming'
      : outgoingIds.has(item.uid)
      ? 'pending'
      : 'none';
    return (
      <GlassView blur={false} style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.glassBorder}]}>
        {/* Your own name for them, taken from the chat. Never a profile field
            — that is the whole difference between this list and the search box
            it replaced. */}
        <Text style={[styles.cardTitle, {color: colors.text}]}>{item.label}</Text>
        {status === 'none' ? (
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.primary}]}
            onPress={async () => notifySendResult(await sendFriendRequest(user?.uid || '', item.uid))}>
            <Text style={[styles.actionTextPrimary, {color: colors.textOnPrimary}]}>{t('friends.buttons.add')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.cardMeta, {color: colors.textSecondary}]}>
            {status === 'friend'
              ? t('friends.status.friend')
              : status === 'incoming'
              ? t('friends.status.incoming')
              : t('friends.status.pending')}
          </Text>
        )}
      </GlassView>
    );
  };

  return (
    <GlassScreen style={styles.container} textureSeed="friends">
      <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('friends.addFriend')}</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, {borderColor: colors.glassBorder, color: colors.text}]}
          placeholder={t('friends.uidPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={targetUid}
          onChangeText={setTargetUid}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.sendButton, {backgroundColor: colors.primary}]}
          onPress={handleSendRequestByUid}>
          <Text style={[styles.sendText, {color: colors.textOnPrimary}]}>{t('common.send')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('friends.contactsTitle')}</Text>
      <FlatList
        data={contacts}
        keyExtractor={item => item.uid}
        renderItem={renderContact}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {t('friends.contactsEmpty')}
          </Text>
        }
      />

      <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('friends.sections.requests')}</Text>
      <FlatList
        data={requests}
        keyExtractor={item => item.id}
        renderItem={renderRequest}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {t('friends.empty.requests')}
          </Text>
        }
      />

      <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('friends.sections.outgoing')}</Text>
      <FlatList
        data={outgoingRequests}
        keyExtractor={item => item.id}
        renderItem={renderOutgoing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {t('friends.empty.outgoing')}
          </Text>
        }
      />

      <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('friends.sections.friends')}</Text>
      <FlatList
        data={friends}
        keyExtractor={item => item.id}
        renderItem={renderFriend}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {t('friends.empty.friends')}
          </Text>
        }
      />

      <Text style={[styles.sectionTitle, {color: colors.text}]}>{t('friends.sections.blocked')}</Text>
      <FlatList
        data={blockedByMe}
        keyExtractor={item => item.id}
        renderItem={renderBlocked}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {t('friends.empty.blocked')}
          </Text>
        }
      />
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 24,
  },
  sectionTitle: {...terminal.label, marginBottom: 8},
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    borderRadius: 2,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendText: {
    fontFamily: bodyWeight('600'),
  },
  card: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: bodyWeight('600'),
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 12,
    marginBottom: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionText: {
    fontFamily: bodyWeight('600'),
  },
  actionTextPrimary: {
    fontFamily: bodyWeight('600'),
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 12,
  },
});

