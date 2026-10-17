import { formatTime } from '../../utils/format';

/** Пропсы шапки активной тренировки. */
export interface WorkoutHeaderProps {
  /** Прошедшее время тренировки в секундах. */
  elapsedSec: number;
  /** Завершить тренировку. */
  onEnd: () => void;
}

/**
 * Шапка экрана активной тренировки:
 * название, общий секундомер MM:SS и красная кнопка «Завершить».
 */
export function WorkoutHeader({ elapsedSec, onEnd }: WorkoutHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold leading-tight">Тренировка</h2>
          {/* Общий таймер: крупный моноширинный, устойчив к сворачиванию вкладки */}
          <p className="font-mono text-3xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatTime(elapsedSec)}
          </p>
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="min-h-[56px] rounded-xl bg-rose-600 px-6 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.98]"
        >
          Завершить
        </button>
      </div>
    </header>
  );
}
