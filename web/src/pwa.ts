/**
 * Registers the app's service worker (offline app-shell + runtime caching).
 * Only runs in production builds served over https/localhost, where SWs are
 * allowed; in dev it's a no-op so Vite HMR isn't cached.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
