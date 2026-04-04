const VERSION = '{{VERSION}}';
const CACHE_NAME = 'tgest-cache-' + VERSION;

const APP_STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-196.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_STATIC_RESOURCES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Clearing Old Cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic' || event.request.url.includes('sw.js')) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // IL TRUCCO PER PWABUILDER: Ritorna sempre status 200 con una vera paginetta HTML
        return new Response(
          '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Offline</title><style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#334155;}h1{font-size:1.5rem;margin-bottom:0.5rem;color:#0f172a;}</style></head><body><h1>Sei Offline 📶</h1><p>Controlla la connessione per usare l\'app.</p></body></html>',
          {
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'text/html' })
          }
        );
      });
    })
  );
});
