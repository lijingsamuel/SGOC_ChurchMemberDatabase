/**
 * service-worker.js
 * Cache-first app shell for offline/installable PWA behavior. API calls to
 * the Apps Script backend are cross-origin POST requests and are deliberately
 * left untouched (network only) — they're handled by the offline queue in
 * js/db.js + js/api.js instead of the Cache API.
 */

const CACHE_NAME = 'church-family-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/auth.js',
  './js/admin.js',
  './js/config.js',
  './js/dashboard.js',
  './js/db.js',
  './js/familyList.js',
  './js/members.js',
  './js/router.js',
  './js/search.js',
  './js/utils.js',
  './js/wizard.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only manage same-origin GET requests (the app shell). Everything else
  // (the Apps Script API, fonts, etc.) goes straight to the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached || caches.match('./offline.html'));
      return cached || networkFetch;
    })
  );
});
