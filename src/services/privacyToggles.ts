import {
  isExifStrippingEnabled,
  isNotificationContentHidden,
  isReadReceiptsEnabled,
  isTypingIndicatorEnabled,
  isScreenshotProtectionEnabled,
  setExifStripping,
  setNotificationContentHidden,
  setReadReceiptsEnabled,
  setTypingIndicatorEnabled,
  setScreenshotProtection,
} from './privacyGuard';

/**
 * The privacy switches, and the only three that earn one.
 *
 * Each entry names a stored flag that something in the app actually reads —
 * ChatScreen applies FLAG_SECURE from `screenshot`, push.ts suppresses
 * notification content from `notifications`, and both the chat and Moments
 * upload paths strip EXIF from `exif`. privacyGuard also stores watermark,
 * auto-lock and screenshot-alert flags with no readers at all; those are left
 * out deliberately rather than given a switch that changes nothing.
 */
export const PRIVACY_TOGGLES = [
  {
    key: 'screenshot' as const,
    title: 'profile.privacyScreenshotTitle',
    hint: 'profile.privacyScreenshotHint',
    read: isScreenshotProtectionEnabled,
    write: setScreenshotProtection,
  },
  {
    key: 'notifications' as const,
    title: 'profile.privacyNotificationsTitle',
    hint: 'profile.privacyNotificationsHint',
    read: isNotificationContentHidden,
    write: setNotificationContentHidden,
  },
  {
    key: 'typing' as const,
    title: 'profile.privacyTypingTitle',
    hint: 'profile.privacyTypingHint',
    read: isTypingIndicatorEnabled,
    write: setTypingIndicatorEnabled,
  },
  {
    key: 'receipts' as const,
    title: 'profile.privacyReceiptsTitle',
    hint: 'profile.privacyReceiptsHint',
    read: isReadReceiptsEnabled,
    write: setReadReceiptsEnabled,
  },
  {
    key: 'exif' as const,
    title: 'profile.privacyExifTitle',
    hint: 'profile.privacyExifHint',
    read: isExifStrippingEnabled,
    write: setExifStripping,
  },
];

export type PrivacyKey = (typeof PRIVACY_TOGGLES)[number]['key'];
