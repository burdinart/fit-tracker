import { useEffect, useMemo, useState } from 'react';
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
import type { Exercise, WorkoutSession } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useHistoryStore } from '../stores/historyStore';
import { fetchStatsData } from '../services/statsService';
import { buildExerciseIndex, exerciseNameOrFallback } from '../utils/registry';
import { muscleGroupLabels } from '../utils/labels';
import {
  flattenSets,
  formatVolume,
  getExerciseProgress,
  getTotalSessions,
  getTotalVolume,
  getVolumeByMuscleGroup,
  type ExerciseProgressPoint,
  type MuscleGroupVolumePoint,
} from '../utils/analytics';

/** Пропсы страницы статистики. */
export interface StatsPageProps {
  /** Справочник упражнений (нужен для названий и групп мышц). */
  exercises: Exercise[];
}

/** Тип точки линейного графика прогресса упражнения (данные для recharts). */
interface ProgressChartPoint extends ExerciseProgressPoint {
  /** Короткая подпись даты для оси X: ДД.ММ. */
  label: string;
}

/** Тип точки столбчатого графика объёма по группам мышц. */
interface GroupVolumeChartPoint extends MuscleGroupVolumePoint {
  /** Русская подпись группы мышц. */
  name: string;
  /** Объём в тоннах (для читаемой шкалы на мобильных). */
  volumeTons: number;
}

/** Стадии загрузки данных страницы. */
type LoadStatus = 'loading' | 'ready' | 'error';

/** Форматирует дату YYYY-MM-DD → ДД.ММ для подписи оси X. */
function shortDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${day}.${month}`;
}

/** Округление до двух знаков — компактные числа на осях графиков. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Страница подробной статистики (ШАГ 5).
 * Карточка 1 — количество тренировок и общий тоннаж (в тоннах);
 * карточка 2 — LineChart роста расчётного 1ПМ выбранного упражнения по датам;
 * карточка 3 — BarChart объёма по группам мышц за последний месяц.
 * Данные: Supabase (workout_sessions + workout_sets), при недоступности облака —
 * локальная история (historyStore). Графики адаптивны (ResponsiveContainer).
 */
export function StatsPage({ exercises }: StatsPageProps) {
  const userId = useAuthStore((state) => state.user?.id);

  // --- Загрузка данных: cloud → фолбэк на локальную историю ---
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isCloudSource, setIsCloudSource] = useState(false);

  useEffect(() => {
    if (userId === undefined) {
      return;
    }
    let cancelled = false;
    setStatus('loading');
    fetchStatsData(userId)
      .then((data) => {
        if (cancelled) return;
        if (data.sessions.length > 0) {
          setSessions(data.sessions);
          setIsCloudSource(true);
        } else {
          // Облако пусто — пробуем локальную историю (тренировки могли не синхронизироваться).
          setSessions(useHistoryStore.getState().sessions);
          setIsCloudSource(false);
        }
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[StatsPage] Supabase недоступен, показываем локальную историю:', error);
        setSessions(useHistoryStore.getState().sessions);
        setIsCloudSource(false);
        setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const exerciseById = useMemo(() => buildExerciseIndex(exercises), [exercises]);

  // --- Карточка 1: сводка ---
  const totalSessions = useMemo(() => getTotalSessions(sessions), [sessions]);
  const totalVolumeKg = useMemo(() => getTotalVolume(sessions), [sessions]);

  // --- Карточка 2: прогресс одного упражнения ---
  const flatSets = useMemo(() => flattenSets(sessions), [sessions]);
  // Упражнения, которые реально встречались в истории (с сортировкой по названию).
  const trainedExerciseOptions = useMemo(() => {
    const usedIds = new Set(
      flatSets.map((set) => set.exerciseId).filter((id): id is string => id !== null),
    );
    return [...usedIds]
      .map((id) => ({
        id,
        name: exerciseNameOrFallback(exerciseById, id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [flatSets, exerciseById]);

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  // Автовыбор первого упражнения, когда список появился, а выбор ещё не сделан.
  useEffect(() => {
    if (selectedExerciseId === null && trainedExerciseOptions.length > 0) {
      setSelectedExerciseId(trainedExerciseOptions[0].id);
    }
  }, [selectedExerciseId, trainedExerciseOptions]);

  const progressPoints = useMemo<ProgressChartPoint[]>(() => {
    if (selectedExerciseId === null) {
      return [];
    }
    return getExerciseProgress(flatSets, selectedExerciseId).map((point) => ({
      ...point,
      label: shortDate(point.date),
    }));
  }, [flatSets, selectedExerciseId]);

  // --- Карточка 3: объём по группам мышц за месяц ---
  const groupVolumePoints = useMemo<GroupVolumeChartPoint[]>(() => {
    return getVolumeByMuscleGroup(sessions, exerciseById, 30)
      .filter((point) => point.volume > 0)
      .map((point) => ({
        ...point,
        name: muscleGroupLabels[point.muscleGroup],
        volumeTons: round2(point.volume / 1000),
      }));
  }, [sessions, exerciseById]);

  // --- Состояние загрузки ---
  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-900 text-slate-400">
        <div className="animate-pulse text-lg">Загрузка статистики…</div>
      </main>
    );
  }

  // --- Пустое состояние: нет ни одной тренировки ---
  if (sessions.length === 0) {
    return (
      <main className="min-h-dvh bg-slate-900 px-4 py-6 text-slate-100">
        <h1 className="text-2xl font-bold tracking-tight">Статистика</h1>
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-4xl" aria-hidden="true">📊</p>
          <p className="mt-3 font-semibold text-slate-200">Пока нет данных</p>
          <p className="mt-1 text-sm text-slate-400">
            Завершите первую тренировку — здесь появятся графики прогресса и тоннажа.
          </p>
        </div>
        <div className="pb-24" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Статистика</h1>
        <p className="mt-1 text-sm text-slate-400">
          {isCloudSource ? 'Данные из облака Supabase' : 'Данные из локальной истории'}
        </p>
      </header>

      <section className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {/* ---------- Карточка 1: сводка ---------- */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-3xl font-bold tabular-nums text-emerald-400">{totalSessions}</p>
            <p className="mt-1 text-sm text-slate-400">Всего тренировок</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-3xl font-bold tabular-nums text-indigo-300">
              {round2(totalVolumeKg / 1000)} т
            </p>
            <p className="mt-1 text-sm text-slate-400">Общий поднятый тоннаж</p>
          </div>
        </div>

        {/* ---------- Карточка 2: прогресс 1ПМ упражнения ---------- */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
          <h2 className="font-semibold">Прогресс упражнения (расчётный 1ПМ)</h2>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm text-slate-300">Упражнение</span>
            <select
              value={selectedExerciseId ?? ''}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
              disabled={trainedExerciseOptions.length === 0}
              className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {trainedExerciseOptions.length === 0 && <option value="">Нет данных</option>}
              {trainedExerciseOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          {progressPoints.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-600 p-4 text-center text-sm text-slate-400">
              Для этого упражнения пока нет выполненных подходов.
            </p>
          ) : (
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressPoints} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    stroke="#475569"
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    stroke="#475569"
                    width={52}
                    domain={['auto', 'auto']}
                    unit=" кг"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value, name) => [
                      `${String(value)} кг`,
                      name === 'estimated1RM' ? 'Расчётный 1ПМ' : String(name),
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimated1RM"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#10b981' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ---------- Карточка 3: объём по группам мышц за месяц ---------- */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
          <h2 className="font-semibold">Объём по группам мышц (последний месяц)</h2>
          {groupVolumePoints.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-600 p-4 text-center text-sm text-slate-400">
              За последние 30 дней не было завершённых подходов.
            </p>
          ) : (
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupVolumePoints} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    stroke="#475569"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    stroke="#475569"
                    width={52}
                    unit=" т"
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value) => [`${String(value)} т`, 'Объём']}
                  />
                  <Bar dataKey="volumeTons" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Текстовая таблица объёмов — доступная альтернатива графику */}
          {groupVolumePoints.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {groupVolumePoints.map((point) => (
                <li key={point.muscleGroup} className="flex justify-between">
                  <span>{point.name}</span>
                  <span className="tabular-nums text-slate-400">{formatVolume(point.volume)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Итог по всем сессиям (дублирует карточку 1 в удобном формате) */}
        <p className="text-center text-xs text-slate-500">
          Всего выполнено подходов: {flatSets.filter((set) => set.isCompleted).length} · FitTracker
        </p>
      </section>

      {/* Отступ под нижнюю навигацию */}
      <div className="pb-24" />
    </main>
  );
}
