/* eslint-env serviceworker */
// Service Worker FitTracker (TypeScript-исходник, компилируется Vite в dist/sw.js).
// Стратегии кэширования (workbox):
//  - статика (JS/CSS/иконки с хешем) — CacheFirst;
//  - Supabase Auth (сессии) — NetworkFirst (последние данные при возврате в сеть);
//  - Supabase REST (данные) — NetworkFirst с фолбэпом в кэш (офлайн показываются последние данные);
//  - навигация — NetworkFirst с фолбэпом на офлайн-страницу /fit-tracker/offline.html.

import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: NonNullable<unknown> };

// Пре-кэш собранной статики (Vite подставляет манифест при сборке).
precacheAndRoute(self.__WB_MANIFEST as never);

// Навигация (HTML): сеть → кэш → офлайн-страница.
registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      try {
        const response = await fetch(request);
        const copy = response.clone();
        void caches.open('ft-pages').then((cache) => cache.put(request, copy));
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        const offline = await caches.match('/fit-tracker/offline.html');
        return offline ?? Response.error();
      }
    },
  ),
);

// Статика этого же origin: CacheFirst (имена файлов содержат content-hash).
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && !url.pathname.endsWith('/offline.html'),
  new CacheFirst({
    cacheName: 'ft-static',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// Supabase Auth: критична актуальность токенов — NetworkFirst.
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/auth/'),
  new NetworkFirst({
    cacheName: 'ft-auth',
    networkTimeoutSeconds: 5,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// Supabase REST (PostgREST): последние данные доступны офлайн из кэша.
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/'),
  new NetworkFirst({
    cacheName: 'ft-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
);

// Push-уведомления: показываем payload от сервера и фокусируем приложение по клику.
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string } = {};
  try {
    data = event.data ? (event.data.json() as typeof data) : {};
  } catch {
    data = { body: event.data?.text() ?? '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FitTracker', {
      body: data.body ?? 'Пора на тренировку! 💪',
      icon: '/fit-tracker/icons/icon-192.png',
      badge: '/fit-tracker/icons/icon-192.png',
      data: { url: '/fit-tracker/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(event.notification.data?.url ?? '/fit-tracker/');
    }),
  );
});

// Немедленная активация новой версии SW (без ожидания закрытия вкладок).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
