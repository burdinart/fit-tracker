import { supabase } from '../lib/supabase';
import type { WorkoutPlan, WorkoutPlanExercise } from '../types';
import { useAuthStore } from '../stores/authStore';

/**
 * Сервис работы с планами тренировок (workout_plans + workout_plan_exercises).
 * Все операции требуют авторизации: RLS-политики пропускают запросы только
 * с auth.uid(), поэтому пользователя «привязываем» к плану через user_id явно.
 */

/** Параметры упражнения для создания/обновления плана. */
export interface PlanExerciseInput {
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  target_weight: number;
  rest_time_sec: number;
}

/** Возвращает id текущего авторизованного пользователя или null. */
function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

/** Бросает понятную ошибку, если пользователь не авторизован (RLS всё равно запретил бы запись). */
function requireUserId(): string {
  const userId = currentUserId();
  if (userId === null) {
    throw new Error('Планы доступны только после входа в аккаунт.');
  }
  return userId;
}

/** Загружает все планы текущего пользователя (новые — первыми). */
export async function fetchUserPlans(): Promise<WorkoutPlan[]> {
  const userId = requireUserId();
  const { data, error } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Загружает план вместе с его упражнениями (join со справочником exercises). */
export async function fetchPlanWithExercises(planId: string): Promise<{
  plan: WorkoutPlan;
  exercises: WorkoutPlanExercise[];
}> {
  const { data: plan, error: planError } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (planError) throw planError;

  const { data: exercises, error: exercisesError } = await supabase
    .from('workout_plan_exercises')
    .select('*, exercise:exercises(*)')
    .eq('plan_id', planId)
    .order('order');

  if (exercisesError) throw exercisesError;

  return { plan, exercises: exercises ?? [] };
}

/**
 * Создаёт план и его упражнения одной операцией (сначала план, затем строки плана).
 * Возвращает id созданного плана.
 */
export async function createPlan(
  name: string,
  description: string,
  dayOfWeek: string | null,
  exercises: PlanExerciseInput[],
): Promise<string> {
  const userId = requireUserId();

  const { data: plan, error: planError } = await supabase
    .from('workout_plans')
    .insert({ name, description: description || null, day_of_week: dayOfWeek, user_id: userId })
    .select()
    .single();

  if (planError) throw planError;

  if (exercises.length > 0) {
    const planExercises = exercises.map((ex, index) => ({
      plan_id: plan.id,
      exercise_id: ex.exercise_id,
      order: index,
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      target_weight: ex.target_weight,
      rest_time_sec: ex.rest_time_sec,
    }));

    const { error: exercisesError } = await supabase
      .from('workout_plan_exercises')
      .insert(planExercises);

    if (exercisesError) throw exercisesError;
  }

  return plan.id;
}

/** Обновляет существующий план: метаданные + полная замена списка упражнений. */
export async function updatePlan(
  planId: string,
  name: string,
  description: string,
  dayOfWeek: string | null,
  exercises: PlanExerciseInput[],
): Promise<void> {
  const { error: planError } = await supabase
    .from('workout_plans')
    .update({ name, description: description || null, day_of_week: dayOfWeek })
    .eq('id', planId);

  if (planError) throw planError;

  // Простая стратегия «перезаписи»: удаляем старые строки, вставляем новые по порядку.
  const { error: deleteError } = await supabase
    .from('workout_plan_exercises')
    .delete()
    .eq('plan_id', planId);

  if (deleteError) throw deleteError;

  if (exercises.length > 0) {
    const planExercises = exercises.map((ex, index) => ({
      plan_id: planId,
      exercise_id: ex.exercise_id,
      order: index,
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      target_weight: ex.target_weight,
      rest_time_sec: ex.rest_time_sec,
    }));

    const { error: insertError } = await supabase
      .from('workout_plan_exercises')
      .insert(planExercises);

    if (insertError) throw insertError;
  }
}

/** Удаляет план (упражнения плана каскадно удаляются на стороне БД). */
export async function deletePlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_plans')
    .delete()
    .eq('id', planId);

  if (error) throw error;
}
