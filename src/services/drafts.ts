import mmkvStorage from './storageMMKV';

const DRAFTS_KEY = '@chatterbox:drafts';

export async function getDrafts(userId: string): Promise<Record<string, {text: string; updatedAt: number}>> {
  const data = await mmkvStorage.getItem(`${DRAFTS_KEY}:${userId}`);
  return data ? JSON.parse(data) : {};
}

export async function getDraft(userId: string, chatId: string): Promise<string> {
  const drafts = await getDrafts(userId);
  return drafts[chatId]?.text || '';
}

// Throttled draft writes (max once per 500ms)
let lastDraftWrite = 0;
let draftWriteTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingDraft: {userId: string; chatId: string; text: string} | null = null;

export async function setDraft(userId: string, chatId: string, text: string) {
  const now = Date.now();
  
  // Throttle writes
  if (now - lastDraftWrite < 500) {
    pendingDraft = {userId, chatId, text};
    if (draftWriteTimeout) clearTimeout(draftWriteTimeout);
    draftWriteTimeout = setTimeout(async () => {
      if (pendingDraft) {
        const {userId: uid, chatId: cid, text: txt} = pendingDraft;
        const drafts = await getDrafts(uid);
        if (txt) {
          drafts[cid] = {text: txt, updatedAt: Date.now()};
        } else {
          delete drafts[cid];
        }
        await mmkvStorage.setItem(`${DRAFTS_KEY}:${uid}`, JSON.stringify(drafts));
        lastDraftWrite = Date.now();
        pendingDraft = null;
      }
    }, 500 - (now - lastDraftWrite));
    return;
  }
  
  const drafts = await getDrafts(userId);
  if (text) {
    drafts[chatId] = {text, updatedAt: Date.now()};
  } else {
    delete drafts[chatId];
  }
  await mmkvStorage.setItem(`${DRAFTS_KEY}:${userId}`, JSON.stringify(drafts));
  lastDraftWrite = now;
}

