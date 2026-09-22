import {useEffect, useRef, useState} from 'react';
import {listenChatsForUser} from '../services/chat';
import {isChatHidden} from '../services/hiddenChats';
import {showLocalNotification} from '../services/push';
import {useToast} from '../context/ToastContext';
import {useT} from '../i18n';

// Short, best-effort "new message" ping via Web Audio (no asset needed).
let audioCtx: AudioContext | null = null;
function playPing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.setValueAtTime(1180, t0 + 0.08);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.start(t0);
    osc.stop(t0 + 0.31);
  } catch {
    /* autoplay blocked / unsupported — ignore */
  }
}

/**
 * Returns the total unread count (muted and hidden chats excluded) for the
 * Chats-tab badge,
 * and — as a side effect — pops a toast + ping when a new message arrives in a
 * chat you're NOT currently viewing (and haven't muted). One chats listener
 * powers both, so it doesn't add extra Firestore subscriptions.
 */
export function useChatNotifications(uid: string, activeChatId: string | null): number {
  const [count, setCount] = useState(0);
  const toast = useToast();
  const {t} = useT();

  // Keep latest values without re-subscribing the listener.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const tRef = useRef(t);
  tRef.current = t;
  const activeRef = useRef(activeChatId);
  activeRef.current = activeChatId;
  const prevUnread = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    prevUnread.current = null; // reset baseline when the user changes
    return listenChatsForUser(uid, chats => {
      let total = 0;
      const next: Record<string, number> = {};
      for (const c of chats) {
        const n = c.unreadCountBy?.[uid] || 0;
        next[c.id] = n;
        // Hidden chats are excluded from the badge and from the toast below:
        // a notification naming a chat you deliberately hid would give it away.
        if (!c.mutedBy?.includes(uid) && !isChatHidden(c, uid)) total += n;
      }
      setCount(total);

      const prev = prevUnread.current;
      if (prev) {
        for (const c of chats) {
          const before = prev[c.id] || 0;
          const now = next[c.id] || 0;
          if (
            now > before &&
            c.id !== activeRef.current &&
            !c.mutedBy?.includes(uid) &&
            !isChatHidden(c, uid)
          ) {
            const name = c.nameBy?.[uid] || c.name;
            // Not lastMessage.text for a sealed message: that field holds a
            // fixed English marker written by the sender's client, and this
            // string goes into an OS notification in the reader's language.
            const body = c.lastMessage?.sealed
              ? tRef.current('chat.encryptedPreview')
              : c.lastMessage?.text || tRef.current('chat.newMessages');
            toastRef.current.show(name ? `${name}: ${body}` : body, 'info');
            playPing();
            // OS-level notification too (fires only when the tab isn't focused).
            showLocalNotification(name || 'Chatterbox', body, c.id);
          }
        }
      }
      prevUnread.current = next;
    });
  }, [uid]);

  return count;
}
