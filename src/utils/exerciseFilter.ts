import type { Exercise, UserInjuries } from '../types';
import { buildExerciseIndex } from './registry';

/**
 * Фильтрация упражнений с учётом травм пользователя.
 * Единая точка логики «безопасно / небезопасно» для всех экранов:
 * список выбора упражнений, предупреждения в карточках, экран настроек.
 */

/** Тип травмы, из-за которой упражнение признано небезопасным. */
export type UnsafeReason = 'shoulder' | 'knee' | 'lowerBack';

/** Русские названия травм в родительном падеже («при травме плеча»). */
export const injuryReasonLabels: Record<UnsafeReason, string> = {
  shoulder: 'плеча',
  knee: 'колена',
  lowerBack: 'поясницы',
};

/** Результат разделения справочника на безопасные и небезопасные упражнения. */
export interface FilteredExercises {
  /** Упражнения, безопасные при текущем наборе травм (или если травм нет вовсе). */
  safe: Exercise[];
  /** Небезопасные упражнения с причинами — показываются только после подтверждения пользователя. */
  unsafe: UnsafeExercise[];
}

/** Небезопасное упражнение с пометкой: какие именно травмы его запрещают. */
export interface UnsafeExercise {
  /** Само упражнение. */
  exercise: Exercise;
  /** Список травм, при которых упражнение небезопасно. */
  reasons: UnsafeReason[];
}

/** Возвращает список активных травм, против которых упражнение небезопасно. */
export function getUnsafeReasons(exercise: Exercise, injuries: UserInjuries): UnsafeReason[] {
  const reasons: UnsafeReason[] = [];
  if (injuries.shoulder && !exercise.isShoulderSafe) reasons.push('shoulder');
  if (injuries.knee && !exercise.isKneeSafe) reasons.push('knee');
  if (injuries.lowerBack && !exercise.isLowerBackSafe) reasons.push('lowerBack');
  return reasons;
}

/** Безопасно ли упражнение при текущем наборе травм пользователя. */
export function isExerciseSafe(exercise: Exercise, injuries: UserInjuries): boolean {
  return getUnsafeReasons(exercise, injuries).length === 0;
}

/**
 * Разделяет справочник упражнений на безопасные и небезопасные для пользователя.
 * @param exercises - полный список упражнений справочника
 * @param injuries - активные травмы пользователя
 * @returns safe — фильтрованный список; unsafe — опасные упражнения с пометками причин
 */
export function getSafeExercises(
  exercises: Exercise[],
  injuries: UserInjuries,
): FilteredExercises {
  const safe: Exercise[] = [];
  const unsafe: UnsafeExercise[] = [];
  for (const exercise of exercises) {
    const reasons = getUnsafeReasons(exercise, injuries);
    if (reasons.length === 0) {
      safe.push(exercise);
    } else {
      unsafe.push({ exercise, reasons });
    }
  }
  return { safe, unsafe };
}

/**
 * Форматирует причины небезопасности в человекочитаемую строку:
 * "Не рекомендуется при травме плеча" / "Не рекомендуется при травмах плеча и поясницы".
 */
export function formatUnsafeReasons(reasons: UnsafeReason[]): string {
  const labels = reasons.map((reason) => injuryReasonLabels[reason]);
  return `Не рекомендуется при ${labels.length > 1 ? 'травмах' : 'травме'} ${labels.join(' и ')}`;
}

/**
 * Находит названия альтернативных упражнений для данного (по полю alternatives).
 * @param exercise - небезопасное упражнение
 * @param allExercises - полный справочник (для разрешения id → name)
 */
export function getAlternativeNames(exercise: Exercise, allExercises: Exercise[]): string[] {
  if (exercise.alternatives === undefined || exercise.alternatives.length === 0) {
    return [];
  }
  const nameById = buildExerciseIndex(allExercises);
  return exercise.alternatives
    .map((alternativeId) => nameById.get(alternativeId)?.name)
    .filter((name): name is string => name !== undefined);
}
