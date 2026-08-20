/**
 * Background push registration, behind the seam. See ./README.md.
 *
 * index.js called setBackgroundMessageHandler directly at module scope. That
 * file is the bundle entry, so it is evaluated on every platform including
 * HarmonyOS — where the messaging module does not exist.
 *
 * notifee isn't part of the Firebase seam above (it has no relation to
 * Firebase, and no HarmonyOS build to swap toward), so it's imported
 * directly here rather than re-exported through a platform pair. This file
 * has no .harmony.ts sibling exempting it from that rule anyway, since
 * push.harmony.ts already stands in for the whole module on that platform.
 */
import notifee, {AndroidImportance, AndroidVisibility} from '@notifee/react-native';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import {getAuth} from './auth';
import {getMessageById} from '../firebaseChat';
import {resolveMessageText} from '../e2eeMessages';
import {isNotificationContentHidden} from '../privacyGuard';

const MESSAGES_CHANNEL_ID = 'messages';

/**
 * Notification content lives on-device only: the server sends this as a
 * data-only message (chatId/messageId/senderName, no text -- see
 * functions/index.js notifyNewMessage) precisely so it has no plaintext to
 * leak, and this decrypts the real message locally with the same keys the
 * chat screen already uses before building the notification the OS displays.
 *
 * Falls back to a generic body on any failure (no session yet, key not
 * enrolled, decrypt error, Firestore unreachable) rather than showing
 * nothing -- the sender name alone is still a useful notification.
 */
async function showMessageNotification(title: string, body: string): Promise<void> {
  await notifee.createChannel({
    id: MESSAGES_CHANNEL_ID,
    name: 'Messages',
    importance: AndroidImportance.HIGH,
  });
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: MESSAGES_CHANNEL_ID,
      // Redacted to a generic line on the lock screen; the real title/body
      // above only show once the phone is unlocked.
      visibility: AndroidVisibility.PRIVATE,
      pressAction: {id: 'default'},
    },
  });
}

/**
 * Registers the background message handler.
 *
 * Must run at module scope in the entry file, before React renders: Firebase
 * warns if a background message arrives with no handler registered, and on a
 * cold start triggered *by* a notification that can happen immediately.
 */
export function registerBackgroundMessageHandler(): void {
  setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
    const {type, chatId, messageId, senderName} = remoteMessage.data ?? {};
    const title = typeof senderName === 'string' && senderName ? senderName : 'New message';
    if (type !== 'chat_message' || typeof chatId !== 'string' || typeof messageId !== 'string') {
      return;
    }
    if (isNotificationContentHidden()) {
      await showMessageNotification(title, 'Sent you a message');
      return;
    }
    try {
      const uid = getAuth().currentUser?.uid;
      const message = uid ? await getMessageById(chatId, messageId) : null;
      const text = message && uid ? await resolveMessageText(message, uid, chatId) : null;
      await showMessageNotification(title, text || 'Sent you a message');
    } catch {
      await showMessageNotification(title, 'Sent you a message');
    }
  });
}

/**
 * Foreground messaging, re-exported so App.tsx can name this module instead of
 * the vendor.
 *
 * The block using these is already gated to `Platform.OS === 'android'`, so it
 * never *runs* elsewhere — but a bare import is enough to pull React Native
 * Firebase into a bundle for a platform that has no such module, which is what
 * the guard is there to prevent.
 */
export {getMessaging, getToken, onMessage, onTokenRefresh} from '@react-native-firebase/messaging';
