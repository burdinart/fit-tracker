import { useEffect, useState } from 'react';
import type { Exercise, WorkoutPlan, WorkoutPlanExercise } from '../../types';
import { createPlan, updatePlan, fetchPlanWithExercises } from '../../services/plansService';
import type { PlanExerciseInput } from '../../services/plansService';
import { muscleGroupLabels } from '../../utils/labels';
import { WEEK_DAYS, weekDayLabels, isWeekDay } from '../../utils/planLabels';
import type { WeekDay } from '../../utils/planLabels';

/** Строка упражнения в черновике плана (с названием для отображения). */
interface DraftRow extends PlanExerciseInput {
  /** Название упражнения из справочника. */
  exerciseName: string;
}

/** Пропсы модалки создания/редактирования плана. */
export interface CreatePlanModalProps {
  /** Справочник упражнений (базовые + пользовательские). */
  exercises: Exercise[];
  /** Редактируемый план (null — создание нового). */
  editingPlanId: string | null;
  /** Закрыть модалку. */
  onClose: () => void;
  /** План сохранён — родитель перезагружает список. */
  onSaved: () => void;
}

/** Индексирует справочник упражнений по id. */
function indexById(list: Exercise[]): Map<string, Exercise> {
  const map = new Map<string, Exercise>();
  for (const exercise of list) map.set(exercise.id, exercise);
  return map;
}

/**
 * Модалка создания/редактирования плана тренировки (ШАГ 5):
 * название, описание, день недели, список упражнений с целевыми параметрами,
 * перестановка кнопками ↑/↓, удаление строки, поиск при добавлении упражнения.
 */
export function CreatePlanModal({ exercises, editingPlanId, onClose, onSaved }: CreatePlanModalProps) {
  const exerciseIndex = indexById(exercises);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<WeekDay | ''>('');
  const [rows, setRows] = useState<DraftRow[]>([]);

  // Секция добавления упражнения: открыта ли и строка поиска.
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(editingPlanId !== null);

  // При редактировании — подтягиваем существующий план с упражнениями.
  useEffect(() => {
    if (editingPlanId === null) return;
    let cancelled = false;
    setIsLoadingPlan(true);
    fetchPlanWithExercises(editingPlanId)
      .then(({ plan, exercises: planExercises }: { plan: WorkoutPlan; exercises: WorkoutPlanExercise[] }) => {
        if (cancelled) return;
        setName(plan.name);
        setDescription(plan.description ?? '');
        setDayOfWeek(isWeekDay(plan.day_of_week) ? plan.day_of_week : '');
        setRows(
          planExercises.map((pe) => ({
            exercise_id: pe.exercise_id,
            exerciseName: pe.exercise?.name ?? exerciseIndex.get(pe.exercise_id)?.name ?? 'Упражнение',
            target_sets: pe.target_sets,
            target_reps: pe.target_reps,
            target_weight: pe.target_weight,
            rest_time_sec: pe.rest_time_sec,
          })),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить план.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlan(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPlanId]);

  /** Добавляет упражнение в конец списка строк плана (без дублей). */
  const handleAddRow = (exercise: Exercise): void => {
    setRows((prev) => {
      if (prev.some((row) => row.exercise_id === exercise.id)) return prev;
      return [
        ...prev,
        {
          exercise_id: exercise.id,
          exerciseName: exercise.name,
          target_sets: 3,
          target_reps: 10,
          target_weight: 0,
          rest_time_sec: 90,
        },
      ];
    });
    setShowPicker(false);
    setPickerQuery('');
  };

  /** Частично обновляет строку плана. */
  const handlePatchRow = (index: number, patch: Partial<PlanExerciseInput>): void => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  /** Удаляет строку из плана. */
  const handleRemoveRow = (index: number): void => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  /** Перемещает строку вверх/вниз (порядок в плане). */
  const handleMoveRow = (index: number, direction: -1 | 1): void => {
    setRows((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  /** Сохраняет план (создание или обновление) через plansService. */
  const handleSave = async (): Promise<void> => {
    if (name.trim() === '') {
      setError('Введите название плана.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload: PlanExerciseInput[] = rows.map((row) => ({
        exercise_id: row.exercise_id,
        target_sets: row.target_sets,
        target_reps: row.target_reps,
        target_weight: row.target_weight,
        rest_time_sec: row.rest_time_sec,
      }));
      if (editingPlanId !== null) {
        await updatePlan(editingPlanId, name.trim(), description.trim(), dayOfWeek || null, payload);
      } else {
        await createPlan(name.trim(), description.trim(), dayOfWeek || null, payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить план.');
    } finally {
      setIsSaving(false);
    }
  };

  // Отфильтрованные упражнения для пикера (поиск по названию/группе мышц).
  const query = pickerQuery.trim().toLowerCase();
  const pickerList = exercises.filter(
    (e) =>
      !rows.some((row) => row.exercise_id === e.id) &&
      (query === '' ||
        e.name.toLowerCase().includes(query) ||
        muscleGroupLabels[e.muscleGroup].toLowerCase().includes(query)),
  );

  const inputClass =
    'min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-plan-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-700 bg-slate-800 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Шапка модалки */}
        <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 id="create-plan-title" className="text-lg font-bold">
            {editingPlanId !== null ? 'Редактировать план' : 'Новый план тренировки'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg text-xl text-slate-400 transition hover:bg-slate-700 hover:text-white"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </header>

        {/* Тело модалки (скроллируемое) */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {isLoadingPlan ? (
            <p className="animate-pulse py-8 text-center text-slate-400">Загрузка плана…</p>
          ) : (
            <>
              {/* Название */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Название плана *</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Например: Грудь + трицепс"
                  className={inputClass}
                  maxLength={100}
                />
              </label>

              {/* Описание */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Описание</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Необязательно"
                  rows={2}
                  className={`${inputClass} resize-none`}
                  maxLength={300}
                />
              </label>

              {/* День недели */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">День недели</span>
                <select
                  value={dayOfWeek}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDayOfWeek(value === '' ? '' : (value as WeekDay));
                  }}
                  className={inputClass}
                >
                  <option value="">Не указано</option>
                  {WEEK_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {weekDayLabels[day]}
                    </option>
                  ))}
                </select>
              </label>

              {/* Секция упражнений */}
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Упражнения ({rows.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPicker((prev) => !prev)}
                    className="min-h-[44px] rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  >
                    ＋ Добавить упражнение
                  </button>
                </div>

                {/* Пикер выбора упражнения с поиском */}
                {showPicker && (
                  <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
                    <input
                      type="search"
                      value={pickerQuery}
                      onChange={(event) => setPickerQuery(event.target.value)}
                      placeholder="Поиск упражнения…"
                      className={`${inputClass} mb-2`}
                      autoFocus
                    />
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {pickerList.length === 0 ? (
                        <li className="py-3 text-center text-sm text-slate-500">Ничего не найдено</li>
                      ) : (
                        pickerList.map((exercise) => (
                          <li key={exercise.id}>
                            <button
                              type="button"
                              onClick={() => handleAddRow(exercise)}
                              className="min-h-[48px] w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                            >
                              <span className="font-medium">{exercise.name}</span>
                              <span className="ml-2 text-xs text-slate-500">
                                {muscleGroupLabels[exercise.muscleGroup]}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}

                {/* Строки плана */}
                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-700 py-4 text-center text-sm text-slate-500">
                    Пока пусто — добавьте упражнения кнопкой выше
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {rows.map((row, index) => (
                      <li
                        key={`${row.exercise_id}-${index}`}
                        className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="truncate font-medium">{row.exerciseName}</p>
                          <div className="flex shrink-0 items-center">
                            <button
                              type="button"
                              onClick={() => handleMoveRow(index, -1)}
                              disabled={index === 0}
                              className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 transition hover:bg-slate-800 disabled:opacity-30"
                              aria-label="Выше"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRow(index, 1)}
                              disabled={index === rows.length - 1}
                              className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 transition hover:bg-slate-800 disabled:opacity-30"
                              aria-label="Ниже"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(index)}
                              className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                              aria-label={`Удалить ${row.exerciseName} из плана`}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {(
                            [
                              ['Подходы', 'target_sets', 1],
                              ['Повторы', 'target_reps', 1],
                              ['Вес (кг)', 'target_weight', 0.5],
                              ['Отдых (сек)', 'rest_time_sec', 5],
                            ] as const
                          ).map(([label, field, step]) => (
                            <label key={field} className="block">
                              <span className="mb-1 block text-xs text-slate-400">{label}</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={step}
                                value={row[field]}
                                onChange={(event) => {
                                  const parsed = Number.parseFloat(event.target.value);
                                  handlePatchRow(index, {
                                    [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                                  } as Partial<PlanExerciseInput>);
                                }}
                                className="min-h-[48px] w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-center tabular-nums text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </label>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {error !== null && (
                <p className="rounded-xl border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Футер модалки */}
        <footer
          className="flex gap-3 border-t border-slate-700 px-4 py-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="min-h-[56px] flex-1 rounded-xl border border-slate-600 text-base font-semibold text-slate-300 transition hover:bg-slate-700"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || isLoadingPlan}
            className="min-h-[56px] flex-1 rounded-xl bg-emerald-600 text-base font-bold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50"
          >
            {isSaving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </footer>
      </div>
    </div>
  );
}
