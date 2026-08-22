import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {getColors} from '../theme/colors';
import {getUsersByIds, listenChatsForUser} from '../services/firebaseChat';
import type {ChatRoom} from '../types';

/**
 * "Pick a chat to send this to" — built for message forwarding
 * (ChatScreen.tsx). MomentsScreen's share sheet does the same title
 * resolution inline and predates this component; not yet unified with it.
 */
export default function ChatPickerModal({
  myUid,
  title,
  onPick,
  onClose,
}: {
  myUid: string;
  title: string;
  onPick: (chatId: string) => void;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const colors = getColors(useColorScheme());
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenChatsForUser(myUid, cs => {
      setChats(cs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [myUid]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const otherIds = chats
        .map(chat => {
          if (names[chat.id]) return null;
          if (chat.nameBy?.[myUid]) return null;
          return chat.participants?.find(id => id !== myUid) || null;
        })
        .filter((id): id is string => !!id);
      if (otherIds.length === 0) return;
      const usersById = await getUsersByIds(otherIds);
      if (!active) return;
      const updates: Record<string, string> = {};
      chats.forEach(chat => {
        if (names[chat.id]) return;
        const customName = chat.nameBy?.[myUid];
        if (customName) {
          updates[chat.id] = customName;
          return;
        }
        const otherId = chat.participants?.find(id => id !== myUid);
        const otherUser = otherId ? usersById[otherId] : null;
        updates[chat.id] = otherUser?.displayName || otherUser?.email || chat.name || t('headers.chat');
      });
      if (Object.keys(updates).length) setNames(prev => ({...prev, ...updates}));
    };
    if (chats.length) load();
    return () => {
      active = false;
    };
  }, [chats, myUid, names, t]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]} edges={['top', 'bottom']}>
        <Text style={[styles.title, {color: colors.text}]}>{title}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <FlatList
            data={chats}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={[styles.emptyText, {color: colors.textSecondary}]}>{t('chatList.empty')}</Text>
            }
            renderItem={({item}) => (
              <TouchableOpacity
                style={[styles.row, {borderColor: colors.glassBorder}]}
                onPress={() => onPick(item.id)}>
                <Text style={[styles.rowName, {color: colors.text}]}>
                  {names[item.id] || item.name || t('headers.chat')}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={[styles.closeText, {color: colors.primary}]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: 20, paddingTop: 12},
  title: {fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center'},
  listContent: {paddingBottom: 20},
  emptyText: {textAlign: 'center', marginTop: 40, fontSize: 15},
  row: {paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth},
  rowName: {fontSize: 16, fontWeight: '600'},
  close: {paddingVertical: 16, alignItems: 'center'},
  closeText: {fontSize: 16, fontWeight: '700'},
});
