import { supabase, type Database } from '../lib/supabase';

/** Формы вставки cloud-таблиц — payload'ы приводятся к ним явно (strict TS). */
type SessionInsert = Database['public']['Tables']['workout_sessions']['Insert'];
type SetInsert = Database['public']['Tables']['workout_sets']['Insert'];

/**
 * Простая очередь офлайн-синхронизации.
 * Если при завершении тренировки нет соединения (или запрос к Supabase упал),
 * данные кладутся в localStorage; при появлении сети (событие 'online' или
 * принудительный вызов) накопленные записи отправляются в БД по одной.
 */

/** Ключ localStorage для очереди синхронизации. */
const QUEUE_KEY = 'fit-tracker-sync-queue';

/** Элемент очереди: тренировочная сессия + её подходы (готовые формы вставки БД). */
export interface QueuedSessionSync {
  /** Идентификатор записи в очереди. */
  id: string;
  /** Метка времени помещения в очередь (мс). */
  queuedAt: number;
  /** Строка для таблицы workout_sessions. */
  session: SessionInsert;
  /** Строки для таблицы workout_sets. */
  sets: SetInsert[];
}

/** Читает всю очередь из localStorage (пустой массив при отсутствии/повреждении данных). */
export function getQueue(): QueuedSessionSync[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Минимальная структурная проверка вместо any-каста.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedSessionSync =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        'session' in item &&
        'sets' in item,
    );
  } catch (error) {
    console.error('[syncQueue] Не удалось прочитать очередь:', error);
    return [];
  }
}

/** Сохраняет очередь в localStorage. */
function saveQueue(queue: QueuedSessionSync[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[syncQueue] Не удалось сохранить очередь:', error);
  }
}

/** Добавляет запись в очередь (защита от дублей по id сессии). */
export function addToQueue(data: Omit<QueuedSessionSync, 'id' | 'queuedAt'>): QueuedSessionSync {
  const queue = getQueue();
  const sessionId = data.session.id;
  const existing = queue.find((item) => item.session.id === sessionId);
  if (existing) {
    // Уже в очереди — обновляем содержимое существующей записи.
    existing.session = data.session;
    existing.sets = data.sets;
    existing.queuedAt = Date.now();
    saveQueue(queue);
    return existing;
  }
  const entry: QueuedSessionSync = {
    id: `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    session: data.session,
    sets: data.sets,
  };
  queue.push(entry);
  saveQueue(queue);
  console.info(`[syncQueue] Запись добавлена в очередь офлайн-синхронизации (всего: ${queue.length})`);
  return entry;
}

/** Отправляет один элемент очереди в Supabase. true — успех, false — оставить в очереди. */
async function flushEntry(entry: QueuedSessionSync): Promise<boolean> {
  try {
    // 1) Сессия (upsert по id — повторная отправка безопасна).
    const { error: sessionError } = await supabase
      .from('workout_sessions')
      .upsert(entry.session);
    if (sessionError) throw sessionError;
    // 2) Подходы: upsert с onConflict по id — подход уже мог быть записан частично
    //    при предыдущей неудачной попытке, обычная inserт дал бы дубли/коллизии.
    if (entry.sets.length > 0) {
      const { error: setsError } = await supabase
        .from('workout_sets')
        .upsert(entry.sets, { onConflict: 'id' });
      if (setsError) throw setsError;
    }
    return true;
  } catch (error) {
    console.error('[syncQueue] Не удалось отправить запись в облако:', error);
    return false;
  }
}

/**
 * Синхронизирует очередь с Supabase: отправляет записи по порядку,
 * успешно отправленные удаляет из localStorage. Возвращает число оставшихся записей.
 */
export async function syncQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;
  if (!navigator.onLine) {
    console.info('[syncQueue] Сети нет — откладываем синхронизацию.');
    return queue.length;
  }

  const remaining: QueuedSessionSync[] = [];
  for (const entry of queue) {
    const ok = await flushEntry(entry);
    if (!ok) {
      // Проблемы с сетью/БД — останавливаемся, остаток ждёт следующей попытки.
      remaining.push(entry, ...queue.slice(queue.indexOf(entry) + 1));
      break;
    }
  }
  saveQueue(remaining);
  if (remaining.length === 0) {
    console.info('[syncQueue] Очередь синхронизирована полностью.');
  }
  return remaining.length;
}

/** Автоподписка: при возвращении в сеть пробуем отправить накопленное. */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void syncQueue().catch((error) => console.error('[syncQueue] Ошибка авто-синхронизации:', error));
  });
}
