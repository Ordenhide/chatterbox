/**
 * Retires the service worker the site's first deploy left at the root.
 *
 * Until 2026-09-24 this Pages project's production deploy was the web client
 * alone, served at `/`, and it registered `/sw.js` with scope `/`. Everyone
 * who opened it — at chatterbox-eyz.pages.dev since August, or at
 * chatterbox.fans once the domain was bound — still has that worker. The site
 * now serves the landing page at `/` and the client at `/app/`, with the
 * client's own worker at `/app/sw.js`, so nothing registers this path any
 * more.
 *
 * Without this file the old worker would never leave. A browser rechecks
 * `/sw.js` periodically, and a 404 fails the update without unregistering
 * anything. Its navigations are network-first, so it did not hide the new
 * site — but it went on intercepting every request under `/` and caching
 * copies of them, indefinitely, from a build that predates the recovery-phrase
 * account.
 *
 * So this is what that recheck now finds: a worker that installs, deletes the
 * old build's entries, unregisters itself, and in between intercepts nothing.
 * It has no fetch handler on purpose.
 *
 * It clears only entries outside `/app/`. The client's worker uses the same
 * cache name, `chatterbox-v1`, and its entries are current.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  const retire = async () => {
    const cache = await caches.open('chatterbox-v1');
    for (const request of await cache.keys()) {
      if (!new URL(request.url).pathname.startsWith('/app/')) await cache.delete(request);
    }
  };
  event.waitUntil(
    retire()
      .catch(() => undefined)
      .then(() => self.registration.unregister()),
  );
});
