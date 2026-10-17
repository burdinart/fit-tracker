import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Exercise } from '../types';
import { useHistoryStore } from '../stores/historyStore';
import {
  analyzeProgression,
  prepareExerciseChartData,
  type ProgressTrend,
} from '../utils/progression';

/** Пропсы страницы детальной статистики упражнения. */
export interface ExerciseStatsPageProps {
  /** Id упражнения из справочника (параметр маршрута /exercise-stats/:exerciseId). */
  exerciseId: string;
  /** Справочник упражнений (для названия в заголовке). */
  exercises: Exercise[];
  /** Вернуться на предыдущий экран. */
  onBack: () => void;
}

/** Подход в «раскрытом» виде — строка таблицы истории подходов. */
interface SetHistoryRow {
  /** Уникальный ключ строки (id подхода + id сессии). */
  key: string;
  /** Отформатированная дата тренировки. */
  date: string;
  /** Рабочий вес, кг. */
  weight: number;
  /** Повторы. */
  reps: number;
  /** Объём подхода (вес × повторы), кг. */
  volume: number;
  /** Выполнен ли подход. */
  isCompleted: boolean;
}

/** Метки тренда прогрессии для UI. */
const trendMeta: Record<ProgressTrend, { icon: string; label: string; className: string }> = {
  up: { icon: '📈', label: 'Прогресс', className: 'text-emerald-600 dark:text-emerald-400' },
  stable: { icon: '➡️', label: 'Стабильно', className: 'text-amber-600 dark:text-amber-400' },
  down: { icon: '📉', label: 'Спад', className: 'text-rose-600 dark:text-rose-400' },
};

/** Форматирование даты тренировки для таблицы. */
function formatSessionDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Детальная статистика одного упражнения (ШАГ 2):
 * рекорд, тренд прогрессии, графики 1ПМ и объёма по тренировкам,
 * таблица истории всех подходов. Данные — только из локального historyStore.
 */
export function ExerciseStatsPage({ exerciseId, exercises, onBack }: ExerciseStatsPageProps) {
  const sessions = useHistoryStore((state) => state.sessions);

  const exercise = exercises.find((item) => item.id === exerciseId);

  // Сессии с этим упражнением, новые сверху — источник для всех блоков страницы.
  const relevantSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.exercises.some((e) => e.exerciseId === exerciseId))
        .sort((a, b) => b.date - a.date),
    [sessions, exerciseId],
  );

  const progression = useMemo(
    () => analyzeProgression(exerciseId, sessions),
    [exerciseId, sessions],
  );

  const chartData = useMemo(
    () => prepareExerciseChartData(exerciseId, sessions),
    [exerciseId, sessions],
  );

  // История подходов: все выполненные и невыполненные подходы упражнения по тренировкам.
  const historyRows = useMemo<SetHistoryRow[]>(() => {
    const rows: SetHistoryRow[] = [];
    for (const session of relevantSessions) {
      for (const workoutExercise of session.exercises) {
        if (workoutExercise.exerciseId !== exerciseId) {
          continue;
        }
        for (const workoutSet of workoutExercise.sets) {
          rows.push({
            key: `${session.id}-${workoutSet.id}`,
            date: formatSessionDate(session.date),
            weight: workoutSet.weight,
            reps: workoutSet.reps,
            volume: workoutSet.weight * workoutSet.reps,
            isCompleted: workoutSet.isCompleted,
          });
        }
      }
    }
    return rows;
  }, [relevantSessions, exerciseId]);

  const trend = trendMeta[progression.progressTrend];
  const hasData = relevantSessions.length > 0;

  return (
    <main className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Шапка с кнопкой «Назад» и названием упражнения */}
      <header className="border-b border-slate-200 dark:border-slate-800 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[48px] min-w-[48px] shrink-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:hover:bg-slate-800 text-lg font-bold text-slate-800 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="Назад"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{exercise?.name ?? 'Упражнение'}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Детальная статистика</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-24">
        {!hasData && (
          <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-slate-500 dark:text-slate-400">
            По этому упражнению пока нет данных. Завершите первую тренировку с ним — и здесь
            появятся графики 📊
          </p>
        )}

        {hasData && (
          <>
            {/* Карточка 1: Рекорд */}
            <article className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                🏆 Рекорд
              </h2>
              <p className="mt-2 text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {progression.personalRecord.weight} кг
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {progression.personalRecord.reps} повт.
                {progression.personalRecord.date !== '' && ` · ${progression.personalRecord.date}`}
              </p>
            </article>

            {/* Карточка 2: Тренд */}
            <article className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Тренд
              </h2>
              <p className={`mt-2 flex items-center gap-2 text-2xl font-bold ${trend.className}`}>
                <span aria-hidden="true">{trend.icon}</span>
                {trend.label}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Проанализировано тренировок: {progression.sessionsAnalyzed}. Средний объём за
                тренировку: {progression.averageVolumePerSession} кг
              </p>
            </article>

            {/* График 1: расчётный 1ПМ по тренировкам */}
            <article className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Расчётный 1ПМ (кг)
              </h2>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                    <CartesianGrid stroke="var(--color-slate-700)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      domain={['dataMin - 5', 'dataMax + 5']}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        color: '#f1f5f9',
                      }}
                      formatter={(value: unknown) => [`${String(value)} кг`, '1ПМ']}
                    />
                    <Line
                      type="monotone"
                      dataKey="oneRepMax"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#34d399' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* График 2: объём по тренировкам */}
            <article className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Объём по тренировкам (кг)
              </h2>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                    <CartesianGrid stroke="var(--color-slate-700)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={48} />
                    <Tooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                      contentStyle={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        color: '#f1f5f9',
                      }}
                      formatter={(value: unknown) => [`${String(value)} кг`, 'Объём']}
                    />
                    <Bar dataKey="volume" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Таблица: история подходов */}
            <article className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                История подходов
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="pb-2 pr-2 font-medium">Дата</th>
                      <th className="pb-2 pr-2 font-medium">Вес</th>
                      <th className="pb-2 pr-2 font-medium">Повторы</th>
                      <th className="pb-2 font-medium">Объём</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.key} className="border-t border-slate-300 dark:border-slate-700">
                        <td className="py-2 pr-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{row.date}</td>
                        <td className="py-2 pr-2 tabular-nums">
                          {row.weight} кг
                          {!row.isCompleted && (
                            <span className="ml-1 text-xs text-slate-500">(не сделан)</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 tabular-nums">{row.reps}</td>
                        <td className="py-2 tabular-nums text-indigo-700 dark:text-indigo-300">
                          {Math.round(row.volume)} кг
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        )}
      </section>
    </main>
  );
}
