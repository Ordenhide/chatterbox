import {useEffect, useRef} from 'react';
import {listenReminders, markReminderSent} from '../services/reminders';
import {showLocalNotification} from '../services/push';
import {useT} from '../i18n';
import type {Reminder} from '../types';

// Delivers due message reminders while the app is open: watches the user's
// pending reminders and, once remindAt passes, fires a local notification and
// flips `sent` so it never fires twice (across tabs/devices too, since the flag
// lives in Firestore). This is the client-side counterpart to a reminder
// Cloud Function — a reminder set on mobile can therefore also fire on web.
export function useReminders(uid: string | null): void {
  const pending = useRef<Reminder[]>([]);
  const fired = useRef<Set<string>>(new Set());
  // In a ref, not a dependency: the sweep runs on a 20-second interval, and
  // listing `t` would tear down and rebuild the listener and the timer on
  // every language change. Same pattern as useChatNotifications.
  const {t} = useT();
  const tRef = useRef(t);
  tRef.current = t;

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
        // Names the reminder rather than quoting the message.
        //
        // This used to read `r.messagePreview`, a copy of the message text
        // kept on the server so the reminder push could quote it. That field
        // is gone from both clients — a plaintext message's preview was real
        // text on the server and on a lock screen, against a privacy policy
        // that says notifications carry no message text. Clicking through
        // opens the chat, which is where the message can be read.
        //
        // Translated, too. The fallback here was the literal string 'Message
        // reminder', so a reminder firing in this tab was English whatever
        // language the app was in. `reminder.default` is the same sentence,
        // already carried by every dictionary.
        showLocalNotification(tRef.current('reminder.default'), '', r.chatId);
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
