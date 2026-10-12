import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../utils/haptics';

/** Результат работы таймера отдыха. */
export interface RestTimerResult {
  /** Оставшееся время отдыха в секундах (не отрицательное). */
  remainingSec: number;
  /** Завершён ли отдых (оставшееся время дошло до нуля). */
  isFinished: boolean;
}

/**
 * Хук таймера отдыха между подходами.
 * Обратный отсчёт считается от restStartedAt через разницу Date.now(),
 * а не инкрементом — после сворачивания вкладки время не «отстаёт».
 * При завершении отдыха вызывает вибрацию (triggerHaptic) один раз.
 *
 * @param restStartedAt - метка времени начала отдыха (мс) или null
 * @param restTimeLeftSec - плановая длительность отдыха в секундах
 * @param isResting - активен ли сейчас отдых
 * @returns { remainingSec, isFinished }
 */
export function useRestTimer(
  restStartedAt: number | null,
  restTimeLeftSec: number,
  isResting: boolean,
): RestTimerResult {
  const [remainingSec, setRemainingSec] = useState<number>(restTimeLeftSec);
  /** Ref-флаг: вибрация по окончании отдыха уже выполнена (срабатывает ровно один раз). */
  const hapticDoneRef = useRef<boolean>(false);

  useEffect(() => {
    // Отдых не активен — сбрасываем состояние на плановую длительность.
    if (!isResting || restStartedAt === null) {
      setRemainingSec(restTimeLeftSec);
      hapticDoneRef.current = false;
      return;
    }

    /** Пересчёт остатка от абсолютной метки начала отдыха. */
    const updateRemaining = (): void => {
      const passedSec = Math.floor((Date.now() - restStartedAt) / 1000);
      const nextRemaining = Math.max(0, restTimeLeftSec - passedSec);
      setRemainingSec(nextRemaining);
      // Окончание отдыха: вибрация один раз за текущую сессию отдыха.
      if (nextRemaining === 0 && !hapticDoneRef.current) {
        hapticDoneRef.current = true;
        triggerHaptic();
      }
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [restStartedAt, restTimeLeftSec, isResting]);

  const isFinished = remainingSec <= 0 && isResting;

  return { remainingSec, isFinished };
}
