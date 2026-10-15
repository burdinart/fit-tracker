import type { WorkoutSession } from '../types';

/**
 * Аналитика тренировок: объём, прогресс по упражнениям,
 * расчётный одноповторный максимум (1ПМ) и серия дней подряд.
 * Все функции чистые — работают с массивом сессий из historyStore.
 */

/** Тоннаж одного подхода: вес (кг) × повторы. Незавершённые подходы не считаются. */
function setVolume(weight: number, reps: number): number {
  return weight * reps;
}

/**
 * Общий тренировочный объём (тоннаж, кг) по всем сессиям:
 * сумма (вес × повторы) по всем ВЫПОЛНЕННЫМ подходам.
 */
export function getTotalVolume(sessions: WorkoutSession[]): number {
  let total = 0;
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const workoutSet of exercise.sets) {
        if (workoutSet.isCompleted) {
          total += setVolume(workoutSet.weight, workoutSet.reps);
        }
      }
    }
  }
  return total;
}

/** Точка графика прогресса: дата сессии (мс) и суммарный объём упражнения в этот день (кг). */
export interface VolumePoint {
  /** Метка времени тренировки (мс). */
  date: number;
  /** Суммарный объём упражнения за тренировку (вес × повторы по всем выполненным подходам). */
  volume: number;
}

/**
 * Прогресс по конкретному упражнению для построения графика «объём по дням».
 * @param exerciseId - id упражнения из справочника
 * @param sessions - все сессии истории
 * @returns точки { date, volume }, отсортированные по дате (хронологически, слева направо)
 */
export function getExerciseProgress(exerciseId: string, sessions: WorkoutSession[]): VolumePoint[] {
  const points: VolumePoint[] = [];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) {
        continue;
      }
      const volume = exercise.sets
        .filter((workoutSet) => workoutSet.isCompleted)
        .reduce((sum, workoutSet) => sum + setVolume(workoutSet.weight, workoutSet.reps), 0);
      // В одну тренировку упражнение может попадать несколько раз (дубли) — суммируем в одну точку.
      const existing = points.find((point) => point.date === session.date);
      if (existing !== undefined) {
        existing.volume += volume;
      } else {
        points.push({ date: session.date, volume });
      }
    }
  }
  return points.sort((a, b) => a.date - b.date);
}

/**
 * Расчётный одноповторный максимум по формуле Эпли:
 * 1RM = вес × (1 + повторы / 30).
 * Округляет результат до 0.5 кг (минимальный практический шаг).
 * @param weight - рабочий вес (кг)
 * @param reps - количество повторений
 */
export function getEstimated1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
    return 0;
  }
  const epley = weight * (1 + reps / 30);
  return Math.round(epley * 2) / 2;
}

/** Максимальный расчётный 1ПМ среди выполненных подходов упражнения в сессии. */
export function getMaxEstimated1RM(
  session: WorkoutSession,
  exerciseId: string,
): number {
  let best = 0;
  for (const exercise of session.exercises) {
    if (exercise.exerciseId !== exerciseId) {
      continue;
    }
    for (const workoutSet of exercise.sets) {
      if (!workoutSet.isCompleted) {
        continue;
      }
      best = Math.max(best, getEstimated1RM(workoutSet.weight, workoutSet.reps));
    }
  }
  return best;
}

/** Ключ локального дня в формате YYYY-MM-DD (для сравнения «одного и того же дня»). */
function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Полное числовое значение локального полуночного начала дня (мс). */
function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Текущая серия: сколько дней подряд (включая сегодня или вчерашний день)
 * в истории есть хотя бы одна завершённая тренировка.
 * Если тренировок нет вовсе или последняя была раньше вчера — серия равна 0.
 */
export function getStreak(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) {
    return 0;
  }
  const trainingDays = new Set(sessions.map((session) => dayKey(session.date)));
  const todayStart = startOfDay(Date.now());
  const lastTrainingStart = Math.max(...sessions.map((session) => startOfDay(session.date)));

  // Серия живёт только если последняя тренировка была сегодня или вчера.
  const gapFromToday = Math.round((todayStart - lastTrainingStart) / DAY_MS);
  if (gapFromToday > 1) {
    return 0;
  }

  let streak = 0;
  // Идём назад от последнего тренировочного дня, пока дни идут подряд без пропусков.
  for (let cursor = lastTrainingStart; trainingDays.has(dayKey(cursor)); cursor -= DAY_MS) {
    streak += 1;
  }
  return streak;
}

/** Общее количество тренировок в истории. */
export function getTotalSessions(sessions: WorkoutSession[]): number {
  return sessions.length;
}

/** Форматирует тоннаж для сводки: до 1000 кг — «N кг», дальше — тонны («1.2 т»). */
export function formatVolume(volumeKg: number): string {
  if (volumeKg >= 1000) {
    const tons = Math.round((volumeKg / 1000) * 100) / 100;
    return `${tons} т`;
  }
  return `${Math.round(volumeKg)} кг`;
}
