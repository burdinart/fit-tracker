import { supabase, type WorkoutSessionRow, type WorkoutSetRow } from '../lib/supabase';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

/**
 * Сервис данных для страницы статистики (ШАГ 5).
 * Загружает все workout_sessions и workout_sets пользователя из Supabase
 * и собирает их в доменные объекты WorkoutSession, совместимые с utils/analytics.
 * При недоступности облака страница использует локальную историю (historyStore) —
 * для этого предусмотрен фолбэк-режим convertLocalSessions.
 */

/** Сводные данные, необходимые для построения графиков статистики. */
export interface StatsData {
  /** Все завершённые сессии пользователя (хронологически, от старых к новым). */
  sessions: WorkoutSession[];
  /** Источник данных: 'cloud' — Supabase, 'local' — локальная история (фолбэк). */
  source: 'cloud' | 'local';
}

/** Конвертирует строку workout_sets в доменный WorkoutSet. */
function toWorkoutSet(row: WorkoutSetRow): WorkoutSet {
  return {
    id: row.id,
    weight: row.weight,
    reps: row.reps,
    rpe: row.rpe ?? undefined,
    restTimeSec: row.rest_time_sec,
    isCompleted: row.is_completed,
  };
}

/**
 * Группирует плоские строки подходов по сессиям и упражнениям,
 * собирая доменные WorkoutSession (структура, ожидаемая аналитикой utils/analytics).
 * @param sessionRows - строки таблицы workout_sessions пользователя
 * @param setRows - строки таблицы workout_sets этих сессий
 */
export function buildSessionsFromRows(
  sessionRows: WorkoutSessionRow[],
  setRows: WorkoutSetRow[],
): WorkoutSession[] {
  // 1) Подходы по сессиям.
  const setsBySession = new Map<string, WorkoutSetRow[]>();
  for (const row of setRows) {
    const bucket = setsBySession.get(row.session_id);
    if (bucket === undefined) {
      setsBySession.set(row.session_id, [row]);
    } else {
      bucket.push(row);
    }
  }

  // 2) Внутри сессии группируем подходы по упражнениям (в порядке поля order).
  const sessions: WorkoutSession[] = sessionRows.map((sessionRow) => {
    const rows = (setsBySession.get(sessionRow.id) ?? []).slice().sort((a, b) => a.order - b.order);
    const exercisesByRef = new Map<string, WorkoutSetRow[]>();
    for (const row of rows) {
      const key = row.exercise_id ?? '__unknown__';
      const bucket = exercisesByRef.get(key);
      if (bucket === undefined) {
        exercisesByRef.set(key, [row]);
      } else {
        bucket.push(row);
      }
    }
    const exercises: WorkoutExercise[] = [];
    for (const [key, groupRows] of exercisesByRef) {
      if (key === '__unknown__') {
        continue; // Подходы без привязки к упражнению в статистике не участвуют.
      }
      exercises.push({
        exerciseId: key,
        sets: groupRows.map(toWorkoutSet),
      });
    }
    return {
      id: sessionRow.id,
      date: new Date(sessionRow.started_at).getTime(),
      durationSec: sessionRow.duration_sec,
      completed: sessionRow.completed,
      exercises,
    };
  });

  // Хронологический порядок (слева направо на графиках).
  return sessions.sort((a, b) => a.date - b.date);
}

/**
 * Загружает все сессии и подходы пользователя из Supabase (RLS ограничивает
 * выборку строками текущего auth.uid()). Бросает исключение при ошибке сети/БД —
 * страница показывает состояние ошибки / фолбэк на локальную историю.
 */
export async function fetchStatsData(userId: string): Promise<StatsData> {
  const { data: sessionRows, error: sessionsError } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: true });
  if (sessionsError !== null) {
    throw sessionsError;
  }

  const { data: setRows, error: setsError } = await supabase.from('workout_sets').select('*');
  if (setsError !== null) {
    throw setsError;
  }

  const sessions = buildSessionsFromRows(sessionRows ?? [], setRows ?? []);
  return { sessions, source: 'cloud' };
}
