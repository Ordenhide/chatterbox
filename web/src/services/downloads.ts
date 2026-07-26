// Native-app download targets. Detects the visitor's OS so the web page can
// offer the matching build, and falls back to listing all platforms on desktop.
//
// The actual URLs come from env (set them at build/deploy time); until then they
// default to '#', which the UI treats as "coming soon".
export type DownloadPlatform = 'ios' | 'android' | 'macos';

export const PLATFORM_NAME: Record<DownloadPlatform, string> = {
  ios: 'iOS',
  android: 'Android',
  macos: 'macOS',
};

// macOS isn't a native download — it installs the web app as a PWA (handled in
// DownloadAppCard), so it has no URL here.
export const DOWNLOAD_URLS: Record<DownloadPlatform, string> = {
  ios: import.meta.env.VITE_DOWNLOAD_IOS || '#',
  android: import.meta.env.VITE_DOWNLOAD_ANDROID || '#',
  macos: '#',
};

export function isConfigured(p: DownloadPlatform): boolean {
  return DOWNLOAD_URLS[p] !== '#';
}

/**
 * Best-guess native platform for the current device, or null on desktop
 * OSes we don't ship a build for (Windows/Linux) — where we show all options.
 */
export function detectPlatform(): DownloadPlatform | null {
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as "MacIntel" but exposes touch points.
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  return null;
}
