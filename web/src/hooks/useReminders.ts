import {useEffect, useRef} from 'react';
import {listenReminders, markReminderSent} from '../services/reminders';
import {showLocalNotification} from '../services/push';
import type {Reminder} from '../types';

// Delivers due message reminders while the app is open: watches the user's
// pending reminders and, once remindAt passes, fires a local notification and
// flips `sent` so it never fires twice (across tabs/devices too, since the flag
// lives in Firestore). This is the client-side counterpart to a reminder
// Cloud Function — a reminder set on mobile can therefore also fire on web.
export function useReminders(uid: string | null): void {
  const pending = useRef<Reminder[]>([]);
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const unsub = listenReminders(uid, list => {
      pending.current = list;
    });

    const sweep = () => {
      const now = Date.now();
      pending.current.forEach(r => {
        if (r.remindAt > now || fired.current.has(r.id)) return;
        fired.current.add(r.id);
        // messagePreview is deliberately empty for reminders set on sealed
        // messages (see ChatPane's setReminder) — the title carries the whole
        // notification in that case rather than showing a blank body.
        const preview = r.messagePreview || 'Message reminder';
        showLocalNotification(preview, r.messagePreview || '', r.chatId);
        markReminderSent(uid, r.id).catch(() => fired.current.delete(r.id));
      });
    };

    sweep();
    const id = setInterval(sweep, 20_000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [uid]);
}
