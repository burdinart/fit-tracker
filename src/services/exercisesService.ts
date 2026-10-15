import { supabase, type ExerciseRow } from '../lib/supabase';
import type { Exercise, UserInjuries } from '../types';

/**
 * Сервис справочника упражнений: чтение из Supabase (таблица exercises)
 * с конвертацией snake_case-строк БД в доменный тип Exercise.
 * При недоступности сети — фолбэк на моковые данные, чтобы приложение оставалось рабочим.
 */

/** Допустимые значения групп мышц / оборудования (валидация данных из БД). */
const muscleGroups = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio'] as const;
const equipments = ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable'] as const;

/** Конвертирует строку таблицы exercises в доменный объект Exercise. */
export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: (muscleGroups as readonly string[]).includes(row.muscle_group)
      ? (row.muscle_group as Exercise['muscleGroup'])
      : 'chest',
    equipment: (equipments as readonly string[]).includes(row.equipment)
      ? (row.equipment as Exercise['equipment'])
      : 'barbell',
    isShoulderSafe: row.is_shoulder_safe,
    isKneeSafe: row.is_knee_safe,
    isLowerBackSafe: row.is_lower_back_safe,
    alternatives: row.alternatives ?? undefined,
  };
}

/** Получает все упражнения из БД Supabase. */
export async function fetchExercises(): Promise<Exercise[]> {
  try {
    const { data, error } = await supabase.from('exercises').select('*');
    if (error) throw error;
    if (!data || data.length === 0) {
      console.warn('[exercisesService] Таблица exercises пуста — используем моковые данные.');
      return [];
    }
    return data.map(toExercise);
  } catch (error) {
    console.error('[exercisesService] Не удалось загрузить упражнения из Supabase:', error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Фильтрует упражнения по активным травмам пользователя:
 * возвращает только те, у которых соответствующий флаг безопасности не равен false.
 * Логика «безопасно/небезопасно» живёт в utils/exerciseFilter — здесь тонкая обёртка.
 */
export function getSafeExercises(
  exercises: Exercise[],
  injuries: UserInjuries,
): Exercise[] {
  return exercises.filter((exercise) => {
    if (injuries.shoulder && !exercise.isShoulderSafe) return false;
    if (injuries.knee && !exercise.isKneeSafe) return false;
    if (injuries.lowerBack && !exercise.isLowerBackSafe) return false;
    return true;
  });
}
