import AsyncStorage from '@react-native-async-storage/async-storage';
import {User, ChatRoom, Message} from '../types';

// Simple EventEmitter implementation
class EventEmitter {
  private events: {[key: string]: Function[]} = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }
}

const STORAGE_KEYS = {
  USERS: '@chatterbox:users',
  CHATS: '@chatterbox:chats',
  MESSAGES: '@chatterbox:messages',
  CURRENT_USER: '@chatterbox:current_user',
  DRAFTS: '@chatterbox:drafts',
};

const MAX_MESSAGES_PER_CHAT = 200;

class StorageService extends EventEmitter {
  // User management
  async saveUser(user: User): Promise<void> {
    const users = await this.getUsers();
    const existingIndex = users.findIndex(u => u.uid === user.uid);
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.emit('usersChanged', users);
  }

  async getUsers(): Promise<User[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const users = await this.getUsers();
    return users.find(u => u.email === email) || null;
  }

  async getUserById(uid: string): Promise<User | null> {
    const users = await this.getUsers();
    return users.find(u => u.uid === uid) || null;
  }

  async setCurrentUser(user: User | null): Promise<void> {
    if (user) {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
    this.emit('userChanged', user);
  }

  async getCurrentUser(): Promise<User | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  }

  // Chat room management
  async saveChat(chat: ChatRoom): Promise<void> {
    const chats = await this.getChats();
    const existingIndex = chats.findIndex(c => c.id === chat.id);
    if (existingIndex >= 0) {
      chats[existingIndex] = chat;
    } else {
      chats.push(chat);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    this.emit('chatsChanged', chats);
  }

  async getChats(): Promise<ChatRoom[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CHATS);
    return data ? JSON.parse(data) : [];
  }

  async getChatsForUser(userId: string): Promise<ChatRoom[]> {
    const chats = await this.getChats();
    return chats.filter(chat => chat.participants.includes(userId));
  }

  async togglePinMessage(chatId: string, messageId: string | number) {
    const chats = await this.getChats();
    const index = chats.findIndex(c => c.id === chatId);
    if (index === -1) return;
    const chat = chats[index];
    const pinned = new Set(chat.pinnedMessageIds || []);
    if (pinned.has(messageId)) {
      pinned.delete(messageId);
    } else {
      pinned.add(messageId);
    }
    chat.pinnedMessageIds = Array.from(pinned);
    chats[index] = chat;
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    this.emit('chatsChanged', chats);
  }

  async togglePin(chatId: string, userId: string): Promise<void> {
    const chats = await this.getChats();
    const index = chats.findIndex(c => c.id === chatId);
    if (index === -1) return;
    const chat = chats[index];
    const pinnedBy = new Set(chat.pinnedBy || []);
    if (pinnedBy.has(userId)) {
      pinnedBy.delete(userId);
    } else {
      pinnedBy.add(userId);
    }
    chat.pinnedBy = Array.from(pinnedBy);
    chats[index] = chat;
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    this.emit('chatsChanged', chats);
  }

  async setLastRead(chatId: string, userId: string, timestamp: number) {
    const chats = await this.getChats();
    const index = chats.findIndex(c => c.id === chatId);
    if (index === -1) return;
    const chat = chats[index];
    chat.lastReadAt = {...(chat.lastReadAt || {}), [userId]: timestamp};
    chats[index] = chat;
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    this.emit('chatsChanged', chats);
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    const chat = await this.getChat(chatId);
    if (!chat) return 0;
    const lastRead = chat.lastReadAt?.[userId] || 0;
    const messages = await this.getMessages(chatId);
    return messages.filter(message => {
      const createdAt =
        message.createdAt instanceof Date
          ? message.createdAt.getTime()
          : new Date(message.createdAt).getTime();
      return createdAt > lastRead && message.user._id !== userId;
    }).length;
  }

  async getChat(chatId: string): Promise<ChatRoom | null> {
    const chats = await this.getChats();
    return chats.find(c => c.id === chatId) || null;
  }

  async updateChat(chatId: string, updates: Partial<ChatRoom>) {
    const chats = await this.getChats();
    const index = chats.findIndex(c => c.id === chatId);
    if (index === -1) return;
    chats[index] = {...chats[index], ...updates};
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    this.emit('chatsChanged', chats);
  }

  async toggleMute(chatId: string, userId: string) {
    const chat = await this.getChat(chatId);
    if (!chat) return;
    const mutedBy = new Set(chat.mutedBy || []);
    if (mutedBy.has(userId)) {
      mutedBy.delete(userId);
    } else {
      mutedBy.add(userId);
    }
    await this.updateChat(chatId, {mutedBy: Array.from(mutedBy)});
  }

  async replaceMessages(chatId: string, messages: Message[]) {
    const trimmed =
      messages.length > MAX_MESSAGES_PER_CHAT
        ? messages.slice(messages.length - MAX_MESSAGES_PER_CHAT)
        : messages;
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.MESSAGES}:${chatId}`,
      JSON.stringify(trimmed),
    );
    this.emit('messageAdded', {chatId, message: trimmed[trimmed.length - 1]});
    const chat = await this.getChat(chatId);
    if (chat) {
      chat.lastMessage = trimmed[trimmed.length - 1];
      await this.saveChat(chat);
    }
  }

  async exportChat(chatId: string) {
    const chat = await this.getChat(chatId);
    const messages = await this.getMessages(chatId);
    return {chat, messages};
  }

  async exportAll() {
    const users = await this.getUsers();
    const chats = await this.getChats();
    const allMessages: Record<string, Message[]> = {};
    for (const chat of chats) {
      allMessages[chat.id] = await this.getMessages(chat.id);
    }
    return {users, chats, messages: allMessages};
  }

  async importChat(chatId: string, payload: {chat?: ChatRoom; messages?: Message[]}) {
    if (payload.chat) {
      await this.updateChat(chatId, payload.chat);
    }
    if (payload.messages) {
      await this.replaceMessages(chatId, payload.messages);
    }
  }

  async importAll(payload: {users?: User[]; chats?: ChatRoom[]; messages?: Record<string, Message[]>}) {
    if (payload.users) {
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(payload.users));
    }
    if (payload.chats) {
      await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(payload.chats));
    }
    if (payload.messages) {
      for (const [chatId, messages] of Object.entries(payload.messages)) {
        await AsyncStorage.setItem(
          `${STORAGE_KEYS.MESSAGES}:${chatId}`,
          JSON.stringify(messages),
        );
      }
    }
    this.emit('usersChanged', payload.users || []);
    this.emit('chatsChanged', payload.chats || []);
  }

  async pruneOldMedia(chatId: string, days: number) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const messages = await this.getMessages(chatId);
    const filtered = messages.filter(m => {
      const createdAt =
        m.createdAt instanceof Date
          ? m.createdAt.getTime()
          : new Date(m.createdAt).getTime();
      if (createdAt < cutoff && (m.image || m.video || m.audio || m.file)) {
        return false;
      }
      return true;
    });
    await this.replaceMessages(chatId, filtered);
  }

  async deleteChat(chatId: string): Promise<void> {
    const chats = await this.getChats();
    const filtered = chats.filter(c => c.id !== chatId);
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(filtered));
    this.emit('chatsChanged', filtered);
  }

  // Message management
  async saveMessage(chatId: string, message: Message): Promise<void> {
    const messages = await this.getMessages(chatId);
    messages.push(message);
    const trimmed =
      messages.length > MAX_MESSAGES_PER_CHAT
        ? messages.slice(messages.length - MAX_MESSAGES_PER_CHAT)
        : messages;
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.MESSAGES}:${chatId}`,
      JSON.stringify(trimmed),
    );
    this.emit('messageAdded', {chatId, message});

    // Update chat's last message
    const chat = await this.getChat(chatId);
    if (chat) {
      chat.lastMessage = message;
      await this.saveChat(chat);
    }
  }

  async getMessages(chatId: string): Promise<Message[]> {
    const data = await AsyncStorage.getItem(`${STORAGE_KEYS.MESSAGES}:${chatId}`);
    return data ? JSON.parse(data) : [];
  }

  async getDrafts(
    userId: string,
  ): Promise<Record<string, {text: string; updatedAt: number}>> {
    const data = await AsyncStorage.getItem(`${STORAGE_KEYS.DRAFTS}:${userId}`);
    return data ? JSON.parse(data) : {};
  }

  async getDraft(userId: string, chatId: string): Promise<string> {
    const drafts = await this.getDrafts(userId);
    return drafts[chatId]?.text || '';
  }

  async setDraft(userId: string, chatId: string, text: string) {
    const drafts = await this.getDrafts(userId);
    if (text) {
      drafts[chatId] = {text, updatedAt: Date.now()};
    } else {
      delete drafts[chatId];
    }
    await AsyncStorage.setItem(`${STORAGE_KEYS.DRAFTS}:${userId}`, JSON.stringify(drafts));
    this.emit('draftsChanged', {userId, chatId, text, updatedAt: Date.now()});
  }

  async updateMessage(chatId: string, messageId: string | number, updates: Partial<Message>) {
    const messages = await this.getMessages(chatId);
    const index = messages.findIndex(m => String(m._id) === String(messageId));
    if (index === -1) return;

    const updated = {...messages[index], ...updates};
    messages[index] = updated;

    await AsyncStorage.setItem(
      `${STORAGE_KEYS.MESSAGES}:${chatId}`,
      JSON.stringify(messages),
    );
    this.emit('messageUpdated', {chatId, message: updated});

    const chat = await this.getChat(chatId);
    if (chat?.lastMessage && String(chat.lastMessage._id) === String(messageId)) {
      chat.lastMessage = updated;
      await this.saveChat(chat);
    }
  }

  async deleteMessage(chatId: string, messageId: string | number) {
    const messages = await this.getMessages(chatId);
    const filtered = messages.filter(m => String(m._id) !== String(messageId));

    await AsyncStorage.setItem(
      `${STORAGE_KEYS.MESSAGES}:${chatId}`,
      JSON.stringify(filtered),
    );
    this.emit('messageDeleted', {chatId, messageId});

    const chat = await this.getChat(chatId);
    if (chat) {
      const last = filtered[filtered.length - 1];
      chat.lastMessage = last;
      await this.saveChat(chat);
    }
  }

  async toggleReaction(
    chatId: string,
    messageId: string | number,
    emoji: string,
    userId: string,
  ) {
    const messages = await this.getMessages(chatId);
    const index = messages.findIndex(m => String(m._id) === String(messageId));
    if (index === -1) return;

    const message = messages[index];
    const reactions = message.reactions || {};
    const users = new Set(reactions[emoji] || []);
    if (users.has(userId)) {
      users.delete(userId);
    } else {
      users.add(userId);
    }
    reactions[emoji] = Array.from(users);
    message.reactions = reactions;

    messages[index] = message;
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.MESSAGES}:${chatId}`,
      JSON.stringify(messages),
    );
    this.emit('messageUpdated', {chatId, message});
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USERS,
      STORAGE_KEYS.CHATS,
      STORAGE_KEYS.CURRENT_USER,
    ]);
    // Clear all message keys
    const keys = await AsyncStorage.getAllKeys();
    const messageKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.MESSAGES));
    await AsyncStorage.multiRemove(messageKeys);
  }
}

export default new StorageService();

