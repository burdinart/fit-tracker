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
 * Компактный таймер отдыха между подходами.
 * Фиксированная плашка внизу экрана (fixed bottom-0 left-0 right-0 z-50) —
 * расположена НАД нижней навигацией (BottomNav, z-40), чтобы не перекрывать её кнопки.
 * Появляется только когда isActive === true.
 * Моноширинный MM:SS (text-4xl), кнопки «−15с» / «Пропустить» / «+15с» в одну строку.
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
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 bg-amber-600 px-4 py-3 text-white shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        {/* Статус и обратный отсчёт слева */}
        <div className="text-left">
          <p className="text-xs font-medium opacity-90">
            {isFinished ? 'Отдых завершён!' : 'Отдых'}
          </p>
          <div
            className={`font-mono text-3xl font-bold leading-tight tabular-nums text-white ${
              isFinished ? 'animate-pulse' : ''
            }`}
            role="timer"
            aria-live="polite"
          >
            {formatTime(seconds)}
          </div>
        </div>

        {/* Управление длительностью и пропуск — в одну строку справа */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onAdjust(-15)}
            className="min-h-[36px] rounded-lg bg-amber-700 px-3 py-1 text-sm font-medium text-white transition hover:bg-amber-800 active:scale-[0.98]"
            aria-label="Уменьшить отдых на 15 секунд"
          >
            −15с
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[36px] rounded-lg bg-white/15 px-3 py-1 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/25 active:scale-[0.98]"
          >
            Пропустить
          </button>
          <button
            type="button"
            onClick={() => onAdjust(15)}
            className="min-h-[36px] rounded-lg bg-amber-700 px-3 py-1 text-sm font-medium text-white transition hover:bg-amber-800 active:scale-[0.98]"
            aria-label="Увеличить отдых на 15 секунд"
          >
            +15с
          </button>
        </div>
      </div>
    </div>
  );
}
