import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import {Message} from '../../types';
import {getColors} from '../../theme/colors';
import GlassScreen from '../../components/GlassScreen';
import GlassView from '../../components/GlassView';

type EventType = 'first' | 'photo' | 'reaction' | 'milestone';

interface TimelineEvent {
  id: string;
  type: EventType;
  date: number;
  senderName: string;
  text: string;
  hasImage: boolean;
  reactionCount: number;
}

const TYPE_COLORS: Record<EventType, string> = {
  first: '#FFD700',
  photo: '#34C759',
  reaction: '#FF6B8A',
  milestone: '#FFD700',
};

const TYPE_LABELS: Record<EventType, string> = {
  first: 'First Message',
  photo: 'Photo',
  reaction: 'Most Reacted',
  milestone: 'Milestone',
};

function toTimestamp(val: any): number {
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  if (val?.toDate) return val.toDate().getTime();
  if (val?.seconds) return val.seconds * 1000;
  return 0;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function extractEvents(messages: Message[]): TimelineEvent[] {
  if (messages.length === 0) return [];
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();

  const toEvent = (
    msg: Message,
    type: EventType,
    suffix = '',
  ): TimelineEvent => ({
    id: `${msg._id}_${type}${suffix}`,
    type,
    date: toTimestamp(msg.createdAt),
    senderName: msg.user?.name || 'Unknown',
    text: msg.image ? '[Photo]' : msg.text || '',
    hasImage: !!msg.image,
    reactionCount: msg.reactions
      ? Object.values(msg.reactions).reduce((s, arr) => s + arr.length, 0)
      : 0,
  });

  events.push(toEvent(messages[0], 'first'));
  seen.add(String(messages[0]._id));

  const monthSeen = new Set<string>();
  for (const msg of messages) {
    const ts = toTimestamp(msg.createdAt);
    if (!ts) continue;
    const key = `${new Date(ts).getFullYear()}-${new Date(ts).getMonth()}`;
    if (!monthSeen.has(key) && !seen.has(String(msg._id))) {
      monthSeen.add(key);
      events.push(toEvent(msg, 'milestone', '_ms'));
      seen.add(String(msg._id));
    }
  }

  for (const msg of messages) {
    if (msg.image && !seen.has(String(msg._id))) {
      events.push(toEvent(msg, 'photo'));
      seen.add(String(msg._id));
    }
  }

  const withReactions = messages
    .filter(m => m.reactions && Object.keys(m.reactions).length > 0)
    .sort((a, b) => {
      const countA = Object.values(a.reactions!).reduce((s, arr) => s + arr.length, 0);
      const countB = Object.values(b.reactions!).reduce((s, arr) => s + arr.length, 0);
      return countB - countA;
    })
    .slice(0, 5);

  for (const msg of withReactions) {
    if (!seen.has(String(msg._id))) {
      events.push(toEvent(msg, 'reaction'));
      seen.add(String(msg._id));
    }
  }

  events.sort((a, b) => a.date - b.date);
  return events;
}

export default function ChatTimelineScreen() {
  const route = useRoute();
  const chatId = (route.params as any)?.chatId as string;
  const colors = getColors(useColorScheme());
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId) return;
    const db = getFirestore();
    const messagesRef = collection(doc(collection(db, 'chats'), chatId), 'messages');
    getDocs(query(messagesRef, orderBy('createdAt', 'asc')))
      .then(snap => {
        const msgs = snap.docs.map(d => ({_id: d.id, ...d.data()} as Message));
        setEvents(extractEvents(msgs));
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [chatId]);

  const dateRange = useMemo(() => {
    if (events.length === 0) return '';
    const first = formatDate(events[0].date);
    const last = formatDate(events[events.length - 1].date);
    return first === last ? first : `${first} — ${last}`;
  }, [events]);

  const renderItem = useCallback(
    ({item}: {item: TimelineEvent}) => {
      const dotColor = TYPE_COLORS[item.type];
      return (
        <View style={styles.row}>
          <View style={styles.lineColumn}>
            <View style={[styles.line, {backgroundColor: colors.border}]} />
            <View style={[styles.dot, {backgroundColor: dotColor}]} />
            <View style={[styles.line, {backgroundColor: colors.border}]} />
          </View>
          <GlassView style={[styles.eventCard, {borderColor: colors.glassBorder}]}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, {backgroundColor: dotColor}]}>
                <Text style={styles.badgeText}>{TYPE_LABELS[item.type]}</Text>
              </View>
              <Text style={[styles.dateText, {color: colors.textSecondary}]}>
                {formatDate(item.date)}
              </Text>
            </View>
            <Text style={[styles.senderText, {color: colors.primary}]}>
              {item.senderName}
            </Text>
            <Text
              style={[styles.previewText, {color: colors.text}]}
              numberOfLines={2}>
              {item.text}
            </Text>
          </GlassView>
        </View>
      );
    },
    [colors],
  );

  return (
    <GlassScreen style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, {color: colors.text}]}>Timeline</Text>
        {dateRange !== '' && (
          <Text style={[styles.headerRange, {color: colors.textSecondary}]}>
            {dateRange}
          </Text>
        )}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>{'\u{1F4DC}'}</Text>
          <Text style={[styles.emptyTitle, {color: colors.text}]}>No Events Yet</Text>
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            Start chatting to build your timeline.
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
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
  container: {flex: 1},
  header: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4},
  headerTitle: {fontSize: 22, fontWeight: '800'},
  headerRange: {fontSize: 13, marginTop: 2},
  list: {paddingTop: 8, paddingBottom: 32},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40},
  row: {flexDirection: 'row', paddingRight: 16},
  lineColumn: {width: 40, alignItems: 'center'},
  line: {flex: 1, width: 2},
  dot: {width: 14, height: 14, borderRadius: 7},
  eventCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 4,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {fontSize: 11, fontWeight: '700', color: '#fff'},
  dateText: {fontSize: 12},
  senderText: {fontSize: 14, fontWeight: '600', marginBottom: 2},
  previewText: {fontSize: 14, lineHeight: 20},
  emptyIcon: {fontSize: 48, marginBottom: 16},
  emptyTitle: {fontSize: 20, fontWeight: '700', marginBottom: 8},
  emptyText: {fontSize: 14, textAlign: 'center', lineHeight: 20},
});
