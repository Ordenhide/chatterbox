import {Platform} from 'react-native';
import {mmkvStorage} from './storageMMKV';
import {doc, getDoc, getFirestore, setDoc} from '@react-native-firebase/firestore';

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

export function applyScreenshotProtection(enabled: boolean): void {
  if (Platform.OS === 'android') {
    try {
      const {NativeModules} = require('react-native');
      NativeModules.ScreenshotGuard?.setSecureFlag?.(enabled);
    } catch {}
  }
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
