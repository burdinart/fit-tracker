import { useState } from 'react';
import { mockExercises } from './data/mockExercises';
import { useWorkoutStore } from './stores/workoutStore';
import { useWorkoutTimer } from './hooks/useWorkoutTimer';
import { useRestTimer } from './hooks/useRestTimer';
import { formatTime } from './utils/format';
import { muscleGroupLabels } from './utils/labels';
import type { WorkoutSession } from './types';

/**
 * Стартовый экран FitTracker (тёмная тема).
 * Содержит панель управления активной тренировкой (стор workoutStore + таймеры)
 * и справочник моковых упражнений: название и группа мышц.
 * В дальнейшем будет заменён на роутинг по страницам (src/pages).
 */
function App() {
  // Селекторы из Zustand store активной тренировки (состояние переживает перезагрузку).
  const isWorkoutActive = useWorkoutStore((state) => state.isWorkoutActive);
  const sessionStartTime = useWorkoutStore((state) => state.sessionStartTime);
  const isResting = useWorkoutStore((state) => state.isResting);
  const restStartedAt = useWorkoutStore((state) => state.restStartedAt);
  const restTimeLeftSec = useWorkoutStore((state) => state.restTimeLeftSec);
  const defaultRestTime = useWorkoutStore((state) => state.defaultRestTime);
  const startWorkout = useWorkoutStore((state) => state.startWorkout);
  const stopWorkout = useWorkoutStore((state) => state.stopWorkout);
  const skipRest = useWorkoutStore((state) => state.skipRest);
  const adjustRestTime = useWorkoutStore((state) => state.adjustRestTime);

  // Секундомер тренировки: считается от Date.now() - sessionStartTime.
  const elapsedSec = useWorkoutTimer(sessionStartTime, isWorkoutActive);
  // Таймер отдыха между подходами с вибрацией по окончании.
  const { remainingSec, isFinished } = useRestTimer(restStartedAt, restTimeLeftSec, isResting);

  /** Последняя завершённая сессия (для показа итога на экране). */
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);

  /** Завершает тренировку и сохраняет возвращённую сессию для отображения итога. */
  const handleStopWorkout = (): void => {
    const session = stopWorkout();
    setLastSession(session);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">FitTracker</h1>
        <p className="mt-1 text-sm text-slate-400">
          Силовые тренировки с учётом ограничений
        </p>
      </header>

      {/* Панель активной тренировки */}
      <section className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {isWorkoutActive ? 'Тренировка идёт' : 'Тренировка не начата'}
            </h2>
            <span className="font-mono text-2xl tabular-nums text-emerald-400">
              {formatTime(elapsedSec)}
            </span>
          </div>

          <div className="mt-4 flex gap-3">
            {isWorkoutActive ? (
              <button
                type="button"
                onClick={handleStopWorkout}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 font-medium text-white transition hover:bg-rose-500 active:scale-[0.98]"
              >
                Завершить
              </button>
            ) : (
              <button
                type="button"
                onClick={startWorkout}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500 active:scale-[0.98]"
              >
                Начать тренировку
              </button>
            )}
          </div>

          {/* Индикатор отдыха, активен только во время паузы между подходами */}
          {isWorkoutActive && isResting && (
            <div className="mt-4 rounded-lg bg-slate-700/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  {isFinished ? 'Отдых завершён!' : 'Отдых'}
                </span>
                <span className="font-mono text-xl tabular-nums text-amber-400">
                  {formatTime(remainingSec)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustRestTime(-15)}
                  className="rounded bg-slate-600 px-3 py-1 text-sm transition hover:bg-slate-500"
                  aria-label="Уменьшить отдых на 15 секунд"
                >
                  −15с
                </button>
                <span className="text-sm text-slate-400">по умолчанию: {defaultRestTime}с</span>
                <button
                  type="button"
                  onClick={() => adjustRestTime(15)}
                  className="rounded bg-slate-600 px-3 py-1 text-sm transition hover:bg-slate-500"
                  aria-label="Увеличить отдых на 15 секунд"
                >
                  +15с
                </button>
                <button
                  type="button"
                  onClick={skipRest}
                  className="ml-auto rounded bg-slate-600 px-3 py-1 text-sm transition hover:bg-slate-500"
                >
                  Пропустить
                </button>
              </div>
            </div>
          )}

          {/* Итог последней завершённой тренировки */}
          {lastSession !== null && !isWorkoutActive && (
            <p className="mt-3 text-sm text-slate-400">
              Последняя тренировка: {formatTime(lastSession.durationSec)}, подходов выполнено:{' '}
              {lastSession.exercises.reduce(
                (total, exercise) =>
                  total + exercise.sets.filter((workoutSet) => workoutSet.isCompleted).length,
                0,
              )}
            </p>
          )}
        </div>
      </section>

      {/* Справочник упражнений */}
      <section className="mx-auto max-w-lg px-4 pb-8">
        <h2 className="mb-3 text-lg font-semibold">Справочник упражнений</h2>
        <ul className="space-y-2">
          {mockExercises.map((exercise) => (
            <li
              key={exercise.id}
              className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3 shadow-sm"
            >
              <span className="font-medium">{exercise.name}</span>
              <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">
                {muscleGroupLabels[exercise.muscleGroup]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default App;
