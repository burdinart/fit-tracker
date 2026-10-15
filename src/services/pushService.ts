/**
 * Клиентский сервис Web Push-уведомлений.
 * - subscribeForPush(): запрашивает разрешение Notification.requestPermission(),
 *   ждёт готовности Service Worker, подписывает браузер через pushManager.subscribe
 *   (applicationServerKey — VAPID-ключ из VITE_VAPID_PUBLIC_KEY) и сохраняет
 *   endpoint в Supabase (таблица push_subscriptions).
 * - unsubscribeFromPush(): отписывает и помечает подписку неактивной.
 * Если VAPID-ключ не настроен — бросает понятную ошибку (UI покажет подсказку).
 */
import { supabase } from '../lib/supabase';

const SW_URL = `${import.meta.env.BASE_URL}sw.js`;

/** URL публичного VAPID-ключа (base64url). Без него подписка невозможна. */
function getVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/** base64url → Uint8Array (формат applicationServerKey). */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = base64String.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const rawData = atob(base64);
  // ArrayBuffer явно — чтобы тип совпал с BufferSource в подписке PushManager.
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Ожидание активной регистрации SW (нужен для pushManager). */
async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker не поддерживается этим браузером.');
  }
  let registration = await navigator.serviceWorker.getRegistration(SW_URL);
  if (registration === undefined) {
    registration = await navigator.serviceWorker.register(SW_URL);
  }
  if (registration.active === null) {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 5000); // страховка: не ждать вечно
      navigator.serviceWorker.ready.then(() => {
        window.clearTimeout(timer);
        resolve();
      });
    });
    const ready = await navigator.serviceWorker.getRegistration(SW_URL);
    if (ready === undefined) throw new Error('Не удалось активировать Service Worker.');
    registration = ready;
  }
  return registration;
}

/** Подписка на push-уведомления с сохранением endpoint в Supabase. */
export async function subscribeForPush(): Promise<void> {
  const publicKey = getVapidPublicKey();
  if (publicKey === null) {
    throw new Error(
      'Push-сервер не настроен: добавьте VITE_VAPID_PUBLIC_KEY и задеплойте Edge Function send-push.',
    );
  }

  if (!('Notification' in window)) {
    throw new Error('Уведомления не поддерживаются этим браузером.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Разрешение на уведомления не выдано.');
  }

  const registration = await getReadyRegistration();
  if (registration.pushManager === undefined) {
    throw new Error('Push API недоступна (нужен HTTPS и поддержка браузером).');
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  // Сохраняем подписку на сервере (id берём из authStore-сессии Supabase).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    throw new Error('Нужно войти в аккаунт перед включением напоминаний.');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: subscription.endpoint,
      user_id: user.id,
      keys: subscription.toJSON().keys ?? {},
      active: true,
    },
    { onConflict: 'endpoint' },
  );
  if (error !== null) {
    throw new Error(`Не удалось сохранить подписку: ${error.message}`);
  }
}

/** Отписка от push-уведомлений. */
export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription !== undefined && subscription !== null) {
    await supabase
      .from('push_subscriptions')
      .update({ active: false })
      .eq('endpoint', subscription.endpoint)
      .then();
    await subscription.unsubscribe();
  }
}
