import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {getColors} from '../../theme/colors';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';
import {generateWrapped} from '../../services/chatWrapped';
import {ChatWrappedStats} from '../../types';

type CardItem =
  | {key: 'header'}
  | {key: 'totals'}
  | {key: 'emoji'}
  | {key: 'sender'}
  | {key: 'hour'}
  | {key: 'streak'}
  | {key: 'reacted'}
  | {key: 'words'}
  | {key: 'topWords'};

function formatHour(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${suffix}`;
}

export default function ChatWrappedScreen() {
  const route = useRoute<any>();
  const {chatId} = route.params;
  const colors = getColors(useColorScheme());

  const [stats, setStats] = useState<ChatWrappedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    generateWrapped(chatId).then(result => {
      if (!cancelled) {
        setStats(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) { setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [chatId]);

  const cards = useMemo<CardItem[]>(() => {
    if (!stats || stats.totalMessages === 0) { return []; }
    const items: CardItem[] = [
      {key: 'header'},
      {key: 'totals'},
    ];
    if (stats.topEmoji.length > 0) { items.push({key: 'emoji'}); }
    items.push({key: 'sender'}, {key: 'hour'}, {key: 'streak'});
    if (stats.mostReactedMessage) { items.push({key: 'reacted'}); }
    items.push({key: 'words'});
    if (stats.topWords.length > 0) { items.push({key: 'topWords'}); }
    return items;
  }, [stats]);

  const renderCard = useCallback(
    ({item}: {item: CardItem}) => {
      if (!stats) { return null; }

      if (item.key === 'header') {
        return (
          <View style={styles.headerContainer}>
            <Text style={[styles.headerTitle, {color: colors.text}]}>
              Your Year in Review
            </Text>
            <Text style={[styles.headerYear, {color: colors.primary}]}>
              {stats.year}
            </Text>
          </View>
        );
      }

      if (item.key === 'totals') {
        return (
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            <Text style={styles.cardIcon}>{'💬'}</Text>
            <View style={styles.row}>
              <View style={styles.statBlock}>
                <Text style={[styles.bigNumber, {color: colors.primary}]}>
                  {stats.totalMessages.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, {color: colors.textSecondary}]}>
                  Messages
                </Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={[styles.bigNumber, {color: colors.secondary}]}>
                  {stats.totalMedia.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, {color: colors.textSecondary}]}>
                  Media
                </Text>
              </View>
            </View>
          </GlassView>
        );
      }

      if (item.key === 'emoji') {
        return (
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            <Text style={styles.cardIcon}>{'🏆'}</Text>
            <Text style={[styles.cardTitle, {color: colors.text}]}>Top Emoji</Text>
            <View style={styles.emojiRow}>
              {stats.topEmoji.map((e, i) => (
                <View key={i} style={styles.emojiItem}>
                  <Text style={styles.emojiChar}>{e.emoji}</Text>
                  <Text style={[styles.emojiCount, {color: colors.textSecondary}]}>
                    {e.count}
                  </Text>
                </View>
              ))}
            </View>
          </GlassView>
        );
      }

      if (item.key === 'sender') {
        return (
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            <Text style={styles.cardIcon}>{'👑'}</Text>
            <Text style={[styles.cardTitle, {color: colors.text}]}>Most Active</Text>
            <Text style={[styles.bigNumber, {color: colors.primary}]}>
              {stats.topSender.name}
            </Text>
            <Text style={[styles.statLabel, {color: colors.textSecondary}]}>
              {stats.topSender.count.toLocaleString()} messages
            </Text>
          </GlassView>
        );
      }

      if (item.key === 'hour') {
        return (
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            <Text style={styles.cardIcon}>{'🕐'}</Text>
            <Text style={[styles.cardTitle, {color: colors.text}]}>Busiest Hour</Text>
            <Text style={[styles.bigNumber, {color: colors.warning}]}>
              {formatHour(stats.busiestHour)}
            </Text>
          </GlassView>
        );
      }

      if (item.key === 'streak') {
        return (
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            <Text style={styles.cardIcon}>{'🔥'}</Text>
            <Text style={[styles.cardTitle, {color: colors.text}]}>Longest Streak</Text>
            <Text style={[styles.bigNumber, {color: colors.danger}]}>
              {stats.longestStreakDays}
            </Text>
            <Text style={[styles.statLabel, {color: colors.textSecondary}]}>
              days in a row
            </Text>
          </GlassView>
        );
      }

      if (item.key === 'reacted' && stats.mostReactedMessage) {
        return (
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            <Text style={styles.cardIcon}>{'❤️'}</Text>
            <Text style={[styles.cardTitle, {color: colors.text}]}>Most Reacted</Text>
            <Text
              style={[styles.reactedText, {color: colors.text}]}
              numberOfLines={3}>
              "{stats.mostReactedMessage.text}"
            </Text>
            <Text style={[styles.statLabel, {color: colors.textSecondary}]}>
              {stats.mostReactedMessage.reactions} reactions
            </Text>
          </GlassView>
        );
      }

      if (item.key === 'words') {
        return (
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            <Text style={styles.cardIcon}>{'📝'}</Text>
            <Text style={[styles.cardTitle, {color: colors.text}]}>Words Shared</Text>
            <Text style={[styles.bigNumber, {color: colors.success}]}>
              {stats.wordCount.toLocaleString()}
            </Text>
          </GlassView>
        );
      }

      if (item.key === 'topWords') {
        return (
          <GlassView style={[styles.card, {borderColor: colors.glassBorder}]}>
            <Text style={styles.cardIcon}>{'💡'}</Text>
            <Text style={[styles.cardTitle, {color: colors.text}]}>Top Words</Text>
            <View style={styles.chipRow}>
              {stats.topWords.map((w, i) => (
                <View
                  key={i}
                  style={[styles.chip, {backgroundColor: colors.primaryLight}]}>
                  <Text style={[styles.chipText, {color: colors.primary}]}>{w}</Text>
                </View>
              ))}
            </View>
          </GlassView>
        );
      }

      return null;
    },
    [stats, colors],
  );

  const keyExtractor = useCallback((item: CardItem) => item.key, []);

  if (loading) {
    return (
      <GlassScreen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </GlassScreen>
    );
  }

  if (!stats || stats.totalMessages === 0) {
    return (
      <GlassScreen style={styles.centered}>
        <Text style={styles.emptyIcon}>{'📭'}</Text>
        <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
          Not enough data
        </Text>
        <Text style={[styles.emptyHint, {color: colors.textSecondary}]}>
          Keep chatting to unlock your Year in Review!
        </Text>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={keyExtractor}
        renderItem={renderCard}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={5}
        initialNumToRender={5}
        windowSize={7}
      />
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40},
  list: {padding: 16, paddingBottom: 40},
  headerContainer: {alignItems: 'center', marginBottom: 20, marginTop: 8},
  headerTitle: {fontSize: 26, fontWeight: '800', letterSpacing: -0.5},
  headerYear: {fontSize: 48, fontWeight: '900', letterSpacing: -1},
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    marginBottom: 14,
    alignItems: 'center',
  },
  cardIcon: {fontSize: 32, marginBottom: 8},
  cardTitle: {fontSize: 14, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1},
  row: {flexDirection: 'row', justifyContent: 'space-around', width: '100%'},
  statBlock: {alignItems: 'center'},
  bigNumber: {fontSize: 36, fontWeight: '800', letterSpacing: -0.5},
  statLabel: {fontSize: 13, marginTop: 2},
  emojiRow: {flexDirection: 'row', justifyContent: 'center', gap: 16},
  emojiItem: {alignItems: 'center'},
  emojiChar: {fontSize: 32},
  emojiCount: {fontSize: 12, marginTop: 4},
  reactedText: {fontSize: 15, fontStyle: 'italic', lineHeight: 22, textAlign: 'center', marginBottom: 8},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8},
  chip: {paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20},
  chipText: {fontSize: 14, fontWeight: '600'},
  emptyIcon: {fontSize: 48, marginBottom: 16},
  emptyText: {fontSize: 18, fontWeight: '700', marginBottom: 8},
  emptyHint: {fontSize: 14, textAlign: 'center', lineHeight: 20},
});
