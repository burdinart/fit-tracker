import type { WorkoutSession, WorkoutSet } from '../types';

/**
 * Сервис умной прогрессии нагрузки.
 * Все функции чистые и работают с локальными данными (historyStore),
 * не обращаясь к Supabase.
 */

/** Формула Эпли для расчёта 1ПМ: вес × (1 + повторы / 30). Округление до кг. */
export function calculate1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
    return 0;
  }
  if (reps === 1) {
    return weight;
  }
  return Math.round(weight * (1 + reps / 30));
}

/** Общий объём (тоннаж, кг) по списку подходов: только выполненные (isCompleted). */
export function calculateVolume(sets: WorkoutSet[]): number {
  return sets
    .filter((workoutSet) => workoutSet.isCompleted)
    .reduce((sum, workoutSet) => sum + workoutSet.weight * workoutSet.reps, 0);
}

/** Тренд прогресса упражнения по последним тренировкам. */
export type ProgressTrend = 'up' | 'down' | 'stable';

/** Результат анализа прогрессии для одного упражнения. */
export interface ProgressionAnalysis {
  /** Рекомендуемый вес на следующую тренировку (кг), 0 — если данных нет. */
  recommendedWeight: number;
  /** Последний рабочий вес (кг) среди выполненных подходов. */
  lastWeight: number;
  /** Повторы в подходе с последним максимальным весом. */
  lastReps: number;
  /** Тренд по объёму: рост / спад / стабильно. */
  progressTrend: ProgressTrend;
  /** Сколько тренировок попало в анализ (максимум 5). */
  sessionsAnalyzed: number;
  /** Личный рекорд по максимальному весу. */
  personalRecord: PersonalRecord;
  /** Средний объём (тоннаж, кг) на тренировку в окне анализа. */
  averageVolumePerSession: number;
}

/** Личный рекорд в упражнении. */
export interface PersonalRecord {
  /** Максимальный рабочий вес (кг). */
  weight: number;
  /** Повторы в рекордном подходе. */
  reps: number;
  /** Дата тренировки (локальная, формат DD.MM.YYYY), '' — если рекорда нет. */
  date: string;
}

/** Пустой результат анализа (нет тренировок с этим упражнением). */
function emptyAnalysis(): ProgressionAnalysis {
  return {
    recommendedWeight: 0,
    lastWeight: 0,
    lastReps: 0,
    progressTrend: 'stable',
    sessionsAnalyzed: 0,
    personalRecord: { weight: 0, reps: 0, date: '' },
    averageVolumePerSession: 0,
  };
}

/** Выполненные подходы упражнения в сессии (пустой массив, если упражнения там нет). */
function completedSetsOf(session: WorkoutSession, exerciseId: string): WorkoutSet[] {
  const sets: WorkoutSet[] = [];
  for (const exercise of session.exercises) {
    if (exercise.exerciseId === exerciseId) {
      sets.push(...exercise.sets.filter((workoutSet) => workoutSet.isCompleted));
    }
  }
  return sets;
}

/** Форматирование метки времени (мс) в локальную дату DD.MM.YYYY. */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU');
}

/**
 * Анализ прогрессии упражнения по истории тренировок (последние ≤5 тренировок
 * с этим упражнением). Рекомендация веса: +2.5 кг при восходящем тренде,
 * без изменений при стагнации/спаде.
 */
export function analyzeProgression(
  exerciseId: string,
  sessions: WorkoutSession[],
): ProgressionAnalysis {
  // Новые сверху: берём тренировки, где есть это упражнение, и сортируем по убыванию даты.
  const relevantSessions = sessions
    .filter((session) => session.exercises.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => b.date - a.date);

  if (relevantSessions.length === 0) {
    return emptyAnalysis();
  }

  // Берём последние 5 тренировок с упражнением.
  const recentSessions = relevantSessions.slice(0, 5);

  let lastWeight = 0;
  let lastReps = 0;
  let personalRecord: PersonalRecord = { weight: 0, reps: 0, date: '' };
  let totalVolume = 0;

  for (const session of recentSessions) {
    const completedSets = completedSetsOf(session, exerciseId);
    if (completedSets.length === 0) {
      continue;
    }

    // «Прошлый раз»: самый свежий максимальный вес.
    const maxSet = completedSets.reduce((best, set) => (set.weight > best.weight ? set : best));
    if (maxSet.weight > lastWeight) {
      lastWeight = maxSet.weight;
      lastReps = maxSet.reps;
    }

    // Рекорд за всё время анализа.
    for (const workoutSet of completedSets) {
      if (workoutSet.weight > personalRecord.weight) {
        personalRecord = {
          weight: workoutSet.weight,
          reps: workoutSet.reps,
          date: formatDate(session.date),
        };
      }
    }

    totalVolume += calculateVolume(completedSets);
  }

  // Тренд: сравниваем объёмы двух последних тренировок (±5% — «стабильно»).
  let progressTrend: ProgressTrend = 'stable';
  if (recentSessions.length >= 2) {
    const volLatest = calculateVolume(completedSetsOf(recentSessions[0], exerciseId));
    const volPrevious = calculateVolume(completedSetsOf(recentSessions[1], exerciseId));
    if (volLatest > volPrevious * 1.05 && volPrevious > 0) {
      progressTrend = 'up';
    } else if (volLatest < volPrevious * 0.95) {
      progressTrend = 'down';
    }
  }

  // Рекомендация: +2.5 кг только при видимом прогрессе; иначе — прежний вес.
  const recommendedWeight =
    lastWeight > 0 ? Math.round((lastWeight + (progressTrend === 'up' ? 2.5 : 0)) * 2) / 2 : 0;

  return {
    recommendedWeight,
    lastWeight,
    lastReps,
    progressTrend,
    sessionsAnalyzed: recentSessions.length,
    personalRecord,
    averageVolumePerSession: Math.round(totalVolume / recentSessions.length),
  };
}

/** Точка графика по одной тренировке упражнения. */
export interface ChartDataPoint {
  /** Дата тренировки (DD.MM), уникальна в рамках серии сессий. */
  date: string;
  /** Лучший расчётный 1ПМ (кг) в этой тренировке. */
  oneRepMax: number;
  /** Объём (тоннаж, кг) упражнения в этой тренировке. */
  volume: number;
}

/**
 * Подготовка данных для графиков детальной статистики упражнения:
 * по каждой тренировке — лучший расчётный 1ПМ и объём, хронологически слева направо.
 */
export function prepareExerciseChartData(
  exerciseId: string,
  sessions: WorkoutSession[],
): ChartDataPoint[] {
  return sessions
    .filter((session) => session.exercises.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => a.date - b.date)
    .map((session) => {
      const completedSets = completedSetsOf(session, exerciseId);
      const max1RM = completedSets.reduce(
        (max, workoutSet) => Math.max(max, calculate1RM(workoutSet.weight, workoutSet.reps)),
        0,
      );
      return {
        date: new Date(session.date).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
        }),
        oneRepMax: max1RM,
        volume: calculateVolume(completedSets),
      };
    });
}
