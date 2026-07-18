import AsyncStorage from '@react-native-async-storage/async-storage';

type Listener<T> = (payload: T) => void;

class EventEmitter<TEvents extends Record<string, any>> {
  private events: {[K in keyof TEvents]?: Listener<TEvents[K]>[]} = {};

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event]?.push(listener);
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event]?.filter(existing => existing !== listener);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]) {
    this.events[event]?.forEach(listener => listener(payload));
  }
}

const STORAGE_KEYS = {
  MOMENTS_LAST_SEEN: '@chatterbox:moments_last_seen',
};

type NotificationEvents = {
  momentsSeen: {userId: string; timestamp: number};
};

const emitter = new EventEmitter<NotificationEvents>();

const momentsKey = (userId: string) => `${STORAGE_KEYS.MOMENTS_LAST_SEEN}:${userId}`;

export async function getMomentsLastSeen(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const value = await AsyncStorage.getItem(momentsKey(userId));
    return value ? Number(value) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function setMomentsLastSeen(userId: string, timestamp: number): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(momentsKey(userId), String(timestamp));
    emitter.emit('momentsSeen', {userId, timestamp});
  } catch {
    // Storage write failed; skip emit to avoid inconsistent state
  }
}

export function onMomentsLastSeen(listener: Listener<NotificationEvents['momentsSeen']>) {
  emitter.on('momentsSeen', listener);
  return () => emitter.off('momentsSeen', listener);
}

