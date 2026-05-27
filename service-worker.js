const CACHE = 'omni-v2';
const SHELL = ['/', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => { if (k !== CACHE) return caches.delete(k); }))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => {
        if (res.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.startsWith('https://fonts.googleapis.com') || e.request.url.startsWith('https://fonts.gstatic.com'))) {
          c.put(e.request, clone);
        }
      });
      return res;
    }).catch(() => caches.match(e.request).then(fallback => {
      if (e.request.destination === 'document') return caches.match('/') || new Response('Offline', { status: 503 });
      return fallback || new Response('', { status: 404 });
    })))
  );
});
