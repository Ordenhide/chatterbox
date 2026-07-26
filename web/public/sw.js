/* Chatterbox service worker — offline app-shell + runtime caching.
 *
 * Strategy:
 *  - Navigations: network-first, falling back to the cached app shell so the
 *    app opens offline (Vite is a SPA — index.html is the shell).
 *  - Same-origin GET assets (hashed JS/CSS/images): stale-while-revalidate, so
 *    repeat loads are instant and the cache self-heals on the next online load.
 *  - Firestore/Auth/Storage requests are never cached (let the SDK handle them).
 */
const CACHE = 'chatterbox-v1';
const SHELL = '/index.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.add(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false;
  // Don't cache the SW itself or dev/HMR endpoints.
  if (url.pathname === '/sw.js') return false;
  return /\.(js|css|woff2?|png|jpg|jpeg|svg|webp|ico|webmanifest)$/i.test(url.pathname);
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // App navigations → network-first with shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

/* ---- Web push (fired by the FCM service worker too; safe no-op if unused) ---- */
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {body: event.data && event.data.text ? event.data.text() : ''};
  }
  const title = data.title || 'Chatterbox';
  const options = {
    body: data.body || 'You have a new message',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: data.link || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(link);
    }),
  );
});
