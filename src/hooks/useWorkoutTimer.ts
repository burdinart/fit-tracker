import { useEffect, useState } from 'react';

/**
 * Хук секундомера активной тренировки.
 * Считает прошедшее время как разницу Date.now() и sessionStartTime (не инкрементом!),
 * поэтому значение остаётся корректным после сворачивания/заморозки вкладки браузером:
 * при возврате первый же тик интервала вернёт актуальную разницу меток времени.
 *
 * @param sessionStartTime - метка времени начала тренировки (мс) или null
 * @param isWorkoutActive - идёт ли тренировка сейчас
 * @returns elapsedSec — прошедшее время тренировки в секундах
 */
export function useWorkoutTimer(
  sessionStartTime: number | null,
  isWorkoutActive: boolean,
): number {
  /** Локальное состояние прошедших секунд. */
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  useEffect(() => {
    // Если тренировка не активна или время старта неизвестно — обнуляем счётчик.
    if (!isWorkoutActive || sessionStartTime === null) {
      setElapsedSec(0);
      return;
    }

    /** Пересчёт прошедшего времени от абсолютных меток (устойчив к троттлингу таймеров). */
    const updateElapsed = (): void => {
      const seconds = Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000));
      setElapsedSec(seconds);
    };

    // Немедленный расчёт при монтировании/активации — важно для возврата во вкладку.
    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [sessionStartTime, isWorkoutActive]);

  return elapsedSec;
}
