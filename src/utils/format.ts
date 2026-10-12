import type { WeightUnits } from '../types';

/**
 * Утилиты форматирования времени, веса и дат для интерфейса FitTracker.
 */

/**
 * Форматирует продолжительность в строку "MM:SS".
 * Значение больше часа отображается как "M:SS" с общим числом минут (например, 75:00).
 * @param seconds - количество секунд (не отрицательное)
 * @returns строка вида "MM:SS"
 */
export function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(restSeconds).padStart(2, '0')}`;
}

/** Коэффициент пересчёта килограммов в фунты. */
const KG_TO_LBS = 2.2046226218;

/**
 * Форматирует вес в выбранных единицах измерения.
 * @param kg - вес в килограммах
 * @param units — целевые единицы: 'kg' или 'lbs'
 * @returns строка вида "80 кг" или "176 lbs"
 */
export function formatWeight(kg: number, units: WeightUnits): string {
  if (units === 'lbs') {
    // Округляем до одного знака после запятой для читаемости.
    const lbs = Math.round(kg * KG_TO_LBS * 10) / 10;
    return `${lbs} lbs`;
  }
  return `${kg} кг`;
}

/**
 * Форматирует метку времени (мс) в локальную дату и время в формате ru-RU.
 * @param timestamp - Unix-время в миллисекундах
 * @returns строка вида "12.10.2026, 18:30"
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
