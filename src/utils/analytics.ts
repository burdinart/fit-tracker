import type { Exercise, MuscleGroup, WorkoutSession, WorkoutSet } from '../types';

/**
 * Аналитика тренировок: объём, прогресс по упражнениям,
 * расчётный одноповторный максимум (1ПМ) и серия дней подряд.
 * Все функции чистые — работают с массивом сессий из historyStore.
 */

/** Тоннаж одного подхода: вес (кг) × повторы. Незавершённые подходы не считаются. */
function setVolume(weight: number, reps: number): number {
  return weight * reps;
}

/* ------------------------------------------------------------------ */
/*  Базовые аналитические функции (по списку подходов).                */
/* ------------------------------------------------------------------ */

/**
 * Расчётный одноповторный максимум (1ПМ) по формуле Эпли:
 * 1RM = вес × (1 + повторы / 30). При одном повторе 1ПМ равен рабочему весу.
 * Некорректные значения (вес/повторы ≤ 0 или NaN) дают 0.
 * @param weight - рабочий вес (кг)
 * @param reps - количество повторений
 */
export function calculate1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
    return 0;
  }
  if (reps === 1) {
    return weight;
  }
  return weight * (1 + reps / 30);
}

/**
 * Общий объём (тоннаж, кг) по списку подходов:
 * сумма «вес × повторы» только для выполненных подходов (isCompleted === true).
 */
export function calculateTotalVolume(sets: WorkoutSet[]): number {
  return sets.reduce(
    (total, workoutSet) =>
      workoutSet.isCompleted ? total + setVolume(workoutSet.weight, workoutSet.reps) : total,
    0,
  );
}

/** Точка графика прогресса упражнения по дням (для LineChart в StatsPage). */
export interface ExerciseProgressPoint {
  /** Дата тренировки в формате YYYY-MM-DD (локальная). */
  date: string;
  /** Максимальный рабочий вес (кг) среди выполненных подходов этого упражнения за день. */
  maxWeight: number;
  /** Объём (тоннаж, кг) упражнения за день (сумма вес × повторы по выполненным подходам). */
  volume: number;
  /** Лучший расчётный 1ПМ (кг) за день (по формуле Эпли от лучшего подхода). */
  estimated1RM: number;
}

/**
 * Прогресс упражнения по датам для графика: группирует подходы по дням,
 * считает максимальный вес, объём и лучший расчётный 1ПМ за каждый день.
 * Учитываются только выполненные подходы; незавершённые игнорируются.
 * @param sets - плоский список подходов (id упражнения хранится в exerciseId)
 * @param exerciseId - id упражнения из справочника
 * @returns точки, отсортированные по дате (хронологически, слева направо)
 */
export function getExerciseProgress(
  sets: AnalyticsSet[],
  exerciseId: string,
): ExerciseProgressPoint[] {
  const byDay = new Map<string, { weights: number[]; volume: number; best1RM: number }>();

  for (const workoutSet of sets) {
    if (workoutSet.exerciseId !== exerciseId || !workoutSet.isCompleted) {
      continue;
    }
    // День тренировки — от даты сессии (completedAt подхода может отсутствовать).
    const dayKey = dateKeyOf(workoutSet.sessionDate);
    const bucket = byDay.get(dayKey) ?? { weights: [], volume: 0, best1RM: 0 };
    bucket.weights.push(workoutSet.weight);
    bucket.volume += setVolume(workoutSet.weight, workoutSet.reps);
    bucket.best1RM = Math.max(bucket.best1RM, calculate1RM(workoutSet.weight, workoutSet.reps));
    byDay.set(dayKey, bucket);
  }

  const points: ExerciseProgressPoint[] = [];
  for (const [date, bucket] of byDay) {
    points.push({
      date,
      maxWeight: bucket.weights.length > 0 ? Math.max(...bucket.weights) : 0,
      volume: bucket.volume,
      estimated1RM: Math.round(bucket.best1RM * 2) / 2,
    });
  }
  // Сортировка по строковому ключу YYYY-MM-DD совпадает с хронологическим порядком.
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** Подход в «аналитическом» представлении: доменный WorkoutSet + ссылки на сессию/упражнение. */
export interface AnalyticsSet extends WorkoutSet {
  /** Id тренировочной сессии, к которой относится подход. */
  sessionId: string;
  /** Id упражнения из справочника (null — если упражнение удалено/неизвестно). */
  exerciseId: string | null;
  /** Метка времени начала сессии (мс) — используется как дата тренировки. */
  sessionDate: number;
}

/**
 * Разворачивает сессии в плоский список подходов с привязкой к упражнению и дате.
 * Удобно для агрегаций по упражнениям и группам мышц на странице статистики.
 */
export function flattenSets(sessions: WorkoutSession[]): AnalyticsSet[] {
  const result: AnalyticsSet[] = [];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const workoutSet of exercise.sets) {
        result.push({
          ...workoutSet,
          sessionId: session.id,
          exerciseId: exercise.exerciseId,
          sessionDate: session.date,
        });
      }
    }
  }
  return result;
}

/** Ключ локального дня в формате YYYY-MM-DD (для сравнения «одного и того же дня»). */
export function dateKeyOf(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Точка графика «объём по группам мышц» за период (для BarChart в StatsPage). */
export interface MuscleGroupVolumePoint {
  /** Группа мышц. */
  muscleGroup: MuscleGroup;
  /** Суммарный объём (тоннаж, кг) по выполненным подходам упражнений этой группы. */
  volume: number;
}

/**
 * Объём (тоннаж) по группам мышц за последние `days` дней (по умолчанию — месяц).
 * @param sessions - все сессии истории пользователя
 * @param exerciseById - справочник упражнений (id → Exercise) для определения группы мышц
 * @param days - глубина окна в днях (отсчитывается от текущего момента назад)
 * @returns точки по всем группам мышц (включая нулевые), отсортированные по убыванию объёма
 */
export function getVolumeByMuscleGroup(
  sessions: WorkoutSession[],
  exerciseById: ReadonlyMap<string, Exercise>,
  days = 30,
): MuscleGroupVolumePoint[] {
  const sinceMs = Date.now() - days * DAY_MS;
  const totals = new Map<MuscleGroup, number>();
  for (const session of sessions) {
    if (session.date < sinceMs) {
      continue;
    }
    for (const exercise of session.exercises) {
      const reference = exerciseById.get(exercise.exerciseId);
      if (reference === undefined) {
        continue;
      }
      const volume = calculateTotalVolume(exercise.sets);
      totals.set(reference.muscleGroup, (totals.get(reference.muscleGroup) ?? 0) + volume);
    }
  }
  const allGroups: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio'];
  return allGroups
    .map((muscleGroup) => ({ muscleGroup, volume: totals.get(muscleGroup) ?? 0 }))
    .sort((a, b) => b.volume - a.volume);
}

/** Объём (тоннаж) одной сессии: сумма «вес × повторы» по выполненным подходам. */
export function getSessionVolume(session: WorkoutSession): number {
  return getTotalVolume([session]);
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
export function getExerciseVolumeProgress(
  exerciseId: string,
  sessions: WorkoutSession[],
): VolumePoint[] {
  const points: VolumePoint[] = [];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) {
        continue;
      }
      const volume = calculateTotalVolume(exercise.sets);
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
 * Расчётный одноповторный максимум по формуле Эпли (см. calculate1RM),
 * округлённый до 0.5 кг (минимальный практический шаг).
 * @param weight - рабочий вес (кг)
 * @param reps - количество повторений
 */
export function getEstimated1RM(weight: number, reps: number): number {
  const epley = calculate1RM(weight, reps);
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
  return dateKeyOf(timestamp);
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
