import {arrayUnion, deleteField, doc, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from '../firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * The app's icon, resolved against wherever the app is served from.
 *
 * A leading slash is the marketing site's root on chatterbox.app, where this
 * app lives under /app/ — so every notification asked the browser for an icon
 * that 404s. Unlike the service-worker paths nearby this one is on a live
 * path: showLocalNotification below is what useReminders and
 * useChatNotifications call today.
 */
const ICON_URL = `${import.meta.env.BASE_URL}icon.svg`;

export type PushState =
  | 'unsupported' // browser can't show notifications at all
  | 'default' // not yet asked
  | 'granted'
  | 'denied';

/** Whether the browser can show notifications at all (no VAPID needed). */
export function notificationsSupported(): boolean {
  return 'Notification' in window;
}

export function currentPermission(): PushState {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission as PushState;
}

/**
 * Requests notification permission. Once granted, the app shows notifications
 * locally via the Notification API (works with no backend — see
 * showLocalNotification in useChatNotifications). Additionally, IF a VAPID key
 * is configured, registers an FCM token so a future Cloud Function could also
 * push while the app is fully closed — that part is best-effort and optional.
 */
export async function enablePush(uid: string): Promise<PushState> {
  if (!notificationsSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission as PushState;

  // Local notifications now work. Best-effort FCM registration for background
  // push (only when a VAPID key is set and the browser supports it).
  if (VAPID_KEY && 'serviceWorker' in navigator) {
    try {
      const {getToken, getMessaging, isSupported, onMessage} = await import('firebase/messaging');
      if (await isSupported()) {
        const {app} = await import('../firebase');
        // Both paths are relative to BASE_URL rather than the origin root.
        // The site build serves this app from /app/, so the script lives at
        // /app/firebase-messaging-sw.js and an absolute '/…' would 404 on the
        // marketing site.
        //
        // This is latent rather than an outage today: VAPID_KEY above is
        // unset, so the guard on it is statically false and this whole block
        // is dead-code-eliminated — the built bundle contains no reference to
        // the worker at all. It would have broken on the day someone set the
        // key, which is the worst moment to find out.
        //
        // The scope has to move with it: a worker under /app/ cannot claim a
        // scope above its own directory without a Service-Worker-Allowed
        // header, which Hosting does not send here.
        const base = import.meta.env.BASE_URL;
        const registration = await navigator.serviceWorker.register(
          `${base}firebase-messaging-sw.js`,
          {scope: `${base}firebase-cloud-messaging-push-scope`},
        );
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });
        if (token) {
          // Push tokens go in the owner-only private subcollection, not the
          // public profile doc (readable by any signed-in user).
          await setDoc(
            doc(db, 'users', uid, 'private', 'push'),
            {fcmTokens: arrayUnion(token), pushUpdatedAt: serverTimestamp()},
            {merge: true},
          );
          // Strip any token left on the public profile by older app versions.
          await setDoc(doc(db, 'users', uid), {fcmTokens: deleteField(), fcmToken: deleteField()}, {merge: true}).catch(
            () => undefined,
          );
        }
        onMessage(messaging, payload => {
          const n = payload.notification;
          if (n && Notification.permission === 'granted') {
            new Notification(n.title || 'Chatterbox', {body: n.body, icon: ICON_URL});
          }
        });
      }
    } catch (err) {
      console.warn('FCM registration failed (local notifications still work):', err);
    }
  }

  return 'granted';
}

/**
 * Shows an OS-level notification, but only when the tab isn't focused (the
 * in-app toast covers the focused case). Best-effort: silently no-ops without
 * permission. `tag` collapses repeat notifications from the same chat.
 */
export function showLocalNotification(title: string, body: string, chatId: string): void {
  try {
    if (!notificationsSupported() || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    const n = new Notification(title || 'Chatterbox', {
      body,
      icon: ICON_URL,
      tag: `chat-${chatId}`,
    });
    n.onclick = () => {
      window.focus();
      window.location.hash = `#/chats/${chatId}`;
      n.close();
    };
  } catch {
    /* notifications unavailable — ignore */
  }
}
