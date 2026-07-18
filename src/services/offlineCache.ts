import mmkvStorage from './storageMMKV';
import {IMessage} from 'react-native-gifted-chat';

const CHATS_KEY = '@chatterbox:cachedChats';
const MESSAGES_KEY = '@chatterbox:cachedMessages';
const OUTBOX_KEY = '@chatterbox:outbox';

type CachedChat = Record<string, any>;

type OutboxItem = {
  id: string;
  chatId: string;
  message: any;
  createdAt: number;
};

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (value?.toDate) return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function serializeChat(chat: CachedChat) {
  const lastMessage = chat?.lastMessage
    ? {
        ...chat.lastMessage,
        createdAt: toMillis(chat.lastMessage.createdAt) || chat.lastMessage.createdAt,
      }
    : chat.lastMessage;
  return {
    ...chat,
    createdAt: toMillis(chat.createdAt) || chat.createdAt,
    updatedAt: toMillis(chat.updatedAt) || chat.updatedAt,
    lastMessage,
  };
}

function serializeMessage(message: IMessage): any {
  const createdAt =
    message.createdAt instanceof Date
      ? message.createdAt.getTime()
      : typeof message.createdAt === 'number'
      ? message.createdAt
      : new Date(message.createdAt as any).getTime();
  return {...message, createdAt};
}

function deserializeMessage(message: any): IMessage {
  return {
    ...message,
    createdAt: message?.createdAt ? new Date(message.createdAt) : new Date(),
  } as IMessage;
}

export async function getCachedChats(userId: string): Promise<CachedChat[]> {
  const raw = await mmkvStorage.getItem(`${CHATS_KEY}:${userId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Throttled cache write for chats (max once per 2 seconds)
let lastChatsWrite = 0;
let chatsWriteTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingChats: {userId: string; chats: CachedChat[]} | null = null;

export async function setCachedChats(userId: string, chats: CachedChat[]) {
  const serialized = chats.map(serializeChat);
  const now = Date.now();
  
  // Throttle writes
  if (now - lastChatsWrite < 2000) {
    pendingChats = {userId, chats};
    if (chatsWriteTimeout) clearTimeout(chatsWriteTimeout);
    chatsWriteTimeout = setTimeout(() => {
      if (pendingChats) {
        const {userId: uid, chats: ch} = pendingChats;
        const serialized = ch.map(serializeChat);
        mmkvStorage.setItem(`${CHATS_KEY}:${uid}`, JSON.stringify(serialized));
        lastChatsWrite = Date.now();
        pendingChats = null;
      }
    }, Math.max(0, 2000 - (now - lastChatsWrite)));
    return;
  }
  
  await mmkvStorage.setItem(`${CHATS_KEY}:${userId}`, JSON.stringify(serialized));
  lastChatsWrite = now;
}

export async function getCachedMessages(chatId: string): Promise<IMessage[]> {
  const raw = await mmkvStorage.getItem(`${MESSAGES_KEY}:${chatId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(deserializeMessage) : [];
  } catch {
    return [];
  }
}

// Throttled cache write for messages (max once per 1 second)
let lastMessagesWrite = 0;
let messagesWriteTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingMessages: {chatId: string; messages: IMessage[]} | null = null;

export async function setCachedMessages(chatId: string, messages: IMessage[]) {
  const serialized = messages.map(serializeMessage).slice(0, 100);
  const now = Date.now();
  
  // Throttle writes
  if (now - lastMessagesWrite < 1000) {
    pendingMessages = {chatId, messages};
    if (messagesWriteTimeout) clearTimeout(messagesWriteTimeout);
    messagesWriteTimeout = setTimeout(() => {
      if (pendingMessages) {
        const {chatId: cid, messages: msgs} = pendingMessages;
        const serialized = msgs.map(serializeMessage).slice(0, 100);
        mmkvStorage.setItem(`${MESSAGES_KEY}:${cid}`, JSON.stringify(serialized));
        lastMessagesWrite = Date.now();
        pendingMessages = null;
      }
    }, Math.max(0, 1000 - (now - lastMessagesWrite)));
    return;
  }
  
  await mmkvStorage.setItem(`${MESSAGES_KEY}:${chatId}`, JSON.stringify(serialized));
  lastMessagesWrite = now;
}

export async function getOutboxMessages(userId: string): Promise<OutboxItem[]> {
  const raw = await mmkvStorage.getItem(`${OUTBOX_KEY}:${userId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OutboxItem[];
  } catch {
    return [];
  }
}

export async function enqueueOutboxMessage(userId: string, item: OutboxItem) {
  const existing = await getOutboxMessages(userId);
  const next = [...existing.filter(entry => entry.id !== item.id), item];
  await mmkvStorage.setItem(`${OUTBOX_KEY}:${userId}`, JSON.stringify(next));
}

export async function removeOutboxMessage(userId: string, id: string) {
  const existing = await getOutboxMessages(userId);
  const next = existing.filter(item => item.id !== id);
  await mmkvStorage.setItem(`${OUTBOX_KEY}:${userId}`, JSON.stringify(next));
}

export async function removeOutboxForChat(userId: string, chatId: string) {
  const existing = await getOutboxMessages(userId);
  const next = existing.filter(item => item.chatId !== chatId);
  await mmkvStorage.setItem(`${OUTBOX_KEY}:${userId}`, JSON.stringify(next));
}

export async function removeCachedChat(userId: string, chatId: string) {
  const chats = await getCachedChats(userId);
  const next = chats.filter(chat => chat.id !== chatId);
  await mmkvStorage.setItem(`${CHATS_KEY}:${userId}`, JSON.stringify(next));
  await mmkvStorage.removeItem(`${MESSAGES_KEY}:${chatId}`);
}

