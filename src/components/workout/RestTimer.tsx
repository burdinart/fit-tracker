import { formatTime } from '../../utils/format';

/** Пропсы компонента таймера отдыха. */
export interface RestTimerProps {
  /** Оставшееся время отдыха в секундах. */
  remainingSec: number;
  /** Завершён ли отдых (дошёл до нуля). */
  isFinished: boolean;
  /** Досрочно пропустить отдых. */
  onSkip: () => void;
  /** Изменить длительность отдыха на delta секунд (+15 / −15). */
  onAdjust: (delta: number) => void;
}

/**
 * Таймер отдыха между подходами.
 * Крупный моноширинный MM:SS с цветовой индикацией:
 * зелёный → жёлтый (последние 10 секунд) → красный (0).
 * По завершении — пульсация (animate-pulse); вибрация выполняется в useRestTimer.
 */
export function RestTimer({ remainingSec, isFinished, onSkip, onAdjust }: RestTimerProps) {
  // Выбор цвета таймера по остатку времени.
  const timerColorClass = isFinished
    ? 'text-rose-500'
    : remainingSec <= 10
      ? 'text-amber-400'
      : 'text-emerald-400';

  return (
    <div className="sticky bottom-0 z-10 border-t border-slate-700 bg-slate-900/95 px-4 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
        {/* Статус и крупный обратный отсчёт */}
        <p className={`text-sm font-medium ${isFinished ? 'text-rose-400' : 'text-slate-400'}`}>
          {isFinished ? 'Отдых завершён — следующий подход!' : 'Отдых'}
        </p>
        <div
          className={`font-mono text-6xl font-bold tabular-nums ${timerColorClass} ${
            isFinished ? 'animate-pulse' : ''
          }`}
          role="timer"
          aria-live="polite"
        >
          {formatTime(remainingSec)}
        </div>

        {/* Управление длительностью и пропуск */}
        <div className="flex w-full items-stretch justify-center gap-3">
          <button
            type="button"
            onClick={() => onAdjust(-15)}
            className="min-h-[56px] flex-1 rounded-xl bg-slate-800 px-4 text-lg font-medium text-slate-200 transition hover:bg-slate-700 active:scale-[0.98]"
            aria-label="Уменьшить отдых на 15 секунд"
          >
            −15с
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[56px] flex-1 rounded-xl bg-slate-700 px-4 text-lg font-semibold text-slate-100 transition hover:bg-slate-600 active:scale-[0.98]"
          >
            Пропустить
          </button>
          <button
            type="button"
            onClick={() => onAdjust(15)}
            className="min-h-[56px] flex-1 rounded-xl bg-slate-800 px-4 text-lg font-medium text-slate-200 transition hover:bg-slate-700 active:scale-[0.98]"
            aria-label="Увеличить отдых на 15 секунд"
          >
            +15с
          </button>
        </div>
      </div>
    </div>
  );
}
