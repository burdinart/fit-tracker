import { useState } from 'react';
import type { Exercise, MuscleGroup, UserInjuries, WorkoutExercise, WorkoutSet } from '../../types';
import { muscleGroupLabels } from '../../utils/labels';
import { isExerciseSafe } from '../../utils/exerciseFilter';
import { analyzeProgression, type ProgressTrend } from '../../utils/progression';
import { useHistoryStore } from '../../stores/historyStore';
import { InjuryWarning } from '../ui/InjuryWarning';

/** Пропсы карточки упражнения в активной тренировке. */
export interface ExerciseCardProps {
  /** Упражнение из справочника. */
  exercise: Exercise;
  /** Данные упражнения внутри текущей сессии (подходы). */
  workoutExercise: WorkoutExercise;
  /** Добавить новый подход. */
  onAddSet: (exerciseId: string) => void;
  /** Обновить данные подхода. */
  onUpdateSet: (exerciseId: string, setId: string, data: Partial<WorkoutSet>) => void;
  /** Отметить подход выполненным (запускает отдых). */
  onCompleteSet: (exerciseId: string, setId: string) => void;
  /** Удалить упражнение из сессии. */
  onRemove: (exerciseId: string) => void;
  /** Типы травм пользователя — подсвечивают небезопасные для него упражнения. */
  userInjuries: UserInjuries;
  /** Полный справочник — передаётся в InjuryWarning для показа альтернатив. */
  allExercises?: Exercise[];
  /** Открыть детальную статистику упражнения (ШАГ 4). */
  onOpenStats?: (exerciseId: string) => void;
}

/** Иконка-эмодзи для группы мышц. */
const muscleGroupIcons: Record<MuscleGroup, string> = {
  chest: '🛡️',
  back: '🔙',
  shoulders: '🏔️',
  legs: '🦵',
  arms: '💪',
  core: '🧱',
  cardio: '❤️',
};

/** Цветовые стили плашки рекомендации по тренду прогрессии. */
const trendBannerStyles: Record<ProgressTrend, string> = {
  up: 'border-emerald-600/60 bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  stable: 'border-amber-600/50 bg-amber-950/30 text-amber-700 dark:text-amber-300',
  down: 'border-rose-600/60 bg-rose-950/40 text-rose-700 dark:text-rose-300',
};

/** Числовое значение ввода веса: пустая строка → 0. */
function parseWeightValue(raw: string): number {
  const parsed = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Числовое значение ввода повторов: пустая строка → 0. */
function parseRepsValue(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Карточка упражнения в активной тренировке:
 * заголовок с иконкой группы мышц, таблица подходов (вес / повторы / ✓),
 * кнопка добавления подхода и удаление упражнения.
 * При травме пользователя и небезопасном для неё упражнении — красная рамка и ⚠️.
 */
export function ExerciseCard({
  exercise,
  workoutExercise,
  onAddSet,
  onUpdateSet,
  onCompleteSet,
  onRemove,
  userInjuries,
  allExercises,
  onOpenStats,
}: ExerciseCardProps) {
  /** Локальные «строковые» значения полей ввода (нужны для пустого поля и десятичных кг). */
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});
  const [repsDrafts, setRepsDrafts] = useState<Record<string, string>>({});

  // Умная прогрессия (ШАГ 3): анализ последних тренировок с этим упражнением
  // из локального historyStore — без запросов к Supabase.
  const historySessions = useHistoryStore((state) => state.sessions);
  const progression = analyzeProgression(exercise.id, historySessions);

  /** Применяет рекомендуемый вес ко всем невыполненным подходам упражнения. */
  const applyRecommendation = (): void => {
    for (const workoutSet of workoutExercise.sets) {
      if (!workoutSet.isCompleted && workoutSet.weight !== progression.recommendedWeight) {
        onUpdateSet(exercise.id, workoutSet.id, { weight: progression.recommendedWeight });
      }
    }
    // Сбрасываем черновики ввода, чтобы поля показали новое значение.
    setWeightDrafts((prev) => {
      const next = { ...prev };
      for (const workoutSet of workoutExercise.sets) {
        delete next[workoutSet.id];
      }
      return next;
    });
  };

  // Определяем опасное для пользователя упражнение через общий фильтр травм.
  const isUnsafeForUser = !isExerciseSafe(exercise, userInjuries);

  /** Текущее отображаемое значение веса: черновик, если пользователь редактирует, иначе число. */
  const weightDisplay = (workoutSet: WorkoutSet): string =>
    weightDrafts[workoutSet.id] ?? String(workoutSet.weight);

  /** Текущее отображаемое значение повторов. */
  const repsDisplay = (workoutSet: WorkoutSet): string =>
    repsDrafts[workoutSet.id] ?? String(workoutSet.reps);

  /** Обработка изменения веса: обновляем стор только валидным числом. */
  const handleWeightChange = (workoutSet: WorkoutSet, raw: string): void => {
    setWeightDrafts((prev) => ({ ...prev, [workoutSet.id]: raw }));
    if (raw.trim() === '') {
      onUpdateSet(exercise.id, workoutSet.id, { weight: 0 });
      return;
    }
    const value = parseWeightValue(raw);
    onUpdateSet(exercise.id, workoutSet.id, { weight: value });
  };

  /** Обработка изменения повторов. */
  const handleRepsChange = (workoutSet: WorkoutSet, raw: string): void => {
    setRepsDrafts((prev) => ({ ...prev, [workoutSet.id]: raw }));
    if (raw.trim() === '') {
      onUpdateSet(exercise.id, workoutSet.id, { reps: 0 });
      return;
    }
    const value = parseRepsValue(raw);
    onUpdateSet(exercise.id, workoutSet.id, { reps: value });
  };

  return (
    <article
      className={`rounded-xl border bg-slate-50 dark:bg-slate-800 p-4 ${
        isUnsafeForUser ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-300 dark:border-slate-700'
      }`}
    >
      {/* Заголовок: иконка + название + бейдж группы мышц + предупреждение + удаление */}
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="text-2xl leading-none" aria-hidden="true">
            {muscleGroupIcons[exercise.muscleGroup]}
          </span>
          <div>
            <h3 className="text-lg font-semibold leading-tight">
              {isUnsafeForUser && (
                <span className="mr-1" role="img" aria-label="Осторожно: небезопасно при ваших ограничениях">
                  ⚠️
                </span>
              )}
              {exercise.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {muscleGroupLabels[exercise.muscleGroup]}
              {isUnsafeForUser && (
                <span className="ml-2 font-medium text-rose-600 dark:text-rose-400">небезопасно при ваших ограничениях</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-start">
          {onOpenStats !== undefined && (
            <button
              type="button"
              onClick={() => onOpenStats(exercise.id)}
              className="min-h-[44px] rounded-lg px-2 py-1 text-base text-slate-500 dark:text-slate-400 transition hover:bg-slate-200 dark:bg-slate-700 hover:text-emerald-600 dark:text-emerald-400"
              aria-label={`Открыть статистику упражнения ${exercise.name}`}
              title="Статистика упражнения"
            >
              📊
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(exercise.id)}
            className="min-h-[44px] rounded-lg px-2 py-1 text-base text-slate-500 dark:text-slate-400 transition hover:bg-slate-200 dark:bg-slate-700 hover:text-rose-600 dark:text-rose-400"
            aria-label={`Удалить упражнение ${exercise.name} из тренировки`}
            title="Удалить упражнение"
          >
            🗑️
          </button>
        </div>
      </header>

      {/* Плашка умной прогрессии (ШАГ 3): прошлый вес/повторы + рекомендация. */}
      {progression.sessionsAnalyzed > 0 && progression.lastWeight > 0 && (
        <div
          className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${trendBannerStyles[progression.progressTrend]}`}
        >
          <span>
            💪 Прошлый раз: {progression.lastWeight} кг × {progression.lastReps} повт.
            {progression.recommendedWeight > 0 &&
              progression.recommendedWeight !== progression.lastWeight &&
              ` Рекомендуем: ${progression.recommendedWeight} кг`}
          </span>
          {progression.recommendedWeight > 0 && (
            <button
              type="button"
              onClick={applyRecommendation}
              className="min-h-[44px] rounded-lg bg-white dark:bg-slate-900/50 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white dark:bg-slate-900/80 active:scale-[0.97]"
            >
              Применить рекомендацию
            </button>
          )}
        </div>
      )}

      {/* Предупреждение о небезопасном упражнении + альтернативы (ничего не рендерит, если безопасно) */}
      {isUnsafeForUser && (
        <div className="mb-3">
          <InjuryWarning exercise={exercise} injuries={userInjuries} allExercises={allExercises} />
        </div>
      )}

      {/* Целевые параметры из плана тренировки (если сессия начата по плану) */}
      {workoutExercise.targets != null && (
        <p className="mb-2 text-xs text-slate-500">
          Цель: {workoutExercise.targets.targetSets}×{workoutExercise.targets.targetReps}
          {workoutExercise.targets.targetWeight > 0 &&
            ` @ ${workoutExercise.targets.targetWeight}кг`}
        </p>
      )}

      {/* Таблица подходов */}
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <th className="pb-2 pr-2 font-medium">Подход</th>
            <th className="pb-2 pr-2 font-medium">Вес</th>
            <th className="pb-2 pr-2 font-medium">Повторы</th>
            <th className="pb-2 text-right font-medium">✓</th>
          </tr>
        </thead>
        <tbody>
          {workoutExercise.sets.map((workoutSet, index) => (
            <tr
              key={workoutSet.id}
              className={`border-t border-slate-300 dark:border-slate-700 ${
                workoutSet.isCompleted ? 'bg-emerald-900/30' : ''
              }`}
            >
              <td className="py-2 pr-2 text-lg font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                {index + 1}
              </td>
              <td className="py-2 pr-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={weightDisplay(workoutSet)}
                  onChange={(event) => handleWeightChange(workoutSet, event.target.value)}
                  className="w-20 text-2xl py-2 bg-slate-50 dark:bg-slate-800 rounded text-center tabular-nums text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label={`Вес, подход ${index + 1}`}
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={repsDisplay(workoutSet)}
                  onChange={(event) => handleRepsChange(workoutSet, event.target.value)}
                  className="w-20 text-2xl py-2 bg-slate-50 dark:bg-slate-800 rounded text-center tabular-nums text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label={`Повторы, подход ${index + 1}`}
                />
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  onClick={() => onCompleteSet(exercise.id, workoutSet.id)}
                  className={`min-h-[56px] min-w-[56px] rounded-xl text-2xl font-bold transition active:scale-[0.96] ${
                    workoutSet.isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-700 hover:text-white'
                  }`}
                  aria-label={`Отметить подход ${index + 1} выполненным`}
                >
                  ✓
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Добавление нового подхода */}
      <button
        type="button"
        onClick={() => onAddSet(exercise.id)}
        className="mt-3 min-h-[56px] w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-lg font-medium text-slate-700 dark:text-slate-300 transition hover:border-emerald-500 hover:text-emerald-600 dark:text-emerald-400 active:scale-[0.99]"
      >
        + Добавить подход
      </button>
    </article>
  );
}
