import type { Exercise, UserInjuries } from '../../types';
import { getAlternativeNames, getUnsafeReasons, formatUnsafeReasons } from '../../utils/exerciseFilter';

/** Пропсы предупреждения о небезопасном упражнении. */
export interface InjuryWarningProps {
  /** Упражнение, для которого показывается предупреждение. */
  exercise: Exercise;
  /** Активные травмы пользователя. */
  injuries: UserInjuries;
  /** Полный справочник — нужен, чтобы разрешить id альтернатив в названия. */
  allExercises?: Exercise[];
}

/**
 * Красная плашка-предупреждение: показывается, если упражнение небезопасно
 * при активных травмах пользователя. Сообщает причину («Не рекомендуется при
 * травме плеча») и предлагает безопасные альтернативы из поля alternatives.
 * Компонент ничего не рендерит, если упражнение безопасно — его можно ставить
 * «на всякий случай» в любую карточку/строку списка.
 */
export function InjuryWarning({ exercise, injuries, allExercises }: InjuryWarningProps) {
  const reasons = getUnsafeReasons(exercise, injuries);

  // Упражнение безопасно при текущих травмах — предупреждение не нужно.
  if (reasons.length === 0) {
    return null;
  }

  const alternatives =
    allExercises !== undefined ? getAlternativeNames(exercise, allExercises) : [];

  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-500/60 bg-rose-950/60 px-3 py-2.5 text-sm"
    >
      <p className="flex items-start gap-2 font-medium text-rose-700 dark:text-rose-300">
        <span aria-hidden="true" className="shrink-0">⚠️</span>
        <span>{formatUnsafeReasons(reasons)}</span>
      </p>
      {alternatives.length > 0 && (
        <p className="mt-1.5 pl-7 text-rose-800 dark:text-rose-200/80">
          Альтернатива: {alternatives.join(', ')}
        </p>
      )}
    </div>
  );
}
