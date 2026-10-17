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
    createdBy: row.created_by ?? null,
    isCustom: row.is_custom ?? false,
    displayOrder: row.display_order ?? undefined,
  };
}

/** Получает все упражнения из БД Supabase (базовые справочника + пользовательские). */
export async function fetchExercises(): Promise<Exercise[]> {
  try {
    // select('*') возвращает и системные (created_by = null), и кастомные упражнения.
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
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
 * Удаляет пользовательское упражнение из глобальной базы Supabase.
 * RLS-политика «Users can delete own custom exercises» разрешает удаление
 * только строк, где created_by === auth.uid() — базовые упражнения удалить нельзя.
 */
export async function deleteCustomExercise(exerciseId: string): Promise<void> {
  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', exerciseId);

  if (error) {
    console.error('Ошибка при удалении упражнения:', error);
    throw new Error(
      'Не удалось удалить упражнение. Возможно, у вас нет прав или это базовое упражнение.',
    );
  }
}

/** Поля пользовательского упражнения, доступные для редактирования (snake_case — колонки БД). */
export interface ExerciseUpdates {
  name?: string;
  muscle_group?: string;
  equipment?: string;
  is_shoulder_safe?: boolean;
  is_knee_safe?: boolean;
  is_lower_back_safe?: boolean;
}

/**
 * Обновляет пользовательское упражнение в глобальной базе Supabase.
 * RLS-политика «Users can update own custom exercises» разрешает UPDATE
 * только строк, где created_by === auth.uid() — базовые упражнения защищены на уровне базы.
 */
export async function updateCustomExercise(
  exerciseId: string,
  updates: ExerciseUpdates,
): Promise<void> {
  const { error } = await supabase
    .from('exercises')
    .update(updates)
    .eq('id', exerciseId);

  if (error) {
    console.error('Ошибка при обновлении упражнения:', error);
    throw new Error(
      'Не удалось обновить упражнение. Возможно, у вас нет прав или это базовое упражнение.',
    );
  }
}

/**
 * Сохраняет новый порядок упражнений (drag-and-drop) в БД.
 * Обновляет display_order для каждого id по его позиции в массиве.
 * Записи отправляются батчем одним запросом.
 */
export async function updateExerciseOrder(exerciseIds: string[]): Promise<void> {
  if (exerciseIds.length === 0) return;

  // RLS разрешает UPDATE только своих кастомных упражнений, поэтому обновляем
  // только их — базовые упражнения справочника остаются на исходных позициях.
  const { error } = await supabase.rpc('update_exercises_order', {
    exercise_ids: exerciseIds,
  });

  if (!error) return;

  // Фолбэк без хранимой функции: батч UPDATE по каждому своему упражнению.
  console.warn('[exercisesService] RPC недоступна, сохраняем порядок поштучно:', error);
  for (let index = 0; index < exerciseIds.length; index += 1) {
    const { error: rowError } = await supabase
      .from('exercises')
      .update({ display_order: index })
      .eq('id', exerciseIds[index])
      .eq('is_custom', true);
    if (rowError) {
      console.error('Ошибка при сохранении порядка упражнений:', rowError);
      throw new Error('Не удалось сохранить порядок упражнений.');
    }
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
