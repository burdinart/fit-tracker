import { useMemo, useState } from 'react';
import type { Exercise, WorkoutSession } from '../types';
import { useWorkoutStore } from '../stores/workoutStore';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';
import { useRestTimer } from '../hooks/useRestTimer';
import { WorkoutHeader } from '../components/workout/WorkoutHeader';
import { ExerciseCard } from '../components/workout/ExerciseCard';
import { RestTimer } from '../components/workout/RestTimer';
import { muscleGroupLabels } from '../utils/labels';
import { formatTime } from '../utils/format';

/** Пропсы страницы тренировки. */
export interface WorkoutPageProps {
  /** Справочник упражнений (моковый или из реального источника). */
  exercises: Exercise[];
}

/**
 * Главный экран тренировки.
 * До старта — выбор упражнений из справочника и большая кнопка «Начать тренировку».
 * Во время тренировки — шапка с секундомером, карточки упражнений и таймер отдыха снизу.
 * Всё состояние берётся из workoutStore (persist — данные не теряются при перезагрузке).
 */
export function WorkoutPage({ exercises }: WorkoutPageProps) {
  // Селекторы состояния стора.
  const isWorkoutActive = useWorkoutStore((state) => state.isWorkoutActive);
  const sessionStartTime = useWorkoutStore((state) => state.sessionStartTime);
  const currentExercises = useWorkoutStore((state) => state.currentExercises);
  const isResting = useWorkoutStore((state) => state.isResting);
  const restStartedAt = useWorkoutStore((state) => state.restStartedAt);
  const restTimeLeftSec = useWorkoutStore((state) => state.restTimeLeftSec);
  const userInjuries = useWorkoutStore((state) => state.userInjuries);

  // Селекторы экшенов стора.
  const startWorkout = useWorkoutStore((state) => state.startWorkout);
  const stopWorkout = useWorkoutStore((state) => state.stopWorkout);
  const addExercise = useWorkoutStore((state) => state.addExercise);
  const removeExercise = useWorkoutStore((state) => state.removeExercise);
  const addSet = useWorkoutStore((state) => state.addSet);
  const updateSet = useWorkoutStore((state) => state.updateSet);
  const completeSet = useWorkoutStore((state) => state.completeSet);
  const adjustRestTime = useWorkoutStore((state) => state.adjustRestTime);
  const skipRest = useWorkoutStore((state) => state.skipRest);
  const toggleInjury = useWorkoutStore((state) => state.toggleInjury);

  // Секундомер тренировки и таймер отдыха (оба считаются от Date.now()-меток).
  const elapsedSec = useWorkoutTimer(sessionStartTime, isWorkoutActive);
  const { remainingSec, isFinished } = useRestTimer(restStartedAt, restTimeLeftSec, isResting);

  // Быстрый доступ к справочнику по id упражнения.
  const exerciseById = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const exercise of exercises) {
      map.set(exercise.id, exercise);
    }
    return map;
  }, [exercises]);

  /** Список id упражнений, уже добавленных в текущую сессию. */
  const addedIds = new Set(currentExercises.map((e) => e.exerciseId));

  /** Итог последней завершённой сессии (живёт только до перезагрузки — локальное состояние страницы). */
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);

  /** Завершает тренировку и показывает итог на экране выбора. */
  const handleEndWorkout = (): void => {
    const session = stopWorkout();
    setLastSession(session);
  };

  // --- Экран выбора упражнений (тренировка ещё не начата) ---
  if (!isWorkoutActive) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100">
        <header className="border-b border-slate-800 px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">FitTracker</h1>
          <p className="mt-1 text-sm text-slate-400">Выберите упражнения и начните тренировку</p>
        </header>

        <section className="mx-auto max-w-lg px-4 py-6">
          {/* Итог только что завершённой тренировки */}
          {lastSession !== null && (
            <div className="mb-4 rounded-xl border border-emerald-700 bg-emerald-900/30 px-4 py-3">
              <p className="font-semibold text-emerald-300">Тренировка завершена 🎉</p>
              <p className="mt-1 text-sm text-slate-300">
                Длительность: {formatTime(lastSession.durationSec)} · Подходов выполнено:{' '}
                {lastSession.exercises.reduce(
                  (total, workoutExercise) =>
                    total +
                    workoutExercise.sets.filter((workoutSet) => workoutSet.isCompleted).length,
                  0,
                )}
              </p>
            </div>
          )}

          {/* Переключатель травм: влияет на подсветку небезопасных упражнений */}
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                { type: 'shoulder' as const, label: 'Травма плеча' },
                { type: 'knee' as const, label: 'Травма колена' },
                { type: 'lowerBack' as const, label: 'Травма поясницы' },
              ]
            ).map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleInjury(type)}
                aria-pressed={userInjuries[type]}
                className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition ${
                  userInjuries[type]
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Список справочника с кнопкой добавления */}
          <ul className="space-y-2 pb-32">
            {exercises.map((exercise) => {
              const isAdded = addedIds.has(exercise.id);
              const isUnsafe =
                (userInjuries.shoulder && !exercise.isShoulderSafe) ||
                (userInjuries.knee && !exercise.isKneeSafe) ||
                (userInjuries.lowerBack && !exercise.isLowerBackSafe);
              return (
                <li
                  key={exercise.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border bg-slate-800 px-4 py-3 ${
                    isUnsafe ? 'border-rose-500/60' : 'border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {isUnsafe && <span aria-hidden="true">⚠️ </span>}
                      {exercise.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {muscleGroupLabels[exercise.muscleGroup]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addExercise(exercise.id)}
                    disabled={isAdded}
                    className="min-h-[56px] min-w-[56px] shrink-0 rounded-xl text-2xl font-bold transition active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100 ml-2 bg-emerald-700 text-white hover:bg-emerald-600"
                    aria-label={`Добавить ${exercise.name} в тренировку`}
                  >
                    {isAdded ? '✓' : '+'}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Большая фиксированная кнопка старта */}
          <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-900/95 px-4 py-4 backdrop-blur">
            <div className="mx-auto max-w-lg">
              <button
                type="button"
                onClick={startWorkout}
                className="min-h-[56px] w-full rounded-xl bg-emerald-600 text-xl font-bold text-white transition hover:bg-emerald-500 active:scale-[0.99]"
              >
                Начать тренировку{addedIds.size > 0 ? ` (${addedIds.size})` : ''}
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // --- Экран активной тренировки ---
  return (
    <main className="flex min-h-screen flex-col bg-slate-900 text-slate-100">
      <WorkoutHeader elapsedSec={elapsedSec} onEnd={handleEndWorkout} />

      <section className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-4">
        {currentExercises.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
            Нет упражнений. Вернитесь на экран выбора и добавьте упражнения в тренировку.
          </p>
        ) : (
          currentExercises.map((workoutExercise) => {
            const exercise = exerciseById.get(workoutExercise.exerciseId);
            // Пропускаем упражнения, которых нет в справочнике (защита от устаревших данных персиста).
            if (exercise === undefined) {
              return null;
            }
            return (
              <ExerciseCard
                key={workoutExercise.exerciseId}
                exercise={exercise}
                workoutExercise={workoutExercise}
                onAddSet={addSet}
                onUpdateSet={updateSet}
                onCompleteSet={completeSet}
                onRemove={removeExercise}
                hasShoulderInjury={userInjuries.shoulder}
              />
            );
          })
        )}
      </section>

      {/* Таймер отдыха появляется внизу экрана после завершения подхода */}
      {isResting && (
        <RestTimer
          remainingSec={remainingSec}
          isFinished={isFinished}
          onSkip={skipRest}
          onAdjust={adjustRestTime}
        />
      )}
    </main>
  );
}
