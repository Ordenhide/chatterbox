/**
 * Recently deleted messages, with the time each has left before it is gone
 * for good.
 *
 * Only the person who deleted a message can see or recover it — enforced by
 * the rules on chats/{chatId}/trash, not by this screen. The other participant
 * loses access the moment a message lands in the trash, so the recovery window
 * doesn't weaken "delete for everyone".
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getColors} from '../../theme/colors';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';
import {useAuth} from '../../contexts/AuthContext';
import {decryptMessage, isEncryptedPayload} from '../../services/e2ee';
import {getOrCreateDeviceKeypair} from '../../services/e2eeKeys';
import {
  formatRemaining,
  listenTrash,
  recoverMessage,
  type TrashedMessage,
} from '../../services/messageTrash';

/** A short label for a trashed message: its text where readable, else its kind. */
function preview(
  item: TrashedMessage,
  secretKey: Uint8Array | null,
  chatId: string,
  t: (key: string) => string,
): string {
  const p = item.payload as Record<string, any>;
  if (typeof p.text === 'string' && p.text) return p.text;
  if (secretKey && isEncryptedPayload(p.encrypted)) {
    try {
      return decryptMessage(p.encrypted, secretKey, chatId);
    } catch {
      // fall through to a kind label
    }
  }
  if (p.image || p.encryptedImage || p.gif) return t('trash.photo');
  if (p.video || p.encryptedVideo) return t('trash.video');
  if (p.audio || p.encryptedAudio) return t('trash.voice');
  if (p.file || p.encryptedFileUri) return t('trash.file');
  return t('trash.message');
}

export default function RecentlyDeletedScreen() {
  const colors = getColors(useColorScheme());
  const {t} = useTranslation();
  const {user} = useAuth();
  const route = useRoute<any>();
  const chatId: string = route.params?.chatId;

  const [items, setItems] = useState<TrashedMessage[]>([]);
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Re-render on a timer so the countdown stays honest while the screen is open.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!chatId || !user) return;
    return listenTrash(chatId, user.uid, setItems);
  }, [chatId, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getOrCreateDeviceKeypair(user.uid)
      .then(kp => {
        if (active) setSecretKey(kp.secretKey);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const onRecover = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const ok = await recoverMessage(chatId, id);
        if (!ok) Alert.alert(t('trash.title'), t('trash.expired'));
      } catch {
        Alert.alert(t('common.error'), '');
      } finally {
        setBusyId(null);
      }
    },
    [chatId, t],
  );

  return (
    <GlassScreen style={styles.container}>
      <Text style={[styles.desc, {color: colors.textSecondary}]}>{t('trash.desc')}</Text>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, {color: colors.textSecondary}]}>{t('trash.empty')}</Text>
        }
        renderItem={({item}) => (
          <GlassView blur={false} style={[styles.row, {borderColor: colors.glassBorder}]}>
            <View style={styles.rowMain}>
              <Text style={[styles.rowText, {color: colors.text}]} numberOfLines={1}>
                {preview(item, secretKey, chatId, t)}
              </Text>
              <Text style={[styles.rowMeta, {color: colors.textSecondary}]}>
                {new Date(item.deletedAt).toLocaleString()} · {t('trash.timeLeft')}{' '}
                {formatRemaining(item.deletedAt)}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${t('trash.recover')} — ${preview(item, secretKey, chatId, t)}`}
              disabled={busyId === item.id}
              style={[styles.recoverBtn, {backgroundColor: colors.primary}]}
              onPress={() => onRecover(item.id)}>
              {busyId === item.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.recoverText}>{t('trash.recover')}</Text>
              )}
            </TouchableOpacity>
          </GlassView>
        )}
      />
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  desc: {fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4},
  list: {padding: 16, gap: 10},
  empty: {textAlign: 'center', marginTop: 40, fontSize: 14},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  rowMain: {flex: 1, minWidth: 0},
  rowText: {fontSize: 14, fontWeight: '600'},
  rowMeta: {fontSize: 11.5, marginTop: 3},
  recoverBtn: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, minWidth: 84, alignItems: 'center'},
  recoverText: {color: '#fff', fontWeight: '700', fontSize: 13},
});
