import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
  FlatList,
} from 'react-native';
import {useAuth} from '../../contexts/AuthContext';
import {getColors} from '../../theme/colors';
import {listenQuoteWall, removeFromQuoteWall} from '../../services/quoteWall';
import {QuoteWallEntry} from '../../types';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';
import {useRoute} from '@react-navigation/native';

export default function QuoteWallScreen() {
  const route = useRoute();
  const chatId = (route.params as any)?.chatId as string;
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const [entries, setEntries] = useState<QuoteWallEntry[]>([]);

  useEffect(() => {
    if (!chatId) return;
    return listenQuoteWall(chatId, setEntries);
  }, [chatId]);

  const handleRemove = useCallback(
    (entry: QuoteWallEntry) => {
      if (!chatId || !user?.uid) return;
      Alert.alert('Remove Quote', 'Remove this quote from the wall?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFromQuoteWall(chatId, entry.id).catch(() => undefined),
        },
      ]);
    },
    [chatId, user?.uid],
  );

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
  };

  const renderItem = useCallback(
    ({item}: {item: QuoteWallEntry}) => (
      <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
        <View style={styles.quoteBar}>
          <View style={[styles.quoteLine, {backgroundColor: colors.primary}]} />
          <View style={styles.quoteContent}>
            <Text style={[styles.quoteText, {color: colors.text}]}>
              {item.text}
            </Text>
            <Text style={[styles.quoteSender, {color: colors.primary}]}>
              — {item.senderName || 'Unknown'}
            </Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Text style={[styles.pinnedInfo, {color: colors.textSecondary}]}>
            Saved by {item.pinnedByName || 'someone'} {'\u00B7'} {formatDate(item.pinnedAt)}
          </Text>
          <TouchableOpacity
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={() => handleRemove(item)}>
            <Text style={[styles.removeBtn, {color: colors.danger}]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </GlassView>
    ),
    [colors, handleRemove],
  );

  return (
    <GlassScreen style={styles.container}>
      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{'\u2728'}</Text>
          <Text style={[styles.emptyTitle, {color: colors.text}]}>Quote Wall</Text>
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            Save memorable messages here. Long-press a message in the chat and tap "Save to Quote Wall".
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },
  quoteBar: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  quoteLine: {
    width: 3,
    borderRadius: 2,
    marginRight: 14,
  },
  quoteContent: {
    flex: 1,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  quoteSender: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinnedInfo: {
    fontSize: 12,
    flex: 1,
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
