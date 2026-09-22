/* Firebase Cloud Messaging service worker (background web push).
 *
 * Loaded by the browser from this worker's own directory when the user
 * enables notifications — `/` under `vite dev`, `/app/` on chatterbox.app.
 * Uses the Firebase *compat* builds via importScripts because service workers
 * can't use ES module imports. The config below is the public web config
 * (safe to expose) and must match src/firebase.ts.
 */

/* See the same constant in sw.js: a file in public/ is copied verbatim, so
 * nothing substitutes a base path in here and the icons and the click target
 * have to be resolved against wherever this worker actually lives. */
const BASE = new URL('./', self.location).pathname;

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAnDnGSww6_zdLEszsVM9tlpxZTDftBxi0',
  authDomain: 'chatterbox-e5d10.firebaseapp.com',
  projectId: 'chatterbox-e5d10',
  storageBucket: 'chatterbox-e5d10.firebasestorage.app',
  messagingSenderId: '916000207469',
  appId: '1:916000207469:ios:5b98744019cfb032dd0564',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'Chatterbox', {
    body: n.body || 'You have a new message',
    icon: `${BASE}icon.svg`,
    badge: `${BASE}icon.svg`,
    data: (payload.data && payload.data.link) || BASE,
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data || BASE;
  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(link);
    }),
  );
});
