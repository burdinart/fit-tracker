/**
 * Реестр упражнений — единая точка поиска упражнения по id.
 * Убирает дублирование Map-индексов в WorkoutPage / HistoryPage / ExerciseCard.
 */
import type { Exercise } from '../types';

/** Строит индекс «id → упражнение» по справочнику (O(n) один раз, далее поиск O(1)). */
export function buildExerciseIndex(exercises: Exercise[]): Map<string, Exercise> {
  const map = new Map<string, Exercise>();
  for (const exercise of exercises) {
    map.set(exercise.id, exercise);
  }
  return map;
}

/** Возвращает упражнение по id или undefined, если справочник не содержит такой id. */
export function findExercise(
  index: Map<string, Exercise>,
  exerciseId: string,
): Exercise | undefined {
  return index.get(exerciseId);
}

/** Название упражнения по id с безопасным фолбэком для удалённых из справочника позиций. */
export function exerciseNameOrFallback(
  index: Map<string, Exercise>,
  exerciseId: string,
  fallback = 'Упражнение',
): string {
  return index.get(exerciseId)?.name ?? fallback;
}
