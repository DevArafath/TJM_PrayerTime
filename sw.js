// Bump VERSION whenever you change index.html, style.css, app.js or icons.
const VERSION = 'v4', CACHE = 'prayer-times-' + VERSION;
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'data/prayer-times.json', 'data/settings.json'];

self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/data/')) {
    // JSON: use the network when online (so edits show up), cache when offline
    e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); return res;
    }).catch(() => caches.match(r)));
  } else {
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r)));
  }
});
