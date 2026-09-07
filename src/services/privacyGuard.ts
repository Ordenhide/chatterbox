import {Platform} from 'react-native';
import {mmkvStorage} from './storageMMKV';
import {doc, getDoc, getFirestore, setDoc} from './firebase/firestore';
import {reportHandled} from './errorLog';

const db = getFirestore();

export function isScreenshotProtectionEnabled(): boolean {
  return mmkvStorage.getBoolean('screenshot_protection') ?? false;
}

export function setScreenshotProtection(enabled: boolean): void {
  mmkvStorage.setBoolean('screenshot_protection', enabled);
}

export function getScreenshotAlertEnabled(): boolean {
  return mmkvStorage.getBoolean('screenshot_alert') ?? false;
}

export function setScreenshotAlert(enabled: boolean): void {
  mmkvStorage.setBoolean('screenshot_alert', enabled);
}

export function isStealthMode(): boolean {
  return mmkvStorage.getBoolean('stealth_mode') ?? false;
}

export async function setStealthMode(
  enabled: boolean,
  userId: string,
): Promise<void> {
  mmkvStorage.setBoolean('stealth_mode', enabled);
  const stealth = {
    hideOnline: enabled,
    hideTyping: enabled,
    hideReadReceipts: enabled,
    hideLastSeen: enabled,
  };
  await setDoc(doc(db, 'users', userId), {stealth}, {merge: true});
}

export async function getStealthSettings(
  userId: string,
): Promise<{
  hideOnline: boolean;
  hideTyping: boolean;
  hideReadReceipts: boolean;
  hideLastSeen: boolean;
}> {
  const fallback = {
    hideOnline: false,
    hideTyping: false,
    hideReadReceipts: false,
    hideLastSeen: false,
  };
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.data()?.stealth ?? fallback;
  } catch {
    return fallback;
  }
}

export function isExifStrippingEnabled(): boolean {
  return mmkvStorage.getBoolean('strip_exif') ?? true;
}

export function setExifStripping(enabled: boolean): void {
  mmkvStorage.setBoolean('strip_exif', enabled);
}

export function isWatermarkEnabled(): boolean {
  return mmkvStorage.getBoolean('watermark_enabled') ?? false;
}

export function setWatermark(enabled: boolean): void {
  mmkvStorage.setBoolean('watermark_enabled', enabled);
}

export function generateWatermark(userId: string): string {
  const input = userId + Date.now();
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

export function isLinkPreviewEnabled(): boolean {
  return mmkvStorage.getBoolean('link_preview_enabled') ?? true;
}

export function setLinkPreviewEnabled(enabled: boolean): void {
  mmkvStorage.setBoolean('link_preview_enabled', enabled);
}

/**
 * Applies or clears Android's FLAG_SECURE, and returns what the window is
 * actually doing — not what the preference says.
 *
 * ChatScreen shows the user a green banner reading "Screenshot protection
 * active". An assurance like that has to be derived from the mechanism. The
 * preference being true and FLAG_SECURE being set are two different facts, and
 * this function — the only thing that can make them agree — had no callers at
 * all, so the banner was answering a stored boolean and nothing else. Anyone
 * finishing the feature by wiring up a settings toggle would have got a banner
 * promising protection over a window that never had the flag.
 *
 * Returns false on iOS, where there is no equivalent window flag, and on any
 * failure. Failures are reported rather than swallowed: a security control
 * that silently does not apply is the one case where silence costs the most.
 */
export function applyScreenshotProtection(enabled: boolean): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    const {NativeModules} = require('react-native');
    const guard = NativeModules.ScreenshotGuard;
    // Was `guard?.setSecureFlag?.(enabled)`, which made a missing native
    // module and a successful call look identical from here.
    if (typeof guard?.setSecureFlag !== 'function') {
      reportHandled(new Error('ScreenshotGuard native module unavailable'), 'screenshot_protection');
      return false;
    }
    guard.setSecureFlag(enabled);
    return enabled;
  } catch (error) {
    reportHandled(error, 'screenshot_protection_failed');
    return false;
  }
}

/**
 * Typing indicators and read receipts, both **off by default** and both
 * reciprocal.
 *
 * These are the two fields that put behaviour, not content, on the server in
 * the clear: `typingBy` records when you picked up your phone and how long you
 * spent composing, `lastReadAt` records when you read and how long you took to
 * answer. That is a schedule, an attention map and a social ranking, none of
 * which the message encryption touches — and unlike the participant list, they
 * are entirely optional.
 *
 * Off by default because the audience this app is for would turn them off, and
 * a privacy default that has to be found in a settings screen is not a default.
 *
 * Reciprocal because the alternative is taking the signal without giving it:
 * one flag governs both sending yours and seeing theirs. It also makes the
 * setting explainable in one sentence, which a send-only switch is not.
 *
 * Turning either off stops new writes; it does not erase what a chat already
 * holds from before.
 */
export function isTypingIndicatorEnabled(): boolean {
  return mmkvStorage.getBoolean('typing_indicator') ?? false;
}

export function setTypingIndicatorEnabled(enabled: boolean): void {
  mmkvStorage.setBoolean('typing_indicator', enabled);
}

export function isReadReceiptsEnabled(): boolean {
  return mmkvStorage.getBoolean('read_receipts') ?? false;
}

export function setReadReceiptsEnabled(enabled: boolean): void {
  mmkvStorage.setBoolean('read_receipts', enabled);
}

export function isNotificationContentHidden(): boolean {
  return mmkvStorage.getBoolean('hide_notification_content') ?? false;
}

export function setNotificationContentHidden(enabled: boolean): void {
  mmkvStorage.setBoolean('hide_notification_content', enabled);
}

export function getAutoLockDelay(): number {
  return mmkvStorage.getNumber('auto_lock_delay') ?? 0;
}

export function setAutoLockDelay(seconds: number): void {
  mmkvStorage.setNumber('auto_lock_delay', seconds);
}
