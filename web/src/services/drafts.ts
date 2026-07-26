// Per-chat message drafts, persisted in localStorage (device-local, like the
// mobile app's MMKV drafts — not synced across devices). Keyed per user so
// switching accounts in the same browser doesn't leak drafts.
const KEY = '@chatterbox:drafts';

type DraftMap = Record<string, {text: string; updatedAt: number}>;

function read(userId: string): DraftMap {
  try {
    const raw = localStorage.getItem(`${KEY}:${userId}`);
    return raw ? (JSON.parse(raw) as DraftMap) : {};
  } catch {
    return {};
  }
}

function write(userId: string, map: DraftMap): void {
  try {
    localStorage.setItem(`${KEY}:${userId}`, JSON.stringify(map));
  } catch {
    /* quota / disabled — ignore */
  }
}

export function getDraft(userId: string, chatId: string): string {
  return read(userId)[chatId]?.text || '';
}

export function setDraft(userId: string, chatId: string, text: string): void {
  const map = read(userId);
  if (text.trim()) map[chatId] = {text, updatedAt: Date.now()};
  else delete map[chatId];
  write(userId, map);
}
