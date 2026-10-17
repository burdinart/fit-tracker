import { useCallback, useEffect, useState } from 'react';
import type { Exercise, WorkoutPlan } from '../types';
import { fetchUserPlans, fetchPlanWithExercises, deletePlan } from '../services/plansService';
import { useStartWorkoutFromPlan } from '../hooks/useStartWorkoutFromPlan';
import { CreatePlanModal } from '../components/plans/CreatePlanModal';
import { weekDayLabels, isWeekDay } from '../utils/planLabels';

/** Пропсы страницы планов. */
export interface PlansPageProps {
  /** Справочник упражнений (нужен для модалки создания плана). */
  exercises: Exercise[];
}

/**
 * Страница управления планами тренировок (ШАГ 4):
 * список карточек «Мои планы», создание/редактирование через CreatePlanModal,
 * удаление с подтверждением и быстрый старт тренировки по плану.
 */
export function PlansPage({ exercises }: PlansPageProps) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Количество упражнений в каждом плане (id -> count), подтягиваем одним запросом на план.
  const [exerciseCounts, setExerciseCounts] = useState<Record<string, number>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkoutPlan | null>(null);

  // Быстрый старт тренировки по плану — общий хук (тот же, что на экране «Тренировка»).
  const { startFromPlan, startingPlanId, error: startError } = useStartWorkoutFromPlan();

  /** Загружает список планов и количество упражнений в них. */
  const loadPlans = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await fetchUserPlans();
      setPlans(loaded);
      // Параллельно считаем упражнения каждого плана (join уже делает fetchPlanWithExercises).
      const counts = await Promise.all(
        loaded.map(async (plan) => {
          try {
            const { exercises: planExercises } = await fetchPlanWithExercises(plan.id);
            return [plan.id, planExercises.length] as const;
          } catch {
            return [plan.id, 0] as const;
          }
        }),
      );
      setExerciseCounts(Object.fromEntries(counts));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить планы.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  /** Удаляет план после подтверждения. */
  const handleConfirmDelete = async (): Promise<void> => {
    if (pendingDelete === null) return;
    try {
      await deletePlan(pendingDelete.id);
      setPlans((prev) => prev.filter((p) => p.id !== pendingDelete.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить план.');
    } finally {
      setPendingDelete(null);
    }
  };

  const openCreate = (): void => {
    setEditingPlanId(null);
    setIsModalOpen(true);
  };

  const openEdit = (planId: string): void => {
    setEditingPlanId(planId);
    setIsModalOpen(true);
  };

  return (
    <main className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Мои планы тренировок</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Сохраняйте шаблоны и начинайте тренировку в один тап</p>
      </header>

      <section className="mx-auto max-w-lg px-4 py-6">
        {/* Кнопка создания */}
        <button
          type="button"
          onClick={openCreate}
          className="mb-4 min-h-[56px] w-full rounded-xl border border-dashed border-emerald-500/60 text-base font-semibold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-100 dark:bg-emerald-950/40 active:scale-[0.99]"
        >
          ＋ Создать новый план
        </button>

        {error !== null && (
          <p className="mb-4 rounded-xl border border-rose-500/60 bg-rose-100 dark:bg-rose-950/40 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
        {startError !== null && (
          <p className="mb-4 rounded-xl border border-rose-500/60 bg-rose-100 dark:bg-rose-950/40 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300">
            {startError}
          </p>
        )}

        {/* Состояния: загрузка / пусто / список */}
        {isLoading ? (
          <ul className="space-y-3" aria-label="Загрузка планов">
            {[0, 1, 2].map((i) => (
              <li key={i} className="animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
                <div className="h-5 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700/70" />
              </li>
            ))}
          </ul>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-10 text-center">
            <p className="text-3xl" aria-hidden="true">📋</p>
            <p className="mt-2 font-medium text-slate-700 dark:text-slate-300">У вас пока нет планов.</p>
            <p className="text-sm text-slate-500">Создайте первый!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {plans.map((plan) => {
              const count = exerciseCounts[plan.id];
              return (
                <li
                  key={plan.id}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">{plan.name}</h2>
                      {plan.description != null && plan.description !== '' && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        {count === undefined ? '…' : `${count} ${pluralExercises(count)}`}
                        {isWeekDay(plan.day_of_week) && (
                          <span className="ml-2 rounded-md bg-slate-200 dark:bg-slate-700/70 px-2 py-0.5 font-medium text-slate-700 dark:text-slate-300">
                            {weekDayLabels[plan.day_of_week]}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Действия карточки */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void startFromPlan(plan.id)}
                      disabled={startingPlanId !== null}
                      className="min-h-[56px] flex-1 rounded-xl bg-emerald-600 text-base font-bold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50"
                    >
                      {startingPlanId === plan.id ? 'Загрузка…' : '▶ Начать тренировку'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(plan.id)}
                      className="min-h-[56px] min-w-[56px] rounded-xl border border-slate-300 dark:border-slate-600 text-lg transition hover:bg-slate-200 dark:hover:bg-slate-700"
                      aria-label={`Редактировать план ${plan.name}`}
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(plan)}
                      className="min-h-[56px] min-w-[56px] rounded-xl border border-slate-300 dark:border-slate-600 text-lg transition hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-rose-600 dark:text-rose-400"
                      aria-label={`Удалить план ${plan.name}`}
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="pb-24" />
      </section>

      {/* Модалка создания/редактирования */}
      {isModalOpen && (
        <CreatePlanModal
          exercises={exercises}
          editingPlanId={editingPlanId}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => void loadPlans()}
        />
      )}

      {/* Подтверждение удаления */}
      {pendingDelete !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-plan-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-plan-title" className="text-lg font-bold">
              Удалить план «{pendingDelete.name}»?
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Упражнения плана тоже будут удалены. Действие необратимо.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="min-h-[56px] flex-1 rounded-xl border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="min-h-[56px] flex-1 rounded-xl bg-rose-600 font-bold text-white transition hover:bg-rose-500 active:scale-[0.99]"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Склонение слова «упражнение» для счётчика. */
function pluralExercises(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'упражнение';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'упражнения';
  return 'упражнений';
}
