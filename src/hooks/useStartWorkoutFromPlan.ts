import { useCallback, useState } from 'react';
import type { WorkoutPlanExercise } from '../types';
import { useWorkoutStore } from '../stores/workoutStore';
import { fetchPlanWithExercises } from '../services/plansService';

/**
 * Хук быстрого старта тренировки по плану (ШАГ 6).
 * Загружает план с упражнениями, очищает текущий выбор, добавляет упражнения
 * плана с целевыми параметрами (target_sets/reps/weight) и запускает тренировку.
 * Возвращает функцию запуска, флаг загрузки и текст ошибки.
 */
export function useStartWorkoutFromPlan(): {
  /** Запускает тренировку по плану; возвращает true при успехе. */
  startFromPlan: (planId: string) => Promise<boolean>;
  /** Id плана, который сейчас загружается (или null). */
  startingPlanId: string | null;
  /** Текст последней ошибки (или null). */
  error: string | null;
} {
  const [startingPlanId, setStartingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startFromPlan = useCallback(async (planId: string): Promise<boolean> => {
    setStartingPlanId(planId);
    setError(null);
    try {
      const { exercises }: { exercises: WorkoutPlanExercise[] } =
        await fetchPlanWithExercises(planId);
      const store = useWorkoutStore.getState();
      // Полностью заменяем состав тренировки упражнениями из плана.
      for (const current of [...store.currentExercises]) {
        store.removeExercise(current.exerciseId);
      }
      for (const planExercise of exercises) {
        store.addExercise(planExercise.exercise_id, {
          targetSets: planExercise.target_sets,
          targetReps: planExercise.target_reps,
          targetWeight: planExercise.target_weight,
        });
      }
      store.startWorkout();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось начать тренировку по плану.');
      return false;
    } finally {
      setStartingPlanId(null);
    }
  }, []);

  return { startFromPlan, startingPlanId, error };
}
