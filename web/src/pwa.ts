/**
 * Registers the app's service worker (offline app-shell + runtime caching).
 * Only runs in production builds served over https/localhost, where SWs are
 * allowed; in dev it's a no-op so Vite HMR isn't cached.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    // BASE_URL, not '/': the site build serves this app from /app/ (vite
    // --base), where '/sw.js' is the marketing site's root and 404s, so the
    // worker silently never registered in the only build that ships. Vite
    // guarantees BASE_URL ends in a slash.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
