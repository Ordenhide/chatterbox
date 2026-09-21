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
import {decodeBody} from '../messageBody';
import {loadBodies} from '../messageBodyStore';
import {isNotificationContentHidden, isScreenLocked} from '../privacyGuard';
import i18n, {i18nReady} from '../../i18n';

const MESSAGES_CHANNEL_ID = 'messages';

/** Marks a notification whose body stands in for text it is not showing. */
const REDACTED_FLAG = '1';

/**
 * The body shown in place of the message itself.
 *
 * Deliberately says only that something arrived. Used for every case where the
 * text must not be on screen — the lock screen, the user's own always-hide
 * setting — and as the fallback when there is no text to show, so none of
 * those states is distinguishable from the others by looking at the shade.
 *
 * Awaits i18nReady rather than calling `t` straight away: this runs in the
 * background task, where a cold start triggered by the notification itself can
 * reach here before the asynchronous language detector has settled, and an
 * unresolved `t` answers in English. See src/i18n/index.ts.
 *
 * Never rejects, because this is what the handler's own last-resort catch
 * displays — one of these throwing would take out the path whose job is to
 * make sure *something* is shown. English is the honest fallback there, being
 * what i18n itself falls back to.
 *
 * The key is written out at both call sites rather than passed into a shared
 * helper, so the "every key used in code exists in en.json" test in
 * i18n/__tests__/locales.test.ts can see it: that check scans for a literal
 * inside `t(...)`, and a key reaching `t` through a parameter is invisible to
 * it. Worth two near-identical functions.
 */
async function redactedBody(): Promise<string> {
  try {
    await i18nReady;
    return i18n.t('push.sentYouAMessage');
  } catch {
    return 'Sent you a message';
  }
}

/** The title when the push carried no sender name. Same reasoning throughout. */
async function fallbackTitle(): Promise<string> {
  try {
    await i18nReady;
    return i18n.t('push.newMessage');
  } catch {
    return 'New message';
  }
}

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
async function showMessageNotification(
  title: string,
  body: string,
  options: {id?: string; data?: Record<string, string>} = {},
): Promise<void> {
  await notifee.createChannel({
    id: MESSAGES_CHANNEL_ID,
    name: 'Messages',
    importance: AndroidImportance.HIGH,
  });
  await notifee.displayNotification({
    // The message's own id, so revealing one later replaces it in place
    // rather than posting a second notification beside the redacted one.
    ...(options.id ? {id: options.id} : null),
    title,
    body,
    ...(options.data ? {data: options.data} : null),
    android: {
      channelId: MESSAGES_CHANNEL_ID,
      // A second line of defence, not the mechanism. The platform honours
      // this only when the user has turned on "hide sensitive notifications",
      // which is off by default — so what actually keeps the text off the
      // lock screen is the caller choosing redactedBody(). See isScreenLocked.
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
    if (type !== 'chat_message' || typeof chatId !== 'string' || typeof messageId !== 'string') {
      return;
    }
    // Resolved after the shape check, so a payload this handler ignores does
    // not pay for i18n at all.
    const title =
      typeof senderName === 'string' && senderName ? senderName : await fallbackTitle();
    if (isNotificationContentHidden()) {
      await showMessageNotification(title, await redactedBody(), {id: messageId});
      return;
    }
    try {
      const uid = getAuth().currentUser?.uid;
      const message = uid ? await getMessageById(chatId, messageId) : null;
      /**
       * Decrypted even when the text will not be displayed.
       *
       * resolveMessageText is what writes the body to the store that outlives
       * the envelope, and a ratchet envelope opens exactly once — so skipping
       * this while the phone is locked would not be a privacy win, it would
       * destroy the message. It is also what makes revealing it later free:
       * the plaintext is already on disk, so nothing has to be re-opened.
       */
      const text = message && uid ? await resolveMessageText(message, uid, chatId) : null;
      const locked = await isScreenLocked();
      if (text && locked) {
        await showMessageNotification(title, await redactedBody(), {
          id: messageId,
          data: {chatId, messageId, redacted: REDACTED_FLAG},
        });
        return;
      }
      await showMessageNotification(title, text || (await redactedBody()), {id: messageId});
    } catch {
      await showMessageNotification(title, await redactedBody(), {id: messageId});
    }
  });
}

/**
 * Swaps the real message into any notification that was posted while the phone
 * was locked.
 *
 * Called when the app comes back to the foreground, which is the one moment
 * that proves the device was unlocked. Android's own reveal-on-unlock — a
 * VISIBILITY_PRIVATE notification plus a publicVersion for the lock screen —
 * would do this without any bookkeeping, but notifee exposes no way to set a
 * publicVersion, so the swap is done here instead.
 *
 * Reads the text from the local body store rather than decrypting again: the
 * background handler already opened the envelope, and it only opens once.
 *
 * Only touches notifications still in the shade, and only those it marked
 * itself. One the user already dismissed is simply not in the list, and is
 * left dismissed rather than being re-posted with its contents showing.
 */
export async function revealNotificationsAfterUnlock(userId: string): Promise<void> {
  if (isNotificationContentHidden()) return;
  const displayed = await notifee.getDisplayedNotifications();
  for (const entry of displayed) {
    const data = entry.notification?.data;
    if (!data || data.redacted !== REDACTED_FLAG) continue;
    const chatId = typeof data.chatId === 'string' ? data.chatId : null;
    const messageId = typeof data.messageId === 'string' ? data.messageId : null;
    if (!chatId || !messageId) continue;

    const raw = (await loadBodies(userId, chatId)).get(messageId);
    if (!raw) continue;
    const {text} = decodeBody(raw);
    if (!text) continue;

    await showMessageNotification(String(entry.notification?.title ?? ''), text, {
      id: messageId,
      // The flag is dropped, so a later pass does not reveal this one twice.
      data: {chatId, messageId},
    });
  }
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
export {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
