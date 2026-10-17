import { useEffect, useMemo, useState } from 'react';
import type { Exercise, WorkoutPlan, WorkoutSession } from '../types';
import { useWorkoutStore } from '../stores/workoutStore';
import { useHistoryStore } from '../stores/historyStore';
import { useUserStore } from '../stores/userStore';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';
import { useRestTimer } from '../hooks/useRestTimer';
import { useStartWorkoutFromPlan } from '../hooks/useStartWorkoutFromPlan';
import { fetchUserPlans } from '../services/plansService';
import { WorkoutHeader } from '../components/workout/WorkoutHeader';
import { ExerciseCard } from '../components/workout/ExerciseCard';
import { RestTimer } from '../components/workout/RestTimer';
import { InjuryWarning } from '../components/ui/InjuryWarning';
import { CreateExerciseModal } from '../components/ui/CreateExerciseModal';
import { useAuthStore } from '../stores/authStore';
import { fetchExercises } from '../services/exercisesService';
import { getSafeExercises, isExerciseSafe } from '../utils/exerciseFilter';
import { getTotalVolume, formatVolume } from '../utils/analytics';
import { buildExerciseIndex } from '../utils/registry';
import { muscleGroupLabels } from '../utils/labels';
import { formatTime } from '../utils/format';

/** Подсчёт выполненных подходов во всех упражнениях сессии (для итогов). */
function countCompletedSets(session: WorkoutSession): number {
  return session.exercises.reduce(
    (total, workoutExercise) =>
      total + workoutExercise.sets.filter((workoutSet) => workoutSet.isCompleted).length,
    0,
  );
}

/** Пропсы страницы тренировки. */
export interface WorkoutPageProps {
  /** Справочник упражнений (моковый или из реального источника). */
  exercises: Exercise[];
  /** Колбэк обновления справочника после создания пользовательского упражнения. */
  onExercisesChange: (exercises: Exercise[]) => void;
  /** Открыть детальную статистику упражнения (ШАГ 4). */
  onOpenExerciseStats?: (exerciseId: string) => void;
}

/**
 * Главный экран тренировки.
 * До старта — выбор упражнений из справочника и большая кнопка «Начать тренировку».
 * Список выбора фильтруется по травмам из профиля пользователя (userStore):
 * небезопасные упражнения скрыты, но доступны через сворачиваемую секцию
 * «Показать ограниченные» с предупреждением InjuryWarning и подтверждением добавления.
 * Во время тренировки — шапка с секундомером, карточки упражнений и таймер отдыха снизу.
 */
export function WorkoutPage({ exercises, onExercisesChange, onOpenExerciseStats }: WorkoutPageProps) {
  // Селекторы состояния стора.
  const isWorkoutActive = useWorkoutStore((state) => state.isWorkoutActive);
  const sessionStartTime = useWorkoutStore((state) => state.sessionStartTime);
  const currentExercises = useWorkoutStore((state) => state.currentExercises);
  const isResting = useWorkoutStore((state) => state.isResting);
  const restStartedAt = useWorkoutStore((state) => state.restStartedAt);
  const restTimeLeftSec = useWorkoutStore((state) => state.restTimeLeftSec);

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

  // Травмы — из профиля пользователя (источник истины: SettingsPage + persist).
  const profile = useUserStore((state) => state.profile);
  const injuries = useMemo(
    () => ({
      shoulder: profile.hasShoulderInjury,
      knee: profile.hasKneeInjury,
      lowerBack: profile.hasLowerBackInjury,
    }),
    [profile.hasShoulderInjury, profile.hasKneeInjury, profile.hasLowerBackInjury],
  );

  // Секундомер тренировки и таймер отдыха (оба считаются от Date.now()-меток).
  const elapsedSec = useWorkoutTimer(sessionStartTime, isWorkoutActive);
  const { remainingSec, isFinished } = useRestTimer(restStartedAt, restTimeLeftSec, isResting);

  // Быстрый доступ к справочнику по id упражнения (общий индекс — utils/registry).
  const exerciseById = useMemo(() => buildExerciseIndex(exercises), [exercises]);

  /** Разделение справочника на безопасные и ограниченные травмы-фильтром. */
  const { safe, unsafe } = useMemo(() => getSafeExercises(exercises, injuries), [exercises, injuries]);

  /** Список id упражнений, уже добавленных в текущую сессию. */
  const addedIds = new Set(currentExercises.map((e) => e.exerciseId));

  /** Итог последней завершённой сессии (живёт только до перезагрузки — локальное состояние страницы). */
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  /** Показана ли модалка итогов завершённой тренировки. */
  const [showSummary, setShowSummary] = useState(false);
  /** Развёрнута ли секция с ограниченными (небезопасными) упражнениями. */
  const [showRestricted, setShowRestricted] = useState(false);
  /** Какое упражнение требует подтверждения добавления (открыт InjuryWarning-модал). */
  const [pendingUnsafe, setPendingUnsafe] = useState<string | null>(null);
  /** Открыта ли модалка создания пользовательского упражнения (ШАГ 4). */
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Планы тренировок для секции быстрого старта (ШАГ 6).
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const { startFromPlan, startingPlanId, error: planStartError } = useStartWorkoutFromPlan();

  // Загрузка планов при открытии экрана выбора упражнений.
  useEffect(() => {
    if (isWorkoutActive) return;
    let cancelled = false;
    fetchUserPlans()
      .then((loaded) => {
        if (!cancelled) setPlans(loaded);
      })
      .catch((error: unknown) => {
        console.warn('[WorkoutPage] Не удалось загрузить планы:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [isWorkoutActive]);

  /** Обновлённый справочник после создания упражнения — поднимаем в App через пропс. */
  const refreshExercises = (): void => {
    setShowCreateModal(false);
    void fetchExercises()
      .then((rows) => {
        if (rows.length > 0) onExercisesChange(rows);
      })
      .catch((error) => {
        console.warn('[WorkoutPage] Не удалось обновить справочник упражнений:', error);
      });
  };

  /** Завершает тренировку: stopWorkout() → сохранение в историю → облако → модалка с итогами. */
  const handleEndWorkout = (): void => {
    const session = stopWorkout();
    // Сохраняем завершённую сессию в историю (persist 'fit-tracker-history').
    useHistoryStore.getState().addSession(session);
    // Синхронизируем с Supabase (при отсутствии сети/ошибке — данные уйдут в очередь syncQueue).
    void useWorkoutStore.getState().syncSessionToCloud(session);
    setLastSession(session);
    setShowSummary(true);
  };

  /** Кнопка «+»: безопасные добавляем сразу, для опасных — открываем предупреждение. */
  const handleAddAttempt = (exerciseId: string): void => {
    const exercise = exerciseById.get(exerciseId);
    if (exercise === undefined) {
      return;
    }
    if (isExerciseSafe(exercise, injuries)) {
      addExercise(exerciseId);
      return;
    }
    // Пользователь явно пытается добавить небезопасное упражнение — просим подтверждение.
    setPendingUnsafe(exerciseId);
  };

  /** Подтверждение добавления небезопасного упражнения. */
  const confirmPendingAdd = (): void => {
    if (pendingUnsafe !== null) {
      addExercise(pendingUnsafe);
      setPendingUnsafe(null);
    }
  };

  const pendingExercise =
    pendingUnsafe !== null ? exerciseById.get(pendingUnsafe) : undefined;

  // --- Экран выбора упражнений (тренировка ещё не начата) ---
  if (!isWorkoutActive) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100">
        <header className="border-b border-slate-800 px-4 py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">FitTracker</h1>
              <p className="mt-1 text-sm text-slate-400">Выберите упражнения и начните тренировку</p>
            </div>
            {/* Кнопка выхода из аккаунта (Supabase Auth) */}
            <button
              type="button"
              onClick={() => void useAuthStore.getState().signOut()}
              className="shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              Выйти
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-lg px-4 py-6">
          {/* Баннер на экране выбора: тренировка уже сохранена в историю */}
          {lastSession !== null && (
            <div className="mb-4 rounded-xl border border-emerald-700 bg-emerald-900/30 px-4 py-3">
              <p className="font-semibold text-emerald-300">
                Тренировка завершена 🎉 — сохранена в историю
              </p>
              <button
                type="button"
                onClick={() => setShowSummary(true)}
                className="mt-1 text-sm font-medium text-emerald-400 underline-offset-2 hover:underline"
              >
                Показать итоги
              </button>
            </div>
          )}

          {/* Ограничения взяты из настроек профиля */}
          {(injuries.shoulder || injuries.knee || injuries.lowerBack) && (
            <p className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-xs text-slate-400">
              ⚠️ Фильтр травм активен — измените ограничения во вкладке «Настройки»
            </p>
          )}

          {/* Секция «Мои планы»: быстрый старт тренировки по сохранённому плану (ШАГ 6) */}
          {plans.length > 0 && (
            <div className="mb-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Мои планы
              </h2>
              {planStartError !== null && (
                <p className="mb-2 rounded-xl border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
                  {planStartError}
                </p>
              )}
              <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
                {plans.map((plan) => (
                  <li
                    key={plan.id}
                    className="w-64 shrink-0 snap-start rounded-xl border border-slate-700 bg-slate-800 p-3"
                  >
                    <p className="truncate font-semibold">{plan.name}</p>
                    {plan.description != null && plan.description !== '' && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{plan.description}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => void startFromPlan(plan.id)}
                      disabled={startingPlanId !== null}
                      className="mt-2 min-h-[44px] w-full rounded-lg bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50"
                    >
                      {startingPlanId === plan.id ? 'Загрузка…' : '▶ Начать'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Список безопасных упражнений */}
          <ul className="space-y-2">
            {safe.map((exercise) => {
              const isAdded = addedIds.has(exercise.id);
              return (
                <li
                  key={exercise.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{exercise.name}</p>
                    <p className="text-xs text-slate-400">
                      {muscleGroupLabels[exercise.muscleGroup]}
                    </p>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    {onOpenExerciseStats !== undefined && (
                      <button
                        type="button"
                        onClick={() => onOpenExerciseStats(exercise.id)}
                        className="min-h-[44px] min-w-[44px] rounded-lg text-lg text-slate-400 transition hover:bg-slate-700 hover:text-emerald-400"
                        aria-label={`Статистика упражнения ${exercise.name}`}
                        title="Статистика"
                      >
                        📊
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddAttempt(exercise.id)}
                      disabled={isAdded}
                      className="min-h-[56px] min-w-[56px] rounded-xl bg-emerald-700 text-2xl font-bold text-white transition hover:bg-emerald-600 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
                      aria-label={`Добавить ${exercise.name} в тренировку`}
                    >
                      {isAdded ? '✓' : '+'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Кнопка создания пользовательского упражнения (ШАГ 4) */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-3 min-h-[48px] w-full rounded-xl border border-dashed border-emerald-500/60 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-950/40"
          >
            ＋ Создать своё упражнение
          </button>

          {/* Скрытые по травмам упражнения — доступны только после подтверждения */}
          {unsafe.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowRestricted((prev) => !prev)}
                aria-expanded={showRestricted}
                className="min-h-[44px] w-full rounded-xl border border-dashed border-rose-500/50 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-950/40"
              >
                {showRestricted
                  ? 'Скрыть ограниченные упражнения'
                  : `Показать ограниченные (${unsafe.length})`}
              </button>
              {showRestricted && (
                <ul className="mt-2 space-y-2">
                  {unsafe.map(({ exercise, reasons }) => {
                    const isAdded = addedIds.has(exercise.id);
                    return (
                      <li
                        key={exercise.id}
                        className="rounded-xl border border-rose-500/60 bg-slate-800 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              <span aria-hidden="true">⚠️ </span>
                              {exercise.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {muscleGroupLabels[exercise.muscleGroup]}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddAttempt(exercise.id)}
                            disabled={isAdded}
                            className="ml-2 min-h-[56px] min-w-[56px] shrink-0 rounded-xl bg-rose-700 text-2xl font-bold text-white transition hover:bg-rose-600 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
                            aria-label={`Добавить ${exercise.name} (потребует подтверждения)`}
                          >
                            {isAdded ? '✓' : '+'}
                          </button>
                        </div>
                        <div className="mt-2">
                          <InjuryWarning exercise={exercise} injuries={injuries} allExercises={exercises} />
                        </div>
                        {/* Причина в data-атрибуте не нужна — reasons уже в тексте плашки;
                            оставляем переменную задействованной для aria-описания строки */}
                        <span className="sr-only" id={`unsafe-${exercise.id}`}>
                          Небезопасно при травме: {reasons.join(', ')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="pb-32" />

          {/* Большая фиксированная кнопка старта */}
          <div className="fixed inset-x-0 bottom-14 border-t border-slate-800 bg-slate-900/95 px-4 py-4 backdrop-blur">
            <div className="mx-auto max-w-lg">
              {addedIds.size === 0 && (
                <p className="mb-2 text-center text-sm text-amber-400">
                  Сначала добавьте упражнения кнопкой «+»
                </p>
              )}
              <button
                type="button"
                onClick={startWorkout}
                disabled={addedIds.size === 0}
                className="min-h-[56px] w-full rounded-xl bg-emerald-600 text-xl font-bold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
              >
                Начать тренировку{addedIds.size > 0 ? ` (${addedIds.size})` : ''}
              </button>
            </div>
          </div>
        </section>

        {/* Модалка итогов завершённой тренировки (длительность, объём, подходы) */}
      {showSummary && lastSession !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setShowSummary(false)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="summary-title" className="text-xl font-bold">
              Тренировка завершена 🎉
            </h2>
            <p className="text-sm text-slate-400">Итоги сохранены в историю</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-900/70 p-3">
                <p className="text-lg font-bold tabular-nums text-emerald-400">
                  {formatTime(lastSession.durationSec)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">Длительность</p>
              </div>
              <div className="rounded-xl bg-slate-900/70 p-3">
                <p className="text-lg font-bold tabular-nums text-indigo-300">
                  {formatVolume(getTotalVolume([lastSession]))}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">Объём</p>
              </div>
              <div className="rounded-xl bg-slate-900/70 p-3">
                <p className="text-lg font-bold tabular-nums text-amber-400">
                  {countCompletedSets(lastSession)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">Подходов</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSummary(false)}
              className="min-h-[48px] w-full rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-500"
            >
              Отлично
            </button>
          </div>
        </div>
      )}

      {/* Модал подтверждения добавления небезопасного упражнения */}
        {pendingExercise !== undefined && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsafe-confirm-title"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => setPendingUnsafe(null)}
          >
            <div
              className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="unsafe-confirm-title" className="text-lg font-bold">
                Добавить «{pendingExercise.name}»?
              </h2>
              <InjuryWarning
                exercise={pendingExercise}
                injuries={injuries}
                allExercises={exercises}
              />
              <p className="text-sm text-slate-400">
                Это упражнение небезопасно при ваших ограничениях. Вы можете добавить его вручную,
                взяв ответственность на себя.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingUnsafe(null)}
                  className="min-h-[48px] flex-1 rounded-xl border border-slate-600 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={confirmPendingAdd}
                  className="min-h-[48px] flex-1 rounded-xl bg-rose-600 text-sm font-bold text-white transition hover:bg-rose-500"
                >
                  Всё равно добавить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Модалка создания пользовательского упражнения (ШАГ 4) */}
        {showCreateModal && (
          <CreateExerciseModal
            onClose={() => setShowCreateModal(false)}
            onCreated={refreshExercises}
          />
        )}
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
                userInjuries={injuries}
                allExercises={exercises}
                onOpenStats={onOpenExerciseStats}
              />
            );
          })
        )}
      </section>

      {/* Отступ, чтобы последний подход не перекрывался фиксированным таймером отдыха */}
      {isResting && <div className="h-64 shrink-0" aria-hidden="true" />}

      {/* Таймер отдыха — фиксированная плашка внизу экрана, активна после завершения подхода */}
      <RestTimer
        timeLeft={remainingSec}
        isActive={isResting}
        isFinished={isFinished}
        onSkip={skipRest}
        onAdjust={adjustRestTime}
      />
    </main>
  );
}
