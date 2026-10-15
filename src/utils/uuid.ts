/**
 * Генерация UUID v4.
 * Используется для id сессий и подходов, потому что таблицы Supabase
 * (workout_sessions.id, workout_sets.id) имеют тип uuid — не-UUID строки
 * приводят к ошибке PostgreSQL:
 *   "Invalid input syntax for type uuid: \"session-mv9v5ggs\""
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback для старых браузеров без crypto.randomUUID:
  // сборка UUID v4 из Math.random() (не криптографически стоек, формат корректный).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Проверка строки на формат UUID (для миграции старых не-UUID id из localStorage). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
