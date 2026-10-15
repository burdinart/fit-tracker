import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

/**
 * Zustand store истории завершённых тренировок.
 * Состояние сохраняется в localStorage (ключ 'fit-tracker-history'),
 * поэтому история переживает перезагрузку страницы.
 * Записи добавляет WorkoutPage при завершении тренировки (stopWorkout → addSession).
 */

/** Состояние и экшены истории тренировок. */
export interface HistoryState {
  /** Завершённые тренировочные сессии. */
  sessions: WorkoutSession[];
  /**
   * Добавляет сессию в историю.
   * Если session.durationSec не задан (0/undefined), длительность вычисляется
   * автоматически как разница между временем завершения и датой начала.
   */
  addSession: (session: WorkoutSession) => void;
  /** Удаляет запись истории по id сессии. */
  deleteSession: (sessionId: string) => void;
}

/** Store истории с персистом в localStorage под ключом 'fit-tracker-history'. */
export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      sessions: [],

      addSession: (session) => {
        // Авто-расчёт durationSec: если готовая сессия пришла без длительности,
        // считаем её от метки начала до текущего момента (защита от отрицательных значений).
        const durationSec =
          session.durationSec > 0
            ? session.durationSec
            : Math.max(0, Math.floor((Date.now() - session.date) / 1000));
        const normalized: WorkoutSession = { ...session, durationSec, completed: true };
        set((state) => ({
          // Защита от дублей: та же сессия (по id) не должна попадать в историю дважды.
          sessions: [normalized, ...state.sessions.filter((s) => s.id !== normalized.id)],
        }));
      },

      deleteSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== sessionId),
        }));
      },
    }),
    {
      name: 'fit-tracker-history',
    },
  ),
);

/**
 * Возвращает сессии в диапазоне дат [fromTs, toTs] включительно,
 * отсортированные по дате (новые сверху — тот же порядок, что в HistoryPage).
 * Функциональный селектор: вызывается как
 * getSessionsByDateRange(useHistoryStore.getState().sessions, from, to).
 */
export function getSessionsByDateRange(
  sessions: WorkoutSession[],
  fromTs: number,
  toTs: number,
): WorkoutSession[] {
  return sessions
    .filter((session) => session.date >= fromTs && session.date <= toTs)
    .sort((a, b) => b.date - a.date);
}

/** Количество выполненных (отмеченных ✓) подходов во всех упражнениях сессии. */
export function countCompletedSets(session: WorkoutSession): number {
  return session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((workoutSet) => workoutSet.isCompleted).length,
    0,
  );
}

/** Все подходы сессии плоским списком (для аналитики детального просмотра). */
export function getAllSets(session: WorkoutSession): WorkoutSet[] {
  return session.exercises.flatMap((exercise: WorkoutExercise) => exercise.sets);
}
