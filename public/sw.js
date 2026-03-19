const VERSION = '{{VERSION}}'; // Iniettato dinamicamente dal server all'avvio
const CACHE_NAME = 'tgest-cache-' + VERSION;

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all open clients immediately.
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Delete old caches
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
  // Simple network-first strategy to ensure fresh content
  // but fallback to cache if offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if we received a valid response and it's not the service worker itself
        if (!response || response.status !== 200 || response.type !== 'basic' || event.request.url.includes('sw.js')) {
          return response;
        }

        // IMPORTANT: Clone the response. A response is a stream
        // and because we want the browser to consume the response
        // as well as the cache consuming the response, we need
        // to clone it so we have two streams.
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
