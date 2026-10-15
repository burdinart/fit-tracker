import { formatTime } from '../../utils/format';

/** Пропсы компонента таймера отдыха. */
export interface RestTimerProps {
  /** Оставшееся время отдыха в секундах. */
  timeLeft?: number;
  /** Активен ли таймер (неактивный таймер не рендерится). */
  isActive?: boolean;
  /** @deprecated Совместимость с прежним вызовом — то же, что timeLeft. */
  remainingSec?: number;
  /** Завершён ли отдых (дошёл до нуля). */
  isFinished: boolean;
  /** Досрочно пропустить отдых. */
  onSkip: () => void;
  /** Изменить длительность отдыха на delta секунд (+15 / −15). */
  onAdjust: (delta: number) => void;
}

/**
 * Таймер отдыха между подходами.
 * Фиксированная плашка внизу экрана (fixed bottom-0 left-0 right-0) на amber-фоне,
 * появляется только когда isActive === true.
 * Крупный моноширинный MM:SS, кнопки «+15с» / «−15с» / «Пропустить».
 * Вибрация по окончании выполняется в useRestTimer.
 */
export function RestTimer({
  timeLeft,
  isActive = true,
  remainingSec,
  isFinished,
  onSkip,
  onAdjust,
}: RestTimerProps) {
  if (!isActive) {
    return null;
  }

  const seconds = timeLeft ?? remainingSec ?? 0;

  return (
    <div className="fixed inset-x-0 bottom-0 left-0 right-0 z-20 border-t border-amber-700 bg-amber-600 px-4 py-4 text-white shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
        {/* Статус и крупный обратный отсчёт */}
        <p className="text-sm font-semibold text-white/90">
          {isFinished ? 'Отдых завершён — следующий подход!' : 'Отдых'}
        </p>
        <div
          className={`font-mono text-6xl font-bold tabular-nums text-white ${
            isFinished ? 'animate-pulse' : ''
          }`}
          role="timer"
          aria-live="polite"
        >
          {formatTime(seconds)}
        </div>

        {/* Управление длительностью и пропуск */}
        <div className="flex w-full items-stretch justify-center gap-3">
          <button
            type="button"
            onClick={() => onAdjust(-15)}
            className="min-h-[56px] flex-1 rounded-xl bg-amber-700 px-4 text-lg font-medium text-white transition hover:bg-amber-800 active:scale-[0.98]"
            aria-label="Уменьшить отдых на 15 секунд"
          >
            −15с
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[56px] flex-1 rounded-xl bg-white/15 px-4 text-lg font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/25 active:scale-[0.98]"
          >
            Пропустить
          </button>
          <button
            type="button"
            onClick={() => onAdjust(15)}
            className="min-h-[56px] flex-1 rounded-xl bg-amber-700 px-4 text-lg font-medium text-white transition hover:bg-amber-800 active:scale-[0.98]"
            aria-label="Увеличить отдых на 15 секунд"
          >
            +15с
          </button>
        </div>
      </div>
    </div>
  );
}
