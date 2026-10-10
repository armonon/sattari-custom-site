// Emergency replacement for /studio-sw.js. If the studio service worker ever
// misbehaves in production, deploy this file AS dist/studio-sw.js:
//   cp scripts/kill-switch-studio-sw.js dist/studio-sw.js   (then deploy dist)
// Browsers re-check /studio-sw.js on every studio visit (it is served with
// Cache-Control: no-cache, netlify.toml), install this worker straight away,
// and it deletes the studio caches, unregisters itself and reloads open
// studio tabs from the network. Restoring an older deploy alone does NOT
// remove a worker browsers already have; this file does.
/* global clients */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => /^sattari-(studio|split-offline)/.test(name))
          .map((name) => caches.delete(name))
      );
      await self.registration.unregister();
      const windows = await clients.matchAll({ type: 'window' });
      windows.forEach((client) => client.navigate(client.url));
    })()
  );
});
