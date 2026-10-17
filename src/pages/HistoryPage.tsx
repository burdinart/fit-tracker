import { useMemo, useState } from 'react';
import type { Exercise } from '../types';
import { useHistoryStore } from '../stores/historyStore';
import { useUserStore } from '../stores/userStore';
import { SessionDetail } from '../components/workout/SessionDetail';
import {
  getSessionVolume,
  getTotalVolume,
  getStreak,
  formatVolume,
} from '../utils/analytics';
import { formatTime } from '../utils/format';

/** Пропсы страницы истории. */
export interface HistoryPageProps {
  /** Справочник упражнений — нужен, чтобы в деталях показать названия. */
  exercises: Exercise[];
  /** Открыть детальную статистику упражнения (ШАГ 4). */
  onOpenExerciseStats?: (exerciseId: string) => void;
}

/**
 * Экран истории тренировок: сводка аналитики сверху (всего тренировок,
 * общий объём в тоннах, текущая серия дней), затем список завершённых
 * тренировок (карточки, новые сверху). Клик по карточке открывает модалку
 * детального просмотра (SessionDetail) с возможностью удалить запись.
 */
export function HistoryPage({ exercises, onOpenExerciseStats }: HistoryPageProps) {
  const sessions = useHistoryStore((state) => state.sessions);
  const deleteSession = useHistoryStore((state) => state.deleteSession);
  const units = useUserStore((state) => state.profile.units);

  /** Id сессии, открытой в модалке деталей (null — модалка закрыта). */
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  // Сводная аналитика пересчитывается только при изменении истории.
  const summary = useMemo(
    () => ({
      total: sessions.length,
      volumeKg: getTotalVolume(sessions),
      streak: getStreak(sessions),
    }),
    [sessions],
  );

  // Список сортируем по дате: новые тренировки сверху.
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.date - a.date),
    [sessions],
  );

  const openSession =
    openSessionId !== null ? sessions.find((s) => s.id === openSessionId) : undefined;

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">История</h1>
        <p className="mt-1 text-sm text-slate-400">Завершённые тренировки и базовая аналитика</p>
      </header>

      <section className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-28">
        {/* Сводка аналитики */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-emerald-400">{summary.total}</p>
            <p className="mt-1 text-[11px] leading-tight text-slate-400">Всего тренировок</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-indigo-300">
              {formatVolume(summary.volumeKg)}
            </p>
            <p className="mt-1 text-[11px] leading-tight text-slate-400">Общий объём</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-amber-400">
              {summary.streak}
            </p>
            <p className="mt-1 text-[11px] leading-tight text-slate-400">Серия, дней 🔥</p>
          </div>
        </div>

        {/* Пустое состояние */}
        {sortedSessions.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
            Пока нет завершённых тренировок.
            <br />
            Завершите тренировку на вкладке «Тренировка» — она появится здесь.
          </p>
        )}

        {/* Список сессий: карточки, новые сверху */}
        <ul className="space-y-3">
          {sortedSessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => setOpenSessionId(session.id)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-left transition hover:border-slate-500 active:scale-[0.99]"
                aria-label={`Открыть детали тренировки от ${new Date(session.date).toLocaleDateString('ru-RU')}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    {new Date(session.date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                    })}
                    <span className="ml-2 text-sm font-normal text-slate-400">
                      {new Date(session.date).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                  <span className="shrink-0 text-slate-500" aria-hidden="true">
                    ›
                  </span>
                </div>
                <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400 tabular-nums">
                  <span>⏱ {formatTime(session.durationSec)}</span>
                  <span>Упражнений: {session.exercises.length}</span>
                  <span>Объём: {formatVolume(getSessionVolume(session))}</span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Модалка детального просмотра сессии */}
      {openSession !== undefined && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-detail-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setOpenSessionId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 id="session-detail-title" className="text-lg font-bold">
                Детали тренировки
              </h2>
              <button
                type="button"
                onClick={() => setOpenSessionId(null)}
                className="min-h-[44px] min-w-[44px] rounded-lg text-xl text-slate-400 transition hover:bg-slate-700 hover:text-slate-100"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            <SessionDetail
              session={openSession}
              exercises={exercises}
              units={units}
              onOpenExerciseStats={
                onOpenExerciseStats !== undefined
                  ? (exerciseId) => {
                      // Закрываем модалку деталей и открываем статистику упражнения.
                      setOpenSessionId(null);
                      onOpenExerciseStats(exerciseId);
                    }
                  : undefined
              }
            />

            {/* Удаление записи истории */}
            <button
              type="button"
              onClick={() => {
                deleteSession(openSession.id);
                setOpenSessionId(null);
              }}
              className="mt-4 min-h-[48px] w-full rounded-xl border border-rose-500/60 text-sm font-semibold text-rose-400 transition hover:bg-rose-950/50"
            >
              🗑 Удалить тренировку из истории
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
