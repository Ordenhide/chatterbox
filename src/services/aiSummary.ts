import {getFunctions, httpsCallable} from '@react-native-firebase/functions';
import {collection, doc, getDocs, getFirestore, limit, orderBy, query} from '@react-native-firebase/firestore';

const functions = getFunctions();
const db = getFirestore();

function localSummary(docs: any[]): string {
  if (!docs.length) return 'No messages to summarize.';

  const msgs = docs.map(d => d.data?.() ? d.data() : d);
  const uniqueUsers = [...new Set(msgs.map(m => m.user?.name || 'User'))];
  const textMsgs = msgs.filter(m => m.text && m.text.length > 5);
  const mediaCount = msgs.filter(m => m.image || m.video || m.audio || m.gif).length;

  const wordFreq: Record<string, number> = {};
  textMsgs.forEach(m => {
    (m.text || '').toLowerCase().split(/\s+/).forEach((w: string) => {
      if (w.length > 3) wordFreq[w] = (wordFreq[w] || 0) + 1;
    });
  });
  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  const recentTopics = textMsgs
    .slice(-5)
    .map(m => {
      const text = (m.text || '').substring(0, 80);
      const name = m.user?.name || 'User';
      return `${name}: "${text}"`;
    });

  const lines: string[] = [
    `Conversation between ${uniqueUsers.join(', ')} — ${msgs.length} messages.`,
  ];
  if (mediaCount > 0) {
    lines.push(`${mediaCount} media item${mediaCount > 1 ? 's' : ''} shared (photos, videos, audio, GIFs).`);
  }
  if (topWords.length) {
    lines.push(`Frequent topics: ${topWords.join(', ')}.`);
  }
  if (recentTopics.length) {
    lines.push(`\nRecent highlights:\n${recentTopics.join('\n')}`);
  }
  return lines.join('\n');
}

export async function getChatSummary(
  chatId: string,
  messageCount = 50,
): Promise<string> {
  // Try Cloud Function first
  try {
    const callable = httpsCallable(functions, 'summarizeChat');
    const result = await callable({chatId, messageCount});
    const summary = (result.data as {summary: string}).summary;
    if (summary) return summary;
  } catch {
    // Cloud Function unavailable — fall through to local summary
  }

  // Local fallback: fetch messages directly and summarize on-device
  try {
    const messagesRef = collection(doc(collection(db, 'chats'), chatId), 'messages');
    const snap = await getDocs(
      query(messagesRef, orderBy('createdAt', 'desc'), limit(Math.min(messageCount, 100))),
    );
    if (snap.empty) return 'No messages to summarize.';
    const reversed = [...snap.docs].reverse();
    return localSummary(reversed);
  } catch {
    throw new Error('Unable to generate summary. Check your connection and try again.');
  }
}
