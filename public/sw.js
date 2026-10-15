/*
 * Service Worker FitTracker (PWA).
 * Стратегия кэширования:
 *  - навигация (HTML) — network-first с fallback в кэш (офлайн-запуск приложения);
 *  - статические ассеты (JS/CSS/иконки) — cache-first.
 */
const CACHE_NAME = 'fit-tracker-v1';
const PRECACHE_URLS = ['/fit-tracker/', '/fit-tracker/index.html', '/fit-tracker/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Навигация: сеть, при ошибке — закешированный HTML.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/fit-tracker/index.html'))),
    );
    return;
  }

  // Статика: cache-first с докэшированием свежих ответов.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
