import {
  collection,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import {ChatWrappedStats} from '../types';

const db = getFirestore();

const STOP_WORDS = new Set([
  'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but',
  'his', 'from', 'they', 'been', 'have', 'said', 'each', 'she', 'which',
  'their', 'will', 'other', 'about', 'many', 'then', 'them', 'these', 'some',
  'her', 'would', 'make', 'like', 'him', 'into', 'time', 'has', 'look', 'two',
  'more', 'write', 'could', 'people', 'than', 'first', 'been', 'call', 'who',
  'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made',
  'may', 'part', 'over', 'such', 'just', 'also', 'back', 'after', 'use',
  'our', 'how', 'was', 'are', 'what', 'were', 'your', 'when', 'can', 'there',
]);

const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

function toTs(val: any): number {
  if (!val) {return 0;}
  if (typeof val.toMillis === 'function') {return val.toMillis();}
  if (typeof val.seconds === 'number') {return val.seconds * 1000;}
  return new Date(val).getTime() || 0;
}

export async function generateWrapped(
  chatId: string,
  year?: number,
): Promise<ChatWrappedStats> {
  const targetYear = year ?? new Date().getFullYear();
  const startMs = new Date(targetYear, 0, 1).getTime();
  const endMs = new Date(targetYear + 1, 0, 1).getTime();

  const messagesRef = collection(doc(collection(db, 'chats'), chatId), 'messages');
  const q = query(messagesRef, orderBy('createdAt'));
  const snap = await getDocs(q);

  const msgs: any[] = [];
  snap.forEach(d => {
    const data = d.data();
    const ts = toTs(data.createdAt);
    if (ts >= startMs && ts < endMs) {
      msgs.push({...data, _ts: ts});
    }
  });

  const emojiMap = new Map<string, number>();
  const senderMap = new Map<string, number>();
  const hourMap = new Map<number, number>();
  const wordMap = new Map<string, number>();
  let totalMedia = 0;
  let wordCount = 0;
  let bestReaction: {text: string; reactions: number} | undefined;
  const daySet = new Set<string>();

  for (const m of msgs) {
    if (m.image || m.video || m.audio || m.gif) {totalMedia++;}

    const name = m.user?.name || m.user?._id || 'Unknown';
    senderMap.set(name, (senderMap.get(name) || 0) + 1);

    const h = new Date(m._ts).getHours();
    hourMap.set(h, (hourMap.get(h) || 0) + 1);

    const dayKey = new Date(m._ts).toISOString().slice(0, 10);
    daySet.add(dayKey);

    if (typeof m.text === 'string' && m.text.trim()) {
      const emojis = m.text.match(EMOJI_RE);
      if (emojis) {
        for (const e of emojis) {
          emojiMap.set(e, (emojiMap.get(e) || 0) + 1);
        }
      }

      const words = m.text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3 && !STOP_WORDS.has(w));
      wordCount += m.text.split(/\s+/).filter(Boolean).length;
      for (const w of words) {
        const clean = w.replace(/[^a-z']/g, '');
        if (clean.length > 3) {
          wordMap.set(clean, (wordMap.get(clean) || 0) + 1);
        }
      }
    }

    if (m.reactions) {
      let total = 0;
      for (const key of Object.keys(m.reactions)) {
        const arr = m.reactions[key];
        if (Array.isArray(arr)) {total += arr.length;}
      }
      if (total > 0 && (!bestReaction || total > bestReaction.reactions)) {
        bestReaction = {text: m.text || '', reactions: total};
      }
    }
  }

  const sortedDays = [...daySet].sort();
  let longestStreak = 0;
  let streak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]).getTime();
    const curr = new Date(sortedDays[i]).getTime();
    if (curr - prev === 86400000) {
      streak++;
    } else {
      streak = 1;
    }
    longestStreak = Math.max(longestStreak, streak);
  }
  if (sortedDays.length === 1) {longestStreak = 1;}

  const topEmoji = [...emojiMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emoji, count]) => ({emoji, count}));

  let topSender = {name: 'Unknown', count: 0};
  for (const [name, count] of senderMap) {
    if (count > topSender.count) {topSender = {name, count};}
  }

  let busiestHour = 0;
  let maxHourCount = 0;
  for (const [h, count] of hourMap) {
    if (count > maxHourCount) {
      busiestHour = h;
      maxHourCount = count;
    }
  }

  const topWords = [...wordMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  return {
    year: targetYear,
    totalMessages: msgs.length,
    totalMedia,
    topEmoji,
    topSender,
    busiestHour,
    longestStreakDays: longestStreak,
    mostReactedMessage: bestReaction,
    wordCount,
    firstMessageDate: msgs.length ? msgs[0]._ts : undefined,
    topWords,
  };
}
