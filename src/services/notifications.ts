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

