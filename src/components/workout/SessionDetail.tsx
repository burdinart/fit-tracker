import type { Exercise, WorkoutSession } from '../../types';
import { getMaxEstimated1RM } from '../../utils/analytics';
import { buildExerciseIndex } from '../../utils/registry';
import { formatWeight } from '../../utils/format';
import { muscleGroupLabels } from '../../utils/labels';

/** Подсчёт выполненных подходов во всех упражнениях сессии. */
function countCompletedSets(session: WorkoutSession): number {
  return session.exercises.reduce(
    (total, workoutExercise) =>
      total + workoutExercise.sets.filter((workoutSet) => workoutSet.isCompleted).length,
    0,
  );
}

/** Пропсы детального просмотра завершённой тренировки. */
export interface SessionDetailProps {
  /** Сессия из истории. */
  session: WorkoutSession;
  /** Справочник упражнений (для названий и групп мышц). */
  exercises: Exercise[];
  /** Единицы измерения пользователя (кг/lbs) — из профиля. */
  units: 'kg' | 'lbs';
  /** Открыть детальную статистику упражнения (ШАГ 4). */
  onOpenExerciseStats?: (exerciseId: string) => void;
}

/**
 * Детальный просмотр завершённой тренировки:
 * все упражнения сессии, их подходы (вес / повторы / статус ✓)
 * и расчётный 1ПМ (максимум по формуле Эпли среди выполненных подходов упражнения).
 * Рендерится внутри модалки на HistoryPage.
 */
export function SessionDetail({ session, exercises, units, onOpenExerciseStats }: SessionDetailProps) {
  const exerciseById = buildExerciseIndex(exercises);

  return (
    <div className="space-y-4">
      {/* Шапка сессии: дата + сводка */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
        <p className="text-sm text-slate-400">
          {new Date(session.date).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Упражнений: {session.exercises.length} · Подходов выполнено: {countCompletedSets(session)}
        </p>
      </div>

      {session.exercises.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-400">
          В этой тренировке не было упражнений.
        </p>
      )}

      {/* Карточки упражнений с подходами и расчётным 1ПМ */}
      {session.exercises.map((workoutExercise) => {
        const exercise = exerciseById.get(workoutExercise.exerciseId);
        const best1RM = getMaxEstimated1RM(session, workoutExercise.exerciseId);
        return (
          <article
            key={workoutExercise.exerciseId}
            className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"
          >
            <header className="mb-2 flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <h4 className="truncate font-semibold">
                  {exercise?.name ?? workoutExercise.exerciseId}
                </h4>
                {exercise !== undefined && (
                  <p className="text-xs text-slate-400">{muscleGroupLabels[exercise.muscleGroup]}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {/* Ссылка на детальную статистику упражнения (ШАГ 4) */}
                {onOpenExerciseStats !== undefined && (
                  <button
                    type="button"
                    onClick={() => onOpenExerciseStats(workoutExercise.exerciseId)}
                    className="rounded-lg px-1.5 py-1 text-base text-slate-400 transition hover:bg-slate-700 hover:text-emerald-600 dark:text-emerald-400"
                    aria-label={`Статистика упражнения ${exercise?.name ?? workoutExercise.exerciseId}`}
                    title="Статистика"
                  >
                    📊
                  </button>
                )}
                {/* Расчётный 1ПМ упражнения в этой тренировке */}
                <p className="rounded-lg bg-indigo-950/80 px-2.5 py-1 text-right text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  1ПМ ≈ {best1RM > 0 ? formatWeight(best1RM, units) : '—'}
                </p>
              </div>
            </header>

            <ul className="divide-y divide-slate-800 text-sm">
              {workoutExercise.sets.map((workoutSet, index) => (
                <li
                  key={workoutSet.id}
                  className="flex items-center justify-between py-1.5 tabular-nums"
                >
                  <span className="text-slate-400">Подход {index + 1}</span>
                  <span className={workoutSet.isCompleted ? 'text-slate-100' : 'text-slate-500 line-through'}>
                    {formatWeight(workoutSet.weight, units)} × {workoutSet.reps}
                    {workoutSet.rpe !== undefined && (
                      <span className="ml-2 text-xs text-slate-500">RPE {workoutSet.rpe}</span>
                    )}
                    {workoutSet.isCompleted && <span className="ml-2 text-emerald-600 dark:text-emerald-400">✓</span>}
                  </span>
                </li>
              ))}
            </ul>

            {workoutExercise.notes !== undefined && workoutExercise.notes !== '' && (
              <p className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs italic text-slate-400">
                📝 {workoutExercise.notes}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
